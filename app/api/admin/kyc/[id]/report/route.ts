import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { withErrorHandling } from "@/lib/api/handler";

export const POST = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();

  await recordAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "DOWNLOAD_REPORT",
    resource: "KycSession",
    resourceId: params.id,
    ipAddress: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
});
