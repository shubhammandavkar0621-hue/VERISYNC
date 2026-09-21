import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { withErrorHandling } from "@/lib/api/handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const admin = await requireAdmin();

  const [
    total,
    verified,
    failed,
    review,
    flagged,
    technicalFailures,
    highRisk,
    criticalRisk,
    durationAgg,
    avScoreAgg,
    repeatAttempts,
    statusGroups,
    riskGroups,
    anomalyGroups,
    failureReasonRows,
    recentSessions,
    sessionsWithAnomalies,
  ] = await prisma.$transaction([
    prisma.kycSession.count(),
    prisma.kycSession.count({ where: { status: "VERIFIED" } }),
    prisma.kycSession.count({ where: { status: "FAILED" } }),
    prisma.kycSession.count({ where: { status: "REVIEW" } }),
    prisma.kycSession.count({ where: { status: "FLAGGED" } }),
    prisma.kycSession.count({ where: { status: "TECHNICAL_FAILURE" } }),
    prisma.kycSession.count({ where: { riskLevel: "HIGH" } }),
    prisma.kycSession.count({ where: { riskLevel: "CRITICAL" } }),
    prisma.kycSession.aggregate({ _avg: { durationMs: true }, where: { durationMs: { not: null } } }),
    prisma.kycSession.aggregate({ _avg: { avConsistencyScore: true }, where: { avConsistencyScore: { not: null } } }),
    prisma.kycSession.count({ where: { attemptNumber: { gt: 1 } } }),
    prisma.kycSession.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.kycSession.groupBy({
      by: ["riskLevel"],
      _count: { _all: true },
      where: { riskLevel: { not: null } },
      orderBy: { riskLevel: "asc" },
    }),
    prisma.anomaly.groupBy({ by: ["type"], _count: { _all: true }, orderBy: { type: "asc" } }),
    prisma.kycSession.groupBy({
      by: ["failureReason"],
      _count: { _all: true },
      where: { failureReason: { not: null } },
      orderBy: { _count: { failureReason: "desc" } },
      take: 8,
    }),
    prisma.kycSession.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: { createdAt: true, avConsistencyScore: true } }),
    prisma.kycSession.count({ where: { anomalies: { some: {} } } }),
  ]);

  const dayBuckets = new Map<string, { count: number; scoreSum: number; scoreCount: number }>();
  for (const s of recentSessions) {
    const day = s.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(day) ?? { count: 0, scoreSum: 0, scoreCount: 0 };
    bucket.count += 1;
    if (s.avConsistencyScore != null) {
      bucket.scoreSum += s.avConsistencyScore;
      bucket.scoreCount += 1;
    }
    dayBuckets.set(day, bucket);
  }
  const sessionsOverTime = [...dayBuckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-14)
    .map(([date, b]) => ({
      date,
      sessions: b.count,
      avgConsistency: b.scoreCount ? Math.round((b.scoreSum / b.scoreCount) * 10) / 10 : null,
    }));

  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "VIEW_ANALYTICS",
    resource: "Analytics",
    ipAddress: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    kpis: {
      totalSessions: total,
      verified,
      failed,
      review,
      flagged,
      technicalFailures,
      highRisk: highRisk + criticalRisk,
      avgDurationMs: Math.round(durationAgg._avg.durationMs ?? 0),
      avgAvConsistency: Math.round((avScoreAgg._avg.avConsistencyScore ?? 0) * 10) / 10,
      repeatAttempts,
      sessionsWithAnomalies,
    },
    charts: {
      statusDistribution: statusGroups.map((g) => ({ status: g.status, count: (g._count as { _all: number })._all })),
      riskDistribution: riskGroups.map((g) => ({ risk: g.riskLevel, count: (g._count as { _all: number })._all })),
      anomalyCategories: anomalyGroups.map((g) => ({ type: g.type, count: (g._count as { _all: number })._all })),
      failureReasons: failureReasonRows.map((r) => ({ reason: r.failureReason, count: (r._count as { _all: number })._all })),
      sessionsOverTime,
    },
  });
});
