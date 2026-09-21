"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

const ACTIONS = [
  "ALL", "ADMIN_LOGIN", "ADMIN_LOGIN_FAILED", "ADMIN_MFA_VERIFIED", "USER_LOGIN", "USER_LOGIN_FAILED",
  "USER_LOGOUT", "USER_REGISTER", "VIEW_KYC", "SEARCH_CUSTOMER", "VIEW_CUSTOMER_PROFILE", "VIEW_FRAUD_ANALYSIS",
  "DOWNLOAD_REPORT", "VIEW_AUDIT_LOG", "VIEW_SYSTEM_STATUS", "VIEW_ANALYTICS", "RUN_DEMO_SIMULATION",
  "CREATE_KYC_SESSION", "START_KYC_SESSION", "ANALYZE_KYC_SESSION",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [action, setAction] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (action !== "ALL") params.set("action", action);
    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setTotal(data.pagination?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, action]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ScrollText className="h-5 w-5" /> Audit Logs</h1>
          <p className="text-sm text-muted-foreground">{total} recorded events — append-only, cannot be edited or deleted.</p>
        </div>
        <Select value={action} onValueChange={(v) => { setPage(1); setAction(v); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a === "ALL" ? "All actions" : a.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && logs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No audit events found.</TableCell></TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>
                    <div className="text-xs">{log.actorEmail}</div>
                    <div className="text-[10px] text-muted-foreground">{log.actorRole}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-xs">{log.resource}{log.resourceId ? ` · ${log.resourceId.slice(0, 10)}…` : ""}</TableCell>
                  <TableCell className="font-mono text-xs">{log.ipAddress ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={log.result === "SUCCESS" ? "success" : "destructive"}>{log.result}</Badge>
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
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
