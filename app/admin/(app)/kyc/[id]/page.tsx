"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, ShieldAlert, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KycStatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { CircularGauge, MeterBar } from "@/components/shared/gauge";
import { VerificationTimeline } from "@/components/admin/verification-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatDuration, maskEmail, maskName, maskPhone, round1 } from "@/lib/utils";

interface DetailResponse {
  session: any;
  customer: any;
  challenge: any;
  signals: { type: string; score: number; weight: number }[];
  anomalies: { type: string; severity: string; description: string; offsetMs: number | null }[];
  timeline: { timestampMs: number; label: string; category: string; isAnomalous: boolean }[];
  previousAttempts: any[];
}

const SIGNAL_LABELS: Record<string, string> = {
  FACE_LIVENESS: "Face Liveness",
  VOICE_MATCH: "Voice Match",
  LIP_AUDIO_SYNC: "Lip-Audio Synchronization",
  CHALLENGE_RESPONSE: "Challenge Response",
  MOTION_CONSISTENCY: "Motion Consistency",
  BREATH_TIMING: "Breath / Speech Timing",
  CAPTURE_INTEGRITY: "Capture Integrity",
};

export default function AdminKycDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/kyc/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [params.id]);

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { session, customer, signals, anomalies, timeline, previousAttempts } = data;

  const signalMap = Object.fromEntries(signals.map((s) => [s.type, s.score]));

  async function downloadReport() {
    setDownloading(true);
    try {
      await fetch(`/api/admin/kyc/${params.id}/report`, { method: "POST" });
      window.open(`/admin/kyc/${params.id}/report`, "_blank");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="font-mono text-xl font-bold">{session.sessionCode}</h1>
            <p className="text-sm text-muted-foreground">{formatDateTime(session.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <KycStatusBadge status={session.status} />
          <RiskBadge level={session.riskLevel} />
          {session.isDemo && <Badge variant="outline">DEMO — {session.demoScenario ?? "simulated"}</Badge>}
          <Button size="sm" onClick={downloadReport} disabled={downloading}>
            <Download className="h-4 w-4" /> Download Report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Customer ID" value={customer.customerId} mono />
            <Row label="Name" value={maskName(customer.fullName)} />
            <Row label="Email" value={maskEmail(customer.email)} />
            <Row label="Mobile" value={maskPhone(customer.phone)} />
            <Row label="Account Status" value={customer.isActive ? "Active" : "Suspended"} />
            <Row label="Attempts" value={String(previousAttempts.length + 1)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Overall AV Consistency</CardTitle>
            <CardDescription>Automated cross-modal risk assessment — not proof of fraud.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-8">
            <CircularGauge value={session.avConsistencyScore ?? 0} size={140} label="AV Score" />
            <div className="flex-1 space-y-1 text-sm">
              <Row label="Duration" value={formatDuration(session.durationMs)} />
              <Row label="Started" value={session.startedAt ? formatDateTime(session.startedAt) : "—"} />
              <Row label="Completed" value={session.completedAt ? formatDateTime(session.completedAt) : "—"} />
              {session.primaryFindingSummary && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {session.primaryFindingSummary}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">Fraud / Risk Analysis</TabsTrigger>
          <TabsTrigger value="timeline">Verification Timeline</TabsTrigger>
          <TabsTrigger value="history">KYC History</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" /> Session Security Analysis</CardTitle>
              <CardDescription>
                Automated risk assessment based on independent baseline checks and cross-modal consistency signals.
                This is an assistive indicator for review, not definitive proof of fraud.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Existing Independent Verification
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MeterBar label={SIGNAL_LABELS.FACE_LIVENESS} value={signalMap.FACE_LIVENESS ?? session.faceLivenessScore ?? 0} />
                  <MeterBar label={SIGNAL_LABELS.VOICE_MATCH} value={signalMap.VOICE_MATCH ?? session.voiceMatchScore ?? 0} />
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cross-Modal Consistency Signals
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MeterBar label={SIGNAL_LABELS.LIP_AUDIO_SYNC} value={session.lipAudioSyncScore ?? 0} />
                  <MeterBar label={SIGNAL_LABELS.CHALLENGE_RESPONSE} value={session.challengeResponseScore ?? 0} />
                  <MeterBar label={SIGNAL_LABELS.MOTION_CONSISTENCY} value={session.motionConsistencyScore ?? 0} />
                  <MeterBar label={SIGNAL_LABELS.BREATH_TIMING} value={session.breathTimingScore ?? 0} />
                  <MeterBar label={SIGNAL_LABELS.CAPTURE_INTEGRITY} value={session.captureIntegrityScore ?? 0} />
                </div>
              </div>

              {session.challenge && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenge Detail</div>
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-4">
                    <Row label="Phrase" value={data.challenge.phrase} />
                    <Row label="Required Action" value={data.challenge.actionLabel} />
                    <Row label="Spoken Detected" value={data.challenge.spokenPhraseDetected || "—"} />
                    <Row label="Passed" value={data.challenge.passed == null ? "—" : data.challenge.passed ? "Yes" : "No"} />
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Potential Indicators</div>
                {anomalies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No anomalies were detected in this session.</p>
                ) : (
                  <ul className="space-y-2">
                    {anomalies.map((a, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                        <Badge variant={a.severity === "HIGH" ? "risk_critical" : a.severity === "MEDIUM" ? "risk_medium" : "risk_low"}>
                          {a.severity}
                        </Badge>
                        <div>
                          <div className="font-medium">{a.type.replace(/_/g, " ")}</div>
                          <div className="text-muted-foreground">{a.description}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
                This is an automated risk assessment generated by KYC-SYNC's cross-modal consistency engine. It
                is intended to support bank review personnel and does not constitute definitive proof of fraud.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle className="text-base">Verification Timeline</CardTitle></CardHeader>
            <CardContent>
              <VerificationTimeline events={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer KYC History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Main Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previousAttempts.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No previous attempts.</TableCell></TableRow>
                  )}
                  {previousAttempts.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{formatDateTime(a.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{a.sessionCode}</TableCell>
                      <TableCell><KycStatusBadge status={a.status} /></TableCell>
                      <TableCell><RiskBadge level={a.riskLevel} /></TableCell>
                      <TableCell>{formatDuration(a.durationMs)}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{a.failureReason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
    </div>
  );
}
