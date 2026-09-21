import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { jsonError, withErrorHandling } from "@/lib/api/handler";

export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();

  const customer = await prisma.user.findUnique({ where: { id: params.id } });
  if (!customer || customer.role !== "USER") return jsonError("Customer not found.", 404);

  const sessions = await prisma.kycSession.findMany({
    where: { userId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      sessionCode: true,
      status: true,
      riskLevel: true,
      avConsistencyScore: true,
      durationMs: true,
      failureReason: true,
      isDemo: true,
      createdAt: true,
    },
  });

  const latest = sessions[0]
    ? await prisma.kycSession.findUnique({
        where: { id: sessions[0].id },
        include: { signals: true },
      })
    : null;

  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "VIEW_CUSTOMER_PROFILE",
    resource: "User",
    resourceId: customer.id,
    ipAddress: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    customer: {
      id: customer.id,
      customerId: customer.customerId,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      isActive: customer.isActive,
      isDemo: customer.isDemo,
      createdAt: customer.createdAt,
      lastLoginAt: customer.lastLoginAt,
    },
    sessions,
    latestSignals: latest?.signals ?? [],
  });
});
