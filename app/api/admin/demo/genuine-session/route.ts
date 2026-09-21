import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { runDemoSimulation } from "@/lib/kyc/run-demo-session";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { withErrorHandling } from "@/lib/api/handler";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const { sessionId } = await runDemoSimulation("GENUINE");

  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "RUN_DEMO_SIMULATION",
    resource: "KycSession",
    resourceId: sessionId,
    ipAddress: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    metadata: { scenario: "GENUINE" },
  });

  return NextResponse.json({ sessionId });
});
