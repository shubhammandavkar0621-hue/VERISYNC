import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { jsonError, withErrorHandling } from "@/lib/api/handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return jsonError("Provide at least 2 characters to search.", 400);

  const customers = await prisma.user.findMany({
    where: {
      role: "USER",
      OR: [
        { customerId: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { kycSessions: true } },
      kycSessions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, riskLevel: true, createdAt: true } },
    },
  });

  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "SEARCH_CUSTOMER",
    resource: "User",
    ipAddress: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    metadata: { query: q },
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      customerId: c.customerId,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      isActive: c.isActive,
      attempts: c._count.kycSessions,
      lastStatus: c.kycSessions[0]?.status ?? null,
      lastRisk: c.kycSessions[0]?.riskLevel ?? null,
      lastAttemptAt: c.kycSessions[0]?.createdAt ?? null,
    })),
  });
});
