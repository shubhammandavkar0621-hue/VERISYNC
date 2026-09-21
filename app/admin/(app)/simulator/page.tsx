"use client";

import { useState } from "react";
import Link from "next/link";
import { FlaskConical, ShieldCheck, ShieldAlert, Loader2, ExternalLink, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircularGauge, MeterBar } from "@/components/shared/gauge";
import { KycStatusBadge } from "@/components/shared/status-badge";
import { VerificationTimeline } from "@/components/admin/verification-timeline";

interface SimResult {
  session: any;
  timeline: any[];
}

async function fetchDetail(id: string): Promise<SimResult> {
  const res = await fetch(`/api/admin/kyc/${id}`);
  const data = await res.json();
  return { session: data.session, timeline: data.timeline };
}

function ScenarioPanel({
  title,
  description,
  facts,
  tone,
  endpoint,
  icon: Icon,
}: {
  title: string;
  description: string;
  facts: string[];
  tone: "success" | "destructive";
  endpoint: string;
  icon: any;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const detail = await fetchDetail(data.sessionId);
        setResult(detail);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={tone === "success" ? "border-success/30" : "border-destructive/30"}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={tone === "success" ? "h-5 w-5 text-success" : "h-5 w-5 text-destructive"} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {facts.map((f) => <li key={f}>• {f}</li>)}
        </ul>

        <Button className="w-full" variant={tone === "success" ? "default" : "destructive"} onClick={run} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {title === "Legitimate Session" ? "RUN LEGITIMATE DEMO" : "SIMULATE AUDIO/VIDEO ATTACK"}
        </Button>

        {result && (
          <div className="space-y-4 rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <KycStatusBadge status={result.session.status} />
              <Link href={`/admin/kyc/${result.session.id}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                Full detail <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <CircularGauge value={result.session.avConsistencyScore ?? 0} size={96} label="AV Score" />
              <div className="flex-1 space-y-2">
                <MeterBar label="Lip-Audio Sync" value={result.session.lipAudioSyncScore ?? 0} />
                <MeterBar label="Challenge Sync" value={result.session.challengeResponseScore ?? 0} />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <VerificationTimeline events={result.timeline} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FlaskConical className="h-5 w-5" /> Deepfake Attack Simulation Lab
        </h1>
        <p className="text-sm text-muted-foreground">
          Run the real KYC-SYNC scoring engine end-to-end against two scripted scenarios and watch the AV
          consistency score, signals, and timeline react immediately.
        </p>
        <Badge variant="outline" className="mt-2">DEMO MODE — synthetic capture data, not a real biometric attack</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScenarioPanel
          title="Legitimate Session"
          description="A genuine live capture: audio and mouth movement aligned, challenge performed correctly."
          facts={["Audio: aligned", "Mouth: aligned", "Challenge: correct", "Expected result: VERIFIED"]}
          tone="success"
          endpoint="/api/admin/demo/genuine-session"
          icon={ShieldCheck}
        />
        <ScenarioPanel
          title="Attack Simulation"
          description="A simulated face-swap / replayed-audio attack: independent checks look fine, cross-modal signals do not."
          facts={[
            "Audio/video offset: 500–1000ms",
            "Challenge: incorrect timing",
            "Motion: inconsistent",
            "Expected result: REVIEW / FLAGGED",
          ]}
          tone="destructive"
          endpoint="/api/admin/demo/suspicious-session"
          icon={ShieldAlert}
        />
      </div>

      <ScenarioPanel
        title="Technical Failure Session"
        description="Camera/microphone interruption during capture — the system fails safe rather than guessing."
        facts={["Face detection interrupted", "Microphone stream dropped", "Expected result: TECHNICAL_FAILURE"]}
        tone="destructive"
        endpoint="/api/admin/demo/technical-failure-session"
        icon={Wrench}
      />
    </div>
  );
}
