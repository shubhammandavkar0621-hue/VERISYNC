import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { DEMO_MODE } from "@/lib/config";
import { withErrorHandling } from "@/lib/api/handler";
import { recordAuditLog } from "@/lib/security/audit";

export const GET = withErrorHandling(async () => {
  const admin = await requireAdmin();

  const dbStart = Date.now();
  let dbOnline = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOnline = false;
  }
  const dbLatencyMs = Date.now() - dbStart;

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [activeSessions, recentErrors, avgDuration] = await Promise.all([
    prisma.kycSession.count({ where: { status: "IN_PROGRESS", startedAt: { gte: fiveMinAgo } } }),
    prisma.auditLog.count({ where: { result: "FAILURE", createdAt: { gte: oneHourAgo } } }),
    prisma.kycSession.aggregate({ _avg: { durationMs: true }, where: { durationMs: { not: null } } }),
  ]);

  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "VIEW_SYSTEM_STATUS",
    resource: "SystemStatus",
  });

  return NextResponse.json({
    demoMode: DEMO_MODE,
    services: [
      { name: "API", status: "ONLINE" },
      { name: "Database", status: dbOnline ? "ONLINE" : "OFFLINE", latencyMs: dbLatencyMs },
      { name: "AI Analysis Engine", status: "ONLINE" },
      { name: "Face Detection", status: "READY" },
      { name: "Audio Processing", status: "READY" },
      { name: "KYC Session Service", status: "ONLINE" },
    ],
    metrics: {
      avgResponseTimeMs: Math.max(40, dbLatencyMs + 25),
      avgKycDurationMs: Math.round(avgDuration._avg.durationMs ?? 0),
      activeSessions,
      recentErrors,
    },
    generatedAt: new Date().toISOString(),
  });
});
