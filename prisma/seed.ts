/**
 * KYC-SYNC demo seed data.
 *
 * Generates synthetic customers, KYC sessions, and audit logs for the
 * hackathon demo. All data here is fabricated — no real individuals or
 * banking records are represented. Session outcomes are produced by running
 * the actual AV-consistency engine (lib/ai) against scripted demo
 * timelines, so seeded records are internally consistent with the scoring
 * logic used at runtime.
 */
import { PrismaClient, type AuditAction, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateChallenge } from "../lib/ai/challenge-bank";
import { buildDemoScenario, type DemoScenarioName } from "../lib/ai/demo-scenarios";
import { computeAVConsistency } from "../lib/ai/sync-engine";
import { decideOutcome } from "../lib/ai/risk";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Arjun", "Rohan", "Sai",
  "Ananya", "Diya", "Priya", "Kavya", "Meera", "Riya", "Sneha", "Neha",
  "Rahul", "Karan", "Amit", "Pooja", "Sanjay", "Deepak", "Nisha", "Anjali",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Gupta", "Iyer", "Nair", "Reddy", "Rao",
  "Mehta", "Joshi", "Kulkarni", "Desai", "Singh", "Kapoor", "Malhotra", "Bhat",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function randomPastDate(daysAgoMax: number): Date {
  const ms = Date.now() - randInt(0, daysAgoMax * 24 * 60 * 60 * 1000);
  return new Date(ms);
}
function randomIp(): string {
  return `10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

interface SeedCustomer {
  id: string;
  customerId: string;
  email: string;
  isDemo: boolean;
}

async function main() {
  console.log("Seeding KYC-SYNC demo data...");

  // Clean slate (dependency order matters for FKs).
  await prisma.auditLog.deleteMany();
  await prisma.kycTimelineEvent.deleteMany();
  await prisma.anomaly.deleteMany();
  await prisma.verificationSignal.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.kycSession.deleteMany();
  await prisma.user.deleteMany();

  // --- Official demo accounts -----------------------------------------
  const admin = await prisma.user.create({
    data: {
      customerId: "ADM-1001",
      email: "admin@kycsync.demo",
      passwordHash: await hash("Admin@123456"),
      fullName: "Priyanka Deshmukh",
      role: "ADMIN",
      isActive: true,
      isDemo: true,
    },
  });

  const demoUser = await prisma.user.create({
    data: {
      customerId: "CUST-100000",
      email: "user@kycsync.demo",
      passwordHash: await hash("User@123456"),
      fullName: "Demo Customer",
      phone: "+91 98765 43210",
      role: "USER",
      isActive: true,
      isDemo: true,
    },
  });

  // --- Additional synthetic customers -----------------------------------
  const customers: SeedCustomer[] = [
    { id: demoUser.id, customerId: demoUser.customerId, email: demoUser.email, isDemo: true },
  ];

  for (let i = 0; i < 19; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const customerId = `CUST-${String(100001 + i).padStart(6, "0")}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example-bank-demo.com`;
    const user = await prisma.user.create({
      data: {
        customerId,
        email,
        passwordHash: await hash("Seed@123456"),
        fullName: `${first} ${last}`,
        phone: `+91 9${randInt(100000000, 999999999)}`,
        role: "USER",
        isActive: Math.random() > 0.08,
        isDemo: false,
      },
    });
    customers.push({ id: user.id, customerId: user.customerId, email: user.email, isDemo: false });
  }

  // --- KYC sessions -------------------------------------------------------
  type SeedOutcome = "VERIFIED" | "REVIEW_FLAGGED" | "FAILED" | "TECHNICAL_FAILURE";
  const OUTCOME_WEIGHTS: [SeedOutcome, number][] = [
    ["VERIFIED", 50],
    ["REVIEW_FLAGGED", 25],
    ["FAILED", 12],
    ["TECHNICAL_FAILURE", 13],
  ];

  function pickOutcome(): SeedOutcome {
    const total = OUTCOME_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [name, w] of OUTCOME_WEIGHTS) {
      if (r < w) return name;
      r -= w;
    }
    return "VERIFIED";
  }

  const allSessionIds: string[] = [];
  let totalSessions = 0;

  for (const customer of customers) {
    // randInt(3, 5) per customer guarantees at least 3 * customers.length (60+) sessions;
    // with 20 customers this comfortably clears the "at least 50" seed target.
    const attempts = randInt(3, 5);
    const dates = Array.from({ length: attempts }, () => randomPastDate(45)).sort((a, b) => a.getTime() - b.getTime());

    for (let attemptNumber = 1; attemptNumber <= dates.length; attemptNumber++) {
      const createdAt = dates[attemptNumber - 1];
      const seedOutcome = pickOutcome();

      const generated = generateChallenge();
      const demoScenarioForCapture: DemoScenarioName =
        seedOutcome === "TECHNICAL_FAILURE" ? "TECHNICAL_FAILURE" : seedOutcome === "VERIFIED" ? "GENUINE" : seedOutcome === "FAILED" ? "GENUINE" : "SUSPICIOUS";

      const demo = buildDemoScenario(generated, demoScenarioForCapture);

      const baseline =
        seedOutcome === "FAILED"
          ? { faceLivenessScore: randInt(10, 36), voiceMatchScore: randInt(12, 38) }
          : demo.baseline;

      const result = computeAVConsistency(
        {
          faceTimeline: demo.faceTimeline,
          audioTimeline: demo.audioTimeline,
          challenge: demo.challenge,
          challengeDetection: demo.challengeDetection,
          capture: demo.capture,
          baseline,
        },
        demo.timeline
      );
      const outcome = decideOutcome(result, { technicalFailure: demo.technicalFailure });

      const completedAt = new Date(createdAt.getTime() + demo.durationMs + 1600);
      const sessionCode = `KYC-${createdAt.getFullYear()}-${String(100000 + totalSessions).padStart(6, "0")}`;

      const session = await prisma.kycSession.create({
        data: {
          sessionCode,
          userId: customer.id,
          status: outcome.status,
          riskLevel: outcome.riskLevel,
          avConsistencyScore: result.avConsistencyScore,
          faceLivenessScore: result.baseline.faceLivenessScore,
          voiceMatchScore: result.baseline.voiceMatchScore,
          lipAudioSyncScore: result.signals.lipAudioSync,
          challengeResponseScore: result.signals.challengeSync,
          motionConsistencyScore: result.signals.motionConsistency,
          breathTimingScore: result.signals.breathTiming,
          captureIntegrityScore: result.signals.captureIntegrity,
          durationMs: demo.durationMs,
          attemptNumber,
          failureReason: outcome.userFacingReason,
          primaryFindingSummary: outcome.primaryFindingSummary,
          isDemo: true,
          demoScenario: demoScenarioForCapture,
          deviceMetadata: {
            userAgent: "Mozilla/5.0 (Linux; Android 12; Demo Device) Chrome/126",
            platform: "Android",
            screenWidth: 412,
            screenHeight: 915,
          },
          ipAddress: randomIp(),
          startedAt: createdAt,
          completedAt,
          createdAt,
          updatedAt: completedAt,
        },
      });
      allSessionIds.push(session.id);
      totalSessions++;

      await prisma.challenge.create({
        data: {
          kycSessionId: session.id,
          phrase: generated.phrase,
          requiredAction: generated.requiredAction,
          actionLabel: generated.actionLabel,
          expectedActionWindowMinMs: generated.expectedActionWindowMs[0],
          expectedActionWindowMaxMs: generated.expectedActionWindowMs[1],
          generatedAt: createdAt,
          spokenPhraseDetected: demo.challengeDetection.spokenPhraseDetected,
          actionDetected: demo.challengeDetection.actionDetected,
          phraseMatchScore: demo.challengeDetection.phraseMatchScore,
          actionMatchScore: demo.challengeDetection.actionMatchScore,
          passed: result.signals.challengeSync >= 60,
        },
      });

      await prisma.verificationSignal.createMany({
        data: [
          { kycSessionId: session.id, type: "FACE_LIVENESS", score: result.baseline.faceLivenessScore, weight: 0.5 },
          { kycSessionId: session.id, type: "VOICE_MATCH", score: result.baseline.voiceMatchScore, weight: 0.5 },
          { kycSessionId: session.id, type: "LIP_AUDIO_SYNC", score: result.signals.lipAudioSync, weight: 0.32 },
          { kycSessionId: session.id, type: "CHALLENGE_RESPONSE", score: result.signals.challengeSync, weight: 0.24 },
          { kycSessionId: session.id, type: "MOTION_CONSISTENCY", score: result.signals.motionConsistency, weight: 0.18 },
          { kycSessionId: session.id, type: "BREATH_TIMING", score: result.signals.breathTiming, weight: 0.12 },
          { kycSessionId: session.id, type: "CAPTURE_INTEGRITY", score: result.signals.captureIntegrity, weight: 0.14 },
        ],
      });

      if (result.anomalies.length) {
        await prisma.anomaly.createMany({
          data: result.anomalies.map((a) => ({
            kycSessionId: session.id,
            type: a.type,
            severity: a.severity,
            description: a.description,
            offsetMs: a.offsetMs != null ? Math.round(a.offsetMs) : null,
          })),
        });
      }

      await prisma.kycTimelineEvent.createMany({
        data: result.timeline.map((e) => ({
          kycSessionId: session.id,
          timestampMs: Math.round(e.t),
          label: e.label,
          category: e.category,
          isAnomalous: Boolean(e.isAnomalous),
        })),
      });
    }
  }

  console.log(`Created ${totalSessions} KYC sessions across ${customers.length} customers.`);

  // --- Audit logs -----------------------------------------------------------
  const ADMIN_ACTIONS: AuditAction[] = [
    "ADMIN_LOGIN", "VIEW_KYC", "SEARCH_CUSTOMER", "VIEW_CUSTOMER_PROFILE",
    "VIEW_FRAUD_ANALYSIS", "VIEW_ANALYTICS", "VIEW_SYSTEM_STATUS", "VIEW_AUDIT_LOG", "DOWNLOAD_REPORT",
  ];

  const auditRows = Array.from({ length: 60 }).map(() => {
    const action = pick(ADMIN_ACTIONS);
    const resourceId = ["VIEW_KYC", "VIEW_FRAUD_ANALYSIS", "DOWNLOAD_REPORT"].includes(action)
      ? pick(allSessionIds)
      : null;
    return {
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: "ADMIN" as Role,
      action,
      resource: resourceId ? "KycSession" : action === "SEARCH_CUSTOMER" || action === "VIEW_CUSTOMER_PROFILE" ? "User" : "Dashboard",
      resourceId,
      result: "SUCCESS" as const,
      ipAddress: randomIp(),
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Admin Console",
      createdAt: randomPastDate(21),
    };
  });
  await prisma.auditLog.createMany({ data: auditRows });

  const loginRows = customers.slice(0, 8).map((c) => ({
    actorId: c.id,
    actorEmail: c.email,
    actorRole: "USER" as Role,
    action: "USER_LOGIN" as AuditAction,
    resource: "User",
    resourceId: c.id,
    result: "SUCCESS" as const,
    ipAddress: randomIp(),
    createdAt: randomPastDate(21),
  }));
  await prisma.auditLog.createMany({ data: loginRows });

  console.log("Seed complete.");
  console.log("Demo admin: admin@kycsync.demo / Admin@123456");
  console.log("Demo user:  user@kycsync.demo / User@123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
