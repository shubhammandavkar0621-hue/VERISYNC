"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, UserSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KycStatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { maskEmail, maskName, maskPhone, formatDateTime } from "@/lib/utils";

interface CustomerRow {
  id: string;
  customerId: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  attempts: number;
  lastStatus: string | null;
  lastRisk: string | null;
  lastAttemptAt: string | null;
}

export default function CustomerSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(query: string) {
    setQ(query);
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.customers ?? []);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer Search</h1>
        <p className="text-sm text-muted-foreground">Search by Customer ID, name, email, or mobile number.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="CUST-123456, name, email, or mobile…"
              className="pl-9"
              value={q}
              onChange={(e) => search(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Searching…</p>}

      {!loading && searched && results.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <UserSearch className="h-8 w-8 text-muted-foreground/40" />
          No customers matched your search.
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {results.map((c) => (
          <Link key={c.id} href={`/admin/customers/${c.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{maskName(c.fullName)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.customerId}</span>
                    {!c.isActive && <Badge variant="destructive">Suspended</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {maskEmail(c.email)} · {maskPhone(c.phone)} · {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.lastStatus && <KycStatusBadge status={c.lastStatus as any} />}
                  {c.lastRisk && <RiskBadge level={c.lastRisk as any} />}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
