"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  Timer,
  Gauge,
  Repeat,
  Radar,
} from "lucide-react";
import { KpiCard } from "@/components/admin/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_COLORS, RISK_COLORS, CHART_GRID, CHART_MUTED, CHART_PRIMARY } from "@/components/admin/chart-colors";
import { formatDuration } from "@/lib/utils";

interface Analytics {
  kpis: {
    totalSessions: number;
    verified: number;
    failed: number;
    review: number;
    flagged: number;
    technicalFailures: number;
    highRisk: number;
    avgDurationMs: number;
    avgAvConsistency: number;
    repeatAttempts: number;
    sessionsWithAnomalies: number;
  };
  charts: {
    statusDistribution: { status: string; count: number }[];
    riskDistribution: { risk: string; count: number }[];
    anomalyCategories: { type: string; count: number }[];
    failureReasons: { reason: string; count: number }[];
    sessionsOverTime: { date: string; sessions: number; avgConsistency: number | null }[];
  };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const { kpis, charts } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Overview</h1>
        <p className="text-sm text-muted-foreground">Cross-modal KYC verification analytics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Sessions" value={kpis.totalSessions} icon={Users} />
        <KpiCard label="Verified" value={kpis.verified} icon={CheckCircle2} tone="success" />
        <KpiCard label="Failed" value={kpis.failed} icon={XCircle} tone="destructive" />
        <KpiCard label="Under Review" value={kpis.review} icon={AlertTriangle} tone="warning" />
        <KpiCard label="High Risk" value={kpis.highRisk} icon={ShieldAlert} tone="destructive" />
        <KpiCard label="Technical Failures" value={kpis.technicalFailures} icon={Wrench} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg. KYC Duration" value={formatDuration(kpis.avgDurationMs)} icon={Timer} />
        <KpiCard label="Avg. AV Consistency" value={kpis.avgAvConsistency} icon={Gauge} />
        <KpiCard label="Repeat Attempts" value={kpis.repeatAttempts} icon={Repeat} />
        <KpiCard label="Sessions With Anomalies" value={kpis.sessionsWithAnomalies} icon={Radar} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">KYC Status Distribution</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.statusDistribution} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {charts.statusDistribution.map((d) => (
                    <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? CHART_PRIMARY} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Risk Distribution</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.riskDistribution} dataKey="count" nameKey="risk" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {charts.riskDistribution.map((d) => (
                    <Cell key={d.risk} fill={RISK_COLORS[d.risk] ?? CHART_PRIMARY} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">KYC Sessions Over Time</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.sessionsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_MUTED }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: CHART_MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="sessions" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Average AV Consistency Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.sessionsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_MUTED }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: CHART_MUTED }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="avgConsistency" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Failure Reasons</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.failureReasons} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: CHART_MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={160}
                  tick={{ fontSize: 10, fill: CHART_MUTED }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => (v.length > 28 ? v.slice(0, 28) + "…" : v)}
                />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Anomaly Categories</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.anomalyCategories}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 9, fill: CHART_MUTED }}
                  tickLine={false}
                  axisLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: CHART_MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
