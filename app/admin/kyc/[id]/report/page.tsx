"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, maskEmail, maskName, round1 } from "@/lib/utils";

function syncLabel(score: number | null | undefined): "HIGH" | "MEDIUM" | "LOW" {
  const s = score ?? 0;
  if (s >= 70) return "HIGH";
  if (s >= 40) return "MEDIUM";
  return "LOW";
}

export default function KycReportPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/admin/kyc/${params.id}`).then((r) => r.json()).then(setData);
  }, [params.id]);

  if (!data) return <div className="p-10 text-center text-sm text-muted-foreground">Loading report…</div>;

  const { session, customer, anomalies } = data;
  const topAnomaly = anomalies[0];

  return (
    <div className="mx-auto max-w-2xl bg-background px-6 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Download / Print Report
        </Button>
      </div>

      <div className="rounded-xl border border-border p-8 print:border-0 print:p-0">
        <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">KYC-SYNC SECURITY REPORT</h1>
            <p className="text-xs text-muted-foreground">Automated cross-modal risk assessment — hackathon demo build</p>
          </div>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Session ID</dt>
          <dd className="text-right font-mono">{session.sessionCode}</dd>
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="text-right">{maskName(customer.fullName)} ({customer.customerId})</dd>
          <dt className="text-muted-foreground">Contact</dt>
          <dd className="text-right">{maskEmail(customer.email)}</dd>
          <dt className="text-muted-foreground">Timestamp</dt>
          <dd className="text-right">{formatDateTime(session.completedAt ?? session.createdAt)}</dd>
        </dl>

        <Section title="Existing Verification">
          <KV k="Face liveness" v={(session.faceLivenessScore ?? 0) >= 70 ? "PASS" : "REVIEW"} />
          <KV k="Voice match" v={(session.voiceMatchScore ?? 0) >= 70 ? "PASS" : "REVIEW"} />
        </Section>

        <Section title="Cross-Modal Analysis">
          <KV k="Lip / audio synchronization" v={syncLabel(session.lipAudioSyncScore)} />
          <KV k="Challenge synchronization" v={syncLabel(session.challengeResponseScore)} />
          <KV k="Motion consistency" v={syncLabel(session.motionConsistencyScore)} />
          <KV k="Breath / speech timing" v={syncLabel(session.breathTimingScore)} />
          <KV k="Capture integrity" v={syncLabel(session.captureIntegrityScore)} />
          <KV k="Overall AV consistency" v={`${round1(session.avConsistencyScore ?? 0)} / 100`} />
        </Section>

        <Section title="Risk Assessment">
          <p className="text-base font-bold">{session.status.replace(/_/g, " ")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {session.primaryFindingSummary ??
              "Independently valid audio and video signals could not be established as temporally consistent within the same capture."}
          </p>
          {topAnomaly && (
            <p className="mt-2 text-xs text-muted-foreground">
              Primary indicator: {topAnomaly.description}
            </p>
          )}
        </Section>

        <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          This report presents an automated risk assessment produced by KYC-SYNC's cross-modal consistency
          engine. It is intended to assist authorized bank personnel in reviewing a verification session and
          does not constitute definitive proof of fraud or a final identity determination. All data in this
          demonstration build is synthetic.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-1 rounded-lg bg-secondary/30 p-4 print:bg-transparent print:p-0">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
