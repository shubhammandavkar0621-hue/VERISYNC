import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { jsonError, withErrorHandling } from "@/lib/api/handler";

export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();

  const session = await prisma.kycSession.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      challenge: true,
      signals: true,
      anomalies: { orderBy: { createdAt: "asc" } },
      timelineEvents: { orderBy: { timestampMs: "asc" } },
    },
  });
  if (!session) return jsonError("KYC session not found.", 404);

  const previousAttempts = await prisma.kycSession.findMany({
    where: { userId: session.userId, id: { not: session.id } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, sessionCode: true, status: true, riskLevel: true, durationMs: true, createdAt: true, failureReason: true },
  });

  await Promise.all([
    recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "VIEW_FRAUD_ANALYSIS",
      resource: "KycSession",
      resourceId: session.id,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    }),
  ]);

  return NextResponse.json({
    session: {
      id: session.id,
      sessionCode: session.sessionCode,
      status: session.status,
      riskLevel: session.riskLevel,
      avConsistencyScore: session.avConsistencyScore,
      faceLivenessScore: session.faceLivenessScore,
      voiceMatchScore: session.voiceMatchScore,
      lipAudioSyncScore: session.lipAudioSyncScore,
      challengeResponseScore: session.challengeResponseScore,
      motionConsistencyScore: session.motionConsistencyScore,
      breathTimingScore: session.breathTimingScore,
      captureIntegrityScore: session.captureIntegrityScore,
      durationMs: session.durationMs,
      attemptNumber: session.attemptNumber,
      isDemo: session.isDemo,
      demoScenario: session.demoScenario,
      failureReason: session.failureReason,
      primaryFindingSummary: session.primaryFindingSummary,
      deviceMetadata: session.deviceMetadata,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    },
    customer: {
      id: session.user.id,
      customerId: session.user.customerId,
      fullName: session.user.fullName,
      email: session.user.email,
      phone: session.user.phone,
      isActive: session.user.isActive,
      isDemo: session.user.isDemo,
      createdAt: session.user.createdAt,
      lastLoginAt: session.user.lastLoginAt,
    },
    challenge: session.challenge,
    signals: session.signals,
    anomalies: session.anomalies,
    timeline: session.timelineEvents,
    previousAttempts,
  });
});
