import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { withErrorHandling } from "@/lib/api/handler";
import type { AuditAction, Prisma } from "@prisma/client";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const { searchParams } = new URL(req.url);

  const action = searchParams.get("action") as AuditAction | null;
  const actorEmail = searchParams.get("actorEmail")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") ?? 20)));

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = action;
  if (actorEmail) where.actorEmail = { contains: actorEmail, mode: "insensitive" };

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Viewing the audit log is itself logged, preserving a complete trail.
  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "VIEW_AUDIT_LOG",
    resource: "AuditLog",
    ipAddress: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ logs, pagination: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
});
