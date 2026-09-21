# KYC-SYNC

**Verify the identity. Verify the synchronization.**

An AI-powered cross-modal security layer for Video-KYC. It sits on top of a bank's existing face-liveness
and voice-match systems and checks whether the face, lip movement, speech, head/face motion, challenge
response, and capture timing are **temporally and physically consistent with one another** — instead of
trusting two independent checks that can each be defeated separately (a face-swap that beats liveness, a
cloned/replayed voice clip that beats voice match).

> This is a hackathon MVP. All data in this repository (customers, sessions, audit logs) is synthetic demo
> data. KYC-SYNC produces an **automated risk assessment** to assist bank review personnel — it does not
> claim infallible deepfake detection and does not constitute proof of fraud.

---

## 1. Problem Statement

Video-KYC today typically runs two independent checks:

1. **Face liveness** — is there a real, live face in front of the camera?
2. **Voice matching** — does the voice match the enrolled/claimed speaker?

An attacker doesn't need to beat a combined system — just each check, separately. A real-time face-swap can
pass liveness; a short cloned or replayed voice clip can pass voice matching. Both can report "success" even
though the face and voice never came from the same live capture.

## 2. Solution

KYC-SYNC adds a **Multi-Signal Consistency Engine** that fuses:

| Signal | What it measures |
|---|---|
| Lip / Audio Sync | Cross-correlation between mouth movement and speech activity, and the time offset between them |
| Challenge Response | Whether a randomly generated spoken phrase + physical action happened, and on time |
| Motion Consistency | Whether head/face movement is physiologically plausible (no impossible jumps) |
| Breath / Speech Timing | Whether the pre-speech pause matches a natural, live utterance |
| Capture Integrity | Frame gaps, duplicate frames, and stream interruptions during capture |

These combine into a single, **explainable, configurable** AV Consistency score:

```
AVConsistency = w1·LipAudioSync + w2·ChallengeSync + w3·MotionConsistency + w4·BreathTiming + w5·CaptureIntegrity
```

Weights live in one place — [`lib/config.ts`](./lib/config.ts) — and are not claimed to be a scientifically
validated ground truth; they are a tunable starting point.

## 3. Architecture

```
Browser (camera/mic)
  ├─ MediaPipe Face Landmarker  → mouth openness, head yaw/pitch, blink   (real, on-device)
  ├─ Web Audio API              → RMS energy, speech activity, ZCR        (real, on-device)
  ├─ Web Speech API              → spoken phrase transcript (best-effort)
  └─ derived feature timelines (NOT raw video/audio) ──────────► POST /api/kyc/session/:id/analyze
                                                                          │
                                                        Next.js API routes (Node)
                                                                          │
                                              lib/ai/sync-engine.ts (pure, unit-tested)
                                                  → signals, anomalies, timeline
                                              lib/ai/risk.ts → VERIFIED / REVIEW / FLAGGED / FAILED
                                                                          │
                                                              PostgreSQL via Prisma
                                                                          │
                                          Admin dashboard ◄── analytics, audit log, fraud analysis
```

Key design choices:

- **Privacy-preserving by default.** Feature extraction (face landmarks, audio energy) happens in the
  browser. Only small derived feature timelines are sent to the server — raw video/audio is never persisted.
- **Server is the source of truth.** The client can compute a live preview, but the server always
  recomputes the AV consistency score from the submitted feature timelines before persisting a result — a
  client can't simply post a fabricated score.
- **Adapters, not hard dependencies.** Face-liveness/voice-match integration
  ([`lib/ai/adapters/baseline-adapter.ts`](./lib/ai/adapters/baseline-adapter.ts)) and the browser face model
  ([`lib/ai/capture/face-landmarker-client.ts`](./lib/ai/capture/face-landmarker-client.ts)) are both defined
  as clean interfaces with a working demo/heuristic fallback, so the app is always runnable — a real vendor
  integration is a drop-in replacement.
- **Demo Mode.** Seeded demo accounts and the admin-only **Deepfake Attack Simulation Lab**
  (`/admin/simulator`) run the *real* scoring engine against three scripted capture scenarios (Genuine,
  Suspicious, Technical Failure) so the product can be demonstrated reliably without a trained ML model.

## 4. Features

- Role-based auth (USER / ADMIN) with server-side role determination (client-sent roles are never trusted)
- Admin login with simulated MFA/OTP step
- Full live KYC flow: intro → camera/mic permission → randomized challenge (phrase + action) → processing →
  result, targeting a 10–15s round trip (hard cap ~20s)
- Cross-modal AV Consistency scoring engine with explainable per-signal breakdown
- Admin dashboard: KPIs, Recharts analytics, searchable/filterable KYC session table
- Customer search → masked profile → verification summary gauges → KYC history → verification timeline
- Session security analysis / explainable security report (printable) with careful, non-accusatory language
- System health panel, append-only audit log
- Deepfake Attack Simulation Lab (admin-only, runs the real engine against Genuine/Attack/Technical-Failure scenarios)
- Seed data: 20 customers, 55 KYC sessions, audit logs
- Unit tests for the scoring engine, risk decisioning, validation schemas, password hashing, rate limiting, and session tokens

## 5. Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, React, Tailwind CSS, Radix-based component kit, Recharts
- **Backend:** Next.js API routes (Node runtime), Zod validation
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Custom signed-JWT session (`jose`, edge-compatible for middleware) + bcrypt password hashing
- **AI/CV:** MediaPipe Face Landmarker (browser, via CDN-hosted wasm/model), Web Audio API, Web Speech API
- **Testing:** Vitest

## 6. Project Structure

```
kyc-sync/
├── app/
│   ├── page.tsx                     Landing page
│   ├── login/                       Customer login
│   ├── admin/login/                 Admin login + MFA
│   ├── admin/(app)/                 Admin dashboard shell (sidebar layout)
│   │   ├── dashboard/               KPIs + charts
│   │   ├── kyc/                     Session table + detail (fraud analysis, timeline, history)
│   │   ├── customers/               Search + profile
│   │   ├── simulator/               Deepfake Attack Simulation Lab
│   │   ├── audit-logs/
│   │   └── system-status/
│   ├── user/dashboard/               Customer dashboard
│   ├── kyc/intro/, kyc/verify/       Live KYC capture flow
│   └── api/                          auth/, kyc/, admin/ route handlers
├── components/                       ui/ (design system), shared/, kyc/, admin/, user/, marketing/
├── lib/
│   ├── ai/                           sync-engine, risk, demo-scenarios, challenge-bank, capture/, adapters/
│   ├── auth/                         session signing, current-user, client session context
│   ├── security/                     password, audit, rate-limit, ids
│   ├── validation/                   Zod schemas
│   └── db/prisma.ts
├── prisma/schema.prisma, seed.ts
├── middleware.ts                     RBAC route protection
├── Dockerfile, docker-compose.yml, .env.example
└── vitest.config.ts
```

## 7. Installation

Requirements: Node.js 20+, npm, and a PostgreSQL database (local, Docker, or a hosted provider like Supabase/Neon).

```bash
git clone <this-repo>
cd kyc-sync
npm install
cp .env.example .env
# edit .env: set DATABASE_URL and a strong AUTH_SECRET
```

## 8. Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret (32+ chars) used to sign session/MFA JWTs — generate with `openssl rand -base64 32` |
| `DEMO_MODE` | `true` (default) surfaces the admin OTP in the login response and shows demo banners; set `false` for a production-style build |
| `NODE_ENV` | `development` / `production` |

## 9. Database Setup

**Option A — Docker Postgres:**

```bash
docker compose up -d db
```

**Option B — your own Postgres / Supabase / Neon:** just point `DATABASE_URL` at it.

Then push the schema:

```bash
npx prisma db push
```

(Or `npm run db:migrate` if you prefer tracked migrations.)

## 10. Seed Data

```bash
npm run db:seed
```

Creates 20 customers, 55 KYC sessions (mixed VERIFIED / REVIEW / FLAGGED / FAILED / TECHNICAL_FAILURE across
varied risk levels and dates), the associated signals/anomalies/timelines, and ~60 audit log entries. All
scores are produced by running the real scoring engine (`lib/ai`) against scripted demo timelines, so seed
data is internally consistent with what the live app computes.

## 11. Demo Accounts

| Role | Identifier | Password |
|---|---|---|
| Admin | `admin@kycsync.demo` | `Admin@123456` |
| Customer | `user@kycsync.demo` | `User@123456` |

Admin login requires a second-step verification code. In `DEMO_MODE`, that code is returned in the API
response and shown on-screen (clearly labeled **DEMO MODE**) — in a real deployment it would be delivered
out-of-band (SMS/authenticator app).

Additional synthetic customers seeded for browsing in the admin dashboard share the password `Seed@123456`.

## 12. Running Locally

```bash
npm run dev
```

Visit `http://localhost:3000`. Camera/microphone access requires either `localhost` or HTTPS.

Production build:

```bash
npm run build
npm run start
```

Run tests:

```bash
npm run test
```

## 13. Deployment

**Recommended: Vercel (app) + Neon/Supabase (Postgres)**

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Set `DATABASE_URL` and `AUTH_SECRET` as Vercel environment variables.
4. Run `npx prisma db push && npm run db:seed` once against the production database (e.g. from your machine
   with the production `DATABASE_URL`, or a one-off CI job).

**Alternative: Docker Compose (app + Postgres, self-contained)**

```bash
docker compose up -d --build
docker compose exec app npx prisma db push
docker compose exec app npx tsx prisma/seed.ts
```

The app will be available at `http://localhost:3000`.

## 14. AI / ML Architecture

KYC-SYNC deliberately avoids large, GPU-hungry models so it can run on low-end Android browsers:

- **Face landmarks:** MediaPipe Face Landmarker (`@mediapipe/tasks-vision`), loaded from CDN, running
  `numFaces: 1` with blendshapes + facial transformation matrices — enough to derive mouth-openness and
  head yaw/pitch without a bespoke geometric model.
- **Audio features:** Web Audio API `AnalyserNode` (RMS energy, zero-crossing rate) — no ML model needed for
  speech-activity detection at this fidelity.
- **Phrase matching:** Web Speech API transcript scored with a lightweight Levenshtein + token-overlap
  fuzzy-match (`lib/ai/capture/phrase-match.ts`), tolerant of ASR noise.
- **Fusion:** `lib/ai/sync-engine.ts` is pure, dependency-free TypeScript (cross-correlation, threshold
  logic) — easy to unit test, and portable to a future native Android SDK without any browser API.
- **Demo Mode fallback:** if the real face model fails to load (offline environment, unsupported browser),
  a non-demo user's session is marked `TECHNICAL_FAILURE` rather than silently faking a result. Demo
  accounts can instead opt into a scripted scenario (Genuine/Suspicious/Technical Failure) that exercises the
  same scoring engine end-to-end.

## 15. Security Architecture

- Passwords hashed with bcrypt (12 rounds)
- Sessions are signed, HTTP-only, `SameSite=Lax` JWT cookies (edge-compatible via `jose`), verified in
  `middleware.ts` for every `/user`, `/kyc`, `/admin`, `/api/kyc`, `/api/admin` request
- **Role is always re-derived server-side** from the database on protected routes — never trusted from the
  client or from a stale JWT claim alone (`getCurrentUser`)
- Zod validation on every mutating API route
- In-memory rate limiting on login/register/KYC-session-creation endpoints
- Append-only audit log (`lib/security/audit.ts`) with no update/delete path exposed anywhere in the app
- Secure HTTP headers (CSP, HSTS, X-Frame-Options, Permissions-Policy) set in `next.config.js`
- IDOR protection: every KYC/customer lookup is scoped to the authenticated user (`session.userId ===
  resource.userId`) or requires the ADMIN role
- No sensitive internal scores/anomalies are ever returned to a USER-role session — only status, a safe
  high-level reason, and their own history

## 16. Limitations

- This is a hackathon MVP: the face-liveness/voice-match "baseline" adapter is a heuristic placeholder, not
  a certified biometric vendor integration — see `lib/ai/adapters/baseline-adapter.ts` for the interface a
  real integration would implement.
- The AV Consistency weights and thresholds are illustrative defaults, not validated against real fraud
  data.
- MediaPipe Face Landmarker is loaded from a public CDN at runtime; a fully offline/air-gapped deployment
  would need to self-host those assets.
- Rate limiting is in-memory and per-instance; a multi-instance production deployment should back it with a
  shared store (Redis/Upstash).
- This build pins Next.js 14.2.x. `npm audit` will flag several advisories whose fixes only ship in the
  15.x line (Image Optimizer DoS, RSC cache poisoning, Server Actions SSRF, etc.). None of those subsystems
  are used here (no `next/image` remote patterns, no rewrites, no Server Actions), but a production
  deployment should plan a Next.js 15 upgrade rather than relying on that mitigation.

## 17. Future Improvements

- Native Android SDK reusing `lib/ai/sync-engine.ts` and `lib/ai/signal-math.ts` (both dependency-free)
- ONNX Runtime Web fusion model as an optional, quantized replacement for the rule-based scorer
- Real vendor adapters for face-liveness and voice-match (behind the existing `BaselineCheckAdapter` interface)
- Configurable per-branch/per-product risk threshold profiles
- Case-management workflow (assign/resolve REVIEW and FLAGGED sessions) for bank ops teams

---

*KYC-SYNC — an automated cross-modal risk assessment tool to support bank verification personnel. It does
not make a final identity or fraud determination.*
