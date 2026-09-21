"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const { refresh } = useSession();

  const [stage, setStage] = useState<"credentials" | "mfa">("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }
      if (!data.mfaRequired) {
        setError("This account is not an administrator account.");
        return;
      }
      setMfaToken(data.mfaToken);
      setDemoOtp(data.demoOtp ?? null);
      setStage("mfa");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        return;
      }
      await refresh();
      router.push("/admin/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background bg-gradient-to-b from-secondary/40 to-background px-4 py-12">
      <div className="cyber-grid pointer-events-none fixed inset-0 opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/30">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            KYC<span className="text-accent">-SYNC</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Administrator Security Console</p>
        </div>

        <Card className="border-border/70 shadow-2xl shadow-black/20">
          {stage === "credentials" ? (
            <>
              <CardHeader>
                <CardTitle>Administrator Sign-In</CardTitle>
                <CardDescription>Restricted access. All activity is logged and audited.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitCredentials}>
                  <div className="space-y-2">
                    <Label htmlFor="identifier">Admin ID / Email</Label>
                    <Input
                      id="identifier"
                      placeholder="ADM-1234 or admin@bank.com"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Continue to Verification
                  </Button>
                </form>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    setIdentifier("admin@kycsync.demo");
                    setPassword("Admin@123456");
                  }}
                >
                  Fill Demo Admin Credentials
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-accent" /> Verification Code
                </CardTitle>
                <CardDescription>Enter the 6-digit code sent to your registered device.</CardDescription>
              </CardHeader>
              <CardContent>
                {demoOtp && (
                  <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm">
                    <Badge variant="secondary" className="mb-1">DEMO MODE</Badge>
                    <p>
                      In production this code is delivered out-of-band. For this hackathon build, your code is:{" "}
                      <span className="font-mono text-base font-bold tracking-widest">{demoOtp}</span>
                    </p>
                  </div>
                )}
                <form className="space-y-4" onSubmit={submitOtp}>
                  <div className="space-y-2">
                    <Label htmlFor="otp">6-digit code</Label>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      maxLength={6}
                      className="text-center text-lg font-mono tracking-[0.5em]"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify &amp; Sign In
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setStage("credentials")}>
                    Back
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Not a bank administrator? <Link href="/login" className="text-primary hover:underline">Go to customer login</Link>
        </p>
      </div>
    </div>
  );
}
