"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, XCircle, Clock, Users, AlertTriangle, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/admin/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/utils";

export default function SystemStatusPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = () => fetch("/api/admin/system-status").then((r) => r.json()).then(setData).catch(() => {});
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <Skeleton className="h-72" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Activity className="h-5 w-5" /> System Health</h1>
        <p className="text-sm text-muted-foreground">Live status of KYC-SYNC platform services.</p>
        {data.demoMode && <Badge variant="outline" className="mt-2">DEMO MODE — metrics reflect this sandbox deployment</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.services.map((s: any) => (
          <Card key={s.name}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                {s.latencyMs != null && <div className="text-xs text-muted-foreground">{s.latencyMs}ms latency</div>}
              </div>
              <Badge variant={s.status === "ONLINE" || s.status === "READY" ? "success" : "destructive"} className="gap-1">
                {s.status === "ONLINE" || s.status === "READY" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {s.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg. Response Time" value={`${data.metrics.avgResponseTimeMs}ms`} icon={Timer} />
        <KpiCard label="Avg. KYC Duration" value={formatDuration(data.metrics.avgKycDurationMs)} icon={Clock} />
        <KpiCard label="Active Sessions" value={data.metrics.activeSessions} icon={Users} />
        <KpiCard label="Recent Errors (1h)" value={data.metrics.recentErrors} icon={AlertTriangle} tone={data.metrics.recentErrors > 0 ? "warning" : "default"} />
      </div>

      <p className="text-xs text-muted-foreground">Last updated {new Date(data.generatedAt).toLocaleTimeString()} · auto-refreshes every 30s</p>
    </div>
  );
}
