import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { withErrorHandling } from "@/lib/api/handler";
import type { KycStatus, Prisma, RiskLevel } from "@prisma/client";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status") as KycStatus | null;
  const risk = searchParams.get("risk") as RiskLevel | null;
  const search = searchParams.get("search")?.trim();
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize") ?? 15)));

  const where: Prisma.KycSessionWhereInput = {};
  if (status) where.status = status;
  if (risk) where.riskLevel = risk;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { sessionCode: { contains: search, mode: "insensitive" } },
      { user: { customerId: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { phone: { contains: search, mode: "insensitive" } } },
      { user: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, sessions] = await prisma.$transaction([
    prisma.kycSession.count({ where }),
    prisma.kycSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { customerId: true, fullName: true, email: true } } },
    }),
  ]);

  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "VIEW_KYC",
    resource: "KycSession",
    ipAddress: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    metadata: { search: search ?? null, status, risk, page },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      sessionCode: s.sessionCode,
      customer: { customerId: s.user.customerId, fullName: s.user.fullName, email: s.user.email },
      status: s.status,
      riskLevel: s.riskLevel,
      avConsistencyScore: s.avConsistencyScore,
      attemptNumber: s.attemptNumber,
      isDemo: s.isDemo,
      createdAt: s.createdAt,
    })),
    pagination: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});
