"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KycStatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { MeterBar } from "@/components/shared/gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatDuration, maskEmail, maskName, maskPhone } from "@/lib/utils";
import Link from "next/link";

const SIGNAL_LABELS: Record<string, string> = {
  FACE_LIVENESS: "Face Liveness",
  VOICE_MATCH: "Voice Match",
  LIP_AUDIO_SYNC: "Lip-Audio Synchronization",
  CHALLENGE_RESPONSE: "Challenge Response",
  MOTION_CONSISTENCY: "Motion Consistency",
  BREATH_TIMING: "Breath / Speech Timing",
  CAPTURE_INTEGRITY: "Capture Integrity",
};

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/admin/customers/${params.id}`).then((r) => r.json()).then(setData);
  }, [params.id]);

  if (!data) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  }

  const { customer, sessions, latestSignals } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-bold">{maskName(customer.fullName)}</h1>
          <p className="font-mono text-sm text-muted-foreground">{customer.customerId}</p>
        </div>
        {!customer.isActive && <Badge variant="destructive">Suspended</Badge>}
        {customer.isDemo && <Badge variant="outline">DEMO CUSTOMER</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer Information</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Customer ID" value={customer.customerId} />
            <Row label="Contact" value={maskEmail(customer.email)} />
            <Row label="Mobile" value={maskPhone(customer.phone)} />
            <Row label="Account Status" value={customer.isActive ? "Active" : "Suspended"} />
            <Row label="Last Verification" value={sessions[0] ? formatDateTime(sessions[0].createdAt) : "—"} />
            <Row label="Attempts" value={String(sessions.length)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Latest Verification Summary</CardTitle></CardHeader>
          <CardContent>
            {latestSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verification signals recorded yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {latestSignals.map((s: any) => (
                  <MeterBar key={s.type} label={SIGNAL_LABELS[s.type] ?? s.type} value={s.score} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">KYC History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Session ID</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>AV Score</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{s.sessionCode}</TableCell>
                  <TableCell><KycStatusBadge status={s.status} /></TableCell>
                  <TableCell><RiskBadge level={s.riskLevel} /></TableCell>
                  <TableCell className="tabular-nums">{s.avConsistencyScore != null ? Math.round(s.avConsistencyScore) : "—"}</TableCell>
                  <TableCell>{formatDuration(s.durationMs)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/admin/kyc/${s.id}`}><Eye className="h-4 w-4" /> View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
