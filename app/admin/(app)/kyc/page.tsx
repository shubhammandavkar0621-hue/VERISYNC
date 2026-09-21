"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KycStatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, maskName, round1 } from "@/lib/utils";

interface SessionRow {
  id: string;
  sessionCode: string;
  customer: { customerId: string; fullName: string; email: string };
  status: string;
  riskLevel: string | null;
  avConsistencyScore: number | null;
  attemptNumber: number;
  isDemo: boolean;
  createdAt: string;
}

const STATUS_OPTIONS = ["ALL", "PENDING", "IN_PROGRESS", "VERIFIED", "FAILED", "REVIEW", "FLAGGED", "TECHNICAL_FAILURE"];
const RISK_OPTIONS = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function AdminKycTablePage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [risk, setRisk] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (status !== "ALL") params.set("status", status);
    if (risk !== "ALL") params.set("risk", risk);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/admin/kyc?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setRows(data.sessions ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [page, status, risk, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">KYC Sessions</h1>
        <p className="text-sm text-muted-foreground">{total} total sessions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Customer ID, KYC ID, email, mobile…"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={risk} onValueChange={(v) => { setPage(1); setRisk(v); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              {RISK_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>{r === "ALL" ? "All risk levels" : r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KYC ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date / Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>AV Score</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>System</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">No sessions match these filters.</TableCell></TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.sessionCode}</TableCell>
                  <TableCell>
                    <div className="font-medium">{maskName(row.customer.fullName)}</div>
                    <div className="text-xs text-muted-foreground">{row.customer.customerId}</div>
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell><KycStatusBadge status={row.status as any} /></TableCell>
                  <TableCell><RiskBadge level={row.riskLevel as any} /></TableCell>
                  <TableCell className="tabular-nums">{row.avConsistencyScore != null ? round1(row.avConsistencyScore) : "—"}</TableCell>
                  <TableCell>{row.attemptNumber}</TableCell>
                  <TableCell>
                    {row.status === "TECHNICAL_FAILURE" ? (
                      <Badge variant="outline">Technical</Badge>
                    ) : (
                      <Badge variant="secondary">Normal</Badge>
                    )}
                    {row.isDemo && <Badge variant="outline" className="ml-1">DEMO</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/admin/kyc/${row.id}`}><Eye className="h-4 w-4" /> View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
