# Phase 4: AI Extraction & Technical Profiling - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 10 (2 modified, 8 created)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` | model | CRUD | `src/db/schema.ts` (self — extend) | exact |
| `src/schemas/extraction.ts` | model/validation | transform | `src/acquisition/types.ts` | role-match |
| `src/extraction/instructor-client.ts` | utility | request-response | `src/lib/redis.ts` (singleton client pattern) | partial |
| `src/extraction/build-prompt.ts` | utility | transform | `src/acquisition/index.ts` (data assembly) | partial |
| `src/extraction/extract-profile.ts` | service | request-response | `src/acquisition/index.ts` | role-match |
| `src/extraction/normalize-capacity.ts` | utility | transform | `src/acquisition/types.ts` (pure helpers) | partial |
| `src/extraction/index.ts` | service | request-response | `src/acquisition/index.ts` | exact |
| `src/workers/extraction.worker.ts` | worker | event-driven | `src/workers/acquisition.worker.ts` | exact |
| `src/workers/queues.ts` | config | event-driven | `src/workers/queues.ts` (self — extend) | exact |
| `src/extraction/run.ts` | utility/cli | batch | `src/acquisition/run.ts` | exact |

---

## Pattern Assignments

---

### `src/db/schema.ts` (model — MODIFY)

**Analog:** `src/db/schema.ts` (the file itself — additive extension)

**What changes:** Add `"Extracted"` to `leadStatusEnum`; add four new tables. All existing table definitions remain untouched.

**Existing enum pattern** (lines 3–8):
```typescript
export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Errored",
]);
```
Add `"Extracted"` between `"Crawled"` and `"Errored"` so the enum is semantically sequential:
```typescript
export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Extracted",   // NEW — Phase 4
  "Errored",
]);
```

**Existing table pattern to copy** (lines 10–17 — `leads` table):
```typescript
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

**Existing foreign-key reference pattern** (lines 47–55 — `manufacturerPages` table):
```typescript
export const manufacturerPages = pgTable("manufacturer_pages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id),
  url: text("url").notNull(),
  pageType: pageTypeEnum("page_type").notNull(),
  markdownContent: text("markdown_content").notNull(),
  crawledAt: timestamp("crawled_at").notNull().defaultNow(),
}, (t) => [unique().on(t.leadId, t.url)]);
```

**Existing type export pattern** (lines 29–35):
```typescript
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
```

**New imports needed** — extend the existing import line:
```typescript
// Add to existing import from "drizzle-orm/pg-core":
import {
  doublePrecision,   // for capacityMtPerYear
  integer, pgEnum, pgTable, serial, text, timestamp, unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";   // for text().array() default
```

**New tables to add** (after existing `manufacturerPages` block):
```typescript
// Phase 4: AI extraction profile tables
export const manufacturerProfiles = pgTable("manufacturer_profiles", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().unique().references(() => leads.id),
  industriesServed: text("industries_served").array().notNull().default(sql`'{}'::text[]`),
  capacityMtPerYear: doublePrecision("capacity_mt_per_year"),
  capacityRawText: text("capacity_raw_text"),
  extractedAt: timestamp("extracted_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => manufacturerProfiles.id),
  name: text("name").notNull(),
  casNumber: text("cas_number"),
  grade: text("grade"),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => manufacturerProfiles.id),
  type: text("type").notNull(),   // "email" | "phone" | "whatsapp"
  value: text("value").notNull(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => manufacturerProfiles.id),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country").notNull().default("India"),
});

export type ManufacturerProfile = typeof manufacturerProfiles.$inferSelect;
export type NewManufacturerProfile = typeof manufacturerProfiles.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Location = typeof locations.$inferSelect;
```

**Pitfall:** `text().array().notNull().default([])` is invalid Drizzle syntax. Must use `sql` template: `.default(sql\`'{}'::text[]\`)`. The `sql` import must be added from `"drizzle-orm"` (not `"drizzle-orm/pg-core"`).

---

### `src/schemas/extraction.ts` (model/validation — CREATE)

**Analog:** `src/acquisition/types.ts` (lines 1–17 — Zod schema + type export pattern)

**Imports pattern** (copy from `src/acquisition/types.ts` line 1):
```typescript
import { z } from "zod";
```

**Schema + type export pattern** (lines 1–9 of `src/acquisition/types.ts`):
```typescript
export const AcquisitionJobSchema = z.object({
  leadId: z.number().int().positive(),
  url: z.string().url("url must be a valid URL"),
});

export type AcquisitionJob = z.infer<typeof AcquisitionJobSchema>;
```
Apply the same pattern: one `z.object(...)` export per sub-schema, one `z.infer<...>` type export per schema.

**Job payload schema** (mirrors `AcquisitionJobSchema` exactly — for `ExtractionJobSchema`):
```typescript
export const ExtractionJobSchema = z.object({
  leadId: z.number().int().positive(),
});

export type ExtractionJob = z.infer<typeof ExtractionJobSchema>;
```

**Full extraction schema** (new pattern — no existing analog; use RESEARCH.md Pattern 3):
```typescript
const CAS_REGEX = /^\d{2,7}-\d{2}-\d$/;

export const INDUSTRY_TAGS = [
  "Pharma", "Agrochemicals", "Polymers & Plastics", "Specialty Chemicals",
  "Dyes & Pigments", "Petrochemicals", "Paints & Coatings", "Food & Feed Additives",
  "Water Treatment", "Textile Chemicals", "Rubber & Elastomers",
  "Construction Chemicals", "Electronics & Semiconductors", "Other",
] as const;

export const ProductSchema = z.object({
  name: z.string().describe("Chemical or product name as listed on the manufacturer's site"),
  cas_number: z.string().regex(CAS_REGEX).nullable()
    .describe("CAS Registry Number in format XXXXXXX-XX-X. Return null if not found."),
  grade: z.string().nullable().describe("Product grade or purity specification, or null"),
});

export const ContactSchema = z.object({
  type: z.enum(["email", "phone", "whatsapp"]),
  value: z.string().describe("Raw contact value as found on the page"),
});

export const LocationSchema = z.object({
  address: z.string().nullable().describe("Full street address, or null if not found"),
  city: z.string().nullable(),
  state: z.string().nullable().describe("Indian state name"),
  country: z.string().default("India"),
});

export const CapacitySchema = z.object({
  value_mt_per_year: z.number().nullable()
    .describe("Production capacity normalized to Metric Tons per year. Return null if unknown."),
  raw_text: z.string().nullable()
    .describe("Original capacity text as found on the page (e.g., '500 MT/month', '1000 KL/year')"),
});

export const ManufacturerExtractionSchema = z.object({
  products: z.array(ProductSchema)
    .describe("List of all chemical products and product lines found across all pages"),
  contacts: z.array(ContactSchema)
    .describe("All contact details found (emails, phones, WhatsApp numbers)"),
  locations: z.array(LocationSchema)
    .describe("All manufacturing plant or office locations found"),
  capacity: CapacitySchema.describe("Production capacity information"),
  industries_served: z.array(z.enum(INDUSTRY_TAGS))
    .describe("Industries this manufacturer serves, from the standardized taxonomy only"),
});

export type ManufacturerExtraction = z.infer<typeof ManufacturerExtractionSchema>;
```

---

### `src/extraction/instructor-client.ts` (utility — CREATE)

**Analog:** `src/lib/redis.ts` (lines 1–18 — singleton client factory, exported as named export, throws on missing env var)

**Import pattern** (copy from `src/lib/redis.ts` lines 1–3):
```typescript
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is not set");
}
```
Apply the same guard pattern for `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.

**Singleton export pattern** (copy structure from `src/lib/redis.ts` line 16):
```typescript
export function createRedisConnection(): IORedis {
  return new IORedis(redisUrl!, { maxRetriesPerRequest: null });
}
```
For instructor clients, export named constants (not factory functions — clients are stateless and safe to share):
```typescript
export const openAIInstructor = Instructor({ client: oai, mode: "TOOLS" });
export const anthropicInstructor = Instructor<typeof anthropicClient>({ client: anthropicClient, mode: "TOOLS" });
```

**Full file structure** (new pattern from RESEARCH.md Pattern 1):
```typescript
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { createLLMClient } from "llm-polyglot";

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
// Not required at startup — only used in fallback path

const oai = new OpenAI({ apiKey: openaiApiKey });

export const openAIInstructor = Instructor({
  client: oai,
  mode: "TOOLS",
});

// Anthropic via llm-polyglot adapter — only instantiate if key is present
export const anthropicInstructor = anthropicApiKey
  ? Instructor<ReturnType<typeof createLLMClient>>({
      client: createLLMClient({ provider: "anthropic", apiKey: anthropicApiKey }),
      mode: "TOOLS",
    })
  : null;
```

---

### `src/extraction/build-prompt.ts` (utility — CREATE)

**Analog:** `src/acquisition/index.ts` (lines 25–45 — sequential data assembly with guard conditions before processing)

**Guard pattern** (from `src/acquisition/index.ts` lines 27–31):
```typescript
const homepageCrawled = pages.some((p) => p.pageType === "homepage");
if (!homepageCrawled) {
  throw new Error(`Homepage not crawled for leadId=${leadId} url=${url}`);
}
```
Apply the same defensive guard: if `pages.length === 0`, throw immediately.

**Logger warn pattern** (from `src/acquisition/index.ts` lines 59–65):
```typescript
logger.error({
  stage: "acquire",
  status: "fail",
  leadId,
  message: `Errored: ${String(err)}`,
});
```
For truncation warning use `logger.warn` with fields `{ stage, status, leadId, message }` — same shape.

**Full file structure** (new pattern from RESEARCH.md Pattern 4):
```typescript
import type { ManufacturerPage } from "@/db/schema";

const PAGE_PRIORITY: Record<string, number> = {
  products: 0,
  about: 1,
  homepage: 2,
  other: 3,
};

export const CHAR_CAP = 350_000;

export interface BuildPromptResult {
  content: string;
  droppedChars: number;
}

export function buildPrompt(pages: ManufacturerPage[]): BuildPromptResult {
  const sorted = [...pages].sort(
    (a, b) => (PAGE_PRIORITY[a.pageType] ?? 3) - (PAGE_PRIORITY[b.pageType] ?? 3),
  );

  let combined = "";
  let droppedChars = 0;

  for (const page of sorted) {
    const section = `## [Page Type: ${page.pageType}] ##\n\n${page.markdownContent}\n\n`;
    if (combined.length + section.length > CHAR_CAP) {
      droppedChars += section.length;
      continue;
    }
    combined += section;
  }

  return { content: combined, droppedChars };
}
```

---

### `src/extraction/extract-profile.ts` (service — CREATE)

**Analog:** `src/acquisition/index.ts` (full file — orchestration function pattern)

This file contains the system prompt constant and the `extractProfile` function that wraps the instructor call. It is called by `src/extraction/index.ts` (the job handler) rather than being the job handler itself. This separation keeps the job handler thin (matching `src/acquisition/index.ts` structure) while allowing `extractProfile` to be testable in isolation.

**Import pattern** (from `src/acquisition/index.ts` lines 1–3):
```typescript
import { crawlManufacturerSite } from "@/acquisition/site-crawler";
import { writePage, updateLeadStatus } from "@/acquisition/page-writer";
import { logger } from "@/lib/logger";
```
Mirror with extraction equivalents:
```typescript
import { openAIInstructor } from "@/extraction/instructor-client";
import { buildPrompt } from "@/extraction/build-prompt";
import { ManufacturerExtractionSchema, type ManufacturerExtraction } from "@/schemas/extraction";
import { logger } from "@/lib/logger";
import type { ManufacturerPage } from "@/db/schema";
```

**System prompt** — inline constant (per RESEARCH.md Open Question 3 recommendation):
```typescript
const EXTRACTION_SYSTEM_PROMPT = `You are a chemical industry data extraction specialist...
[normalization instructions for MT/year conversion]`;
```

**Instructor call pattern** (from RESEARCH.md Pattern 2):
```typescript
export async function extractProfile(
  leadId: number,
  pages: ManufacturerPage[],
): Promise<ManufacturerExtraction> {
  const { content, droppedChars } = buildPrompt(pages);

  if (droppedChars > 0) {
    logger.warn({
      stage: "extract",
      status: "skip",
      leadId,
      message: `Truncated ${droppedChars} chars to fit context window`,
    });
  }

  return openAIInstructor.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_model: { schema: ManufacturerExtractionSchema, name: "ManufacturerProfile" },
    max_retries: 2,
    temperature: 0,
  });
}
```

**ZodError catch pattern** (from RESEARCH.md Pitfall 1 — no existing analog):
```typescript
} catch (err) {
  const message = Array.isArray(err)
    ? (err as { message: string }[]).map((e) => e.message).join("; ")
    : String(err);
  throw new Error(message);
}
```

---

### `src/extraction/normalize-capacity.ts` (utility — CREATE)

**Analog:** `src/acquisition/types.ts` (pure function / pure data pattern — no side effects, no DB, no logger)

This file is a collection of pure helper functions. It has no direct analog in the codebase but follows the same pattern as `types.ts`: no imports from `@/db` or `@/lib`, exported pure functions only.

**Pattern to apply:** Single responsibility — only unit conversion logic. Accept raw string, return number or null. No logging, no DB.

```typescript
// Unit conversion constants for capacity normalization fallback
// (Primary normalization is done via LLM prompt instruction per RESEARCH.md Pattern 8)

export function kgPerYearToMt(kg: number): number {
  return kg / 1000;
}

export function mtPerMonthToYear(mt: number): number {
  return mt * 12;
}

// Indian numeric system helpers
export function lakhToNumber(lakhs: number): number {
  return lakhs * 100_000;
}

export function croreToNumber(crores: number): number {
  return crores * 10_000_000;
}
```

---

### `src/extraction/index.ts` (service — CREATE)

**Analog:** `src/acquisition/index.ts` (exact structural mirror)

**Full structural pattern** (from `src/acquisition/index.ts` lines 1–76):

```
1. Import domain functions + logger (no dotenv — run.ts handles env loading)
2. Export single async function runXxxJob({ leadId, ... })
3. Record startedAt = Date.now()
4. Execute pipeline steps with await
5. On success: logger.info with durationMs + summary counts
6. On error: try updateLeadStatus("Errored"), logger.error, re-throw
```

**Imports pattern** (mirror of `src/acquisition/index.ts` lines 1–3):
```typescript
import { db } from "@/db/index";
import {
  leads, manufacturerPages, manufacturerProfiles, products, contacts, locations,
} from "@/db/schema";
import { extractProfile } from "@/extraction/extract-profile";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import type { ExtractionJob } from "@/schemas/extraction";
```

**Job handler function** (mirrors `src/acquisition/index.ts` lines 5–76):
```typescript
export async function runExtractionJob({ leadId }: ExtractionJob): Promise<void> {
  const startedAt = Date.now();

  const pages = await db.select().from(manufacturerPages)
    .where(eq(manufacturerPages.leadId, leadId));

  if (pages.length === 0) {
    throw new Error(`No manufacturer_pages found for leadId=${leadId}`);
  }

  try {
    const extracted = await extractProfile(leadId, pages);

    await db.transaction(async (tx) => {
      const [profile] = await tx.insert(manufacturerProfiles)
        .values({
          leadId,
          industriesServed: extracted.industries_served,
          capacityMtPerYear: extracted.capacity.value_mt_per_year,
          capacityRawText: extracted.capacity.raw_text,
        })
        .onConflictDoUpdate({
          target: manufacturerProfiles.leadId,
          set: { extractedAt: new Date() },
        })
        .returning({ id: manufacturerProfiles.id });

      // Delete existing child rows for idempotent re-runs
      await tx.delete(products).where(eq(products.profileId, profile.id));
      await tx.delete(contacts).where(eq(contacts.profileId, profile.id));
      await tx.delete(locations).where(eq(locations.profileId, profile.id));

      if (extracted.products.length > 0) {
        await tx.insert(products).values(
          extracted.products.map((p) => ({ profileId: profile.id, ...p })),
        );
      }
      if (extracted.contacts.length > 0) {
        await tx.insert(contacts).values(
          extracted.contacts.map((c) => ({ profileId: profile.id, ...c })),
        );
      }
      if (extracted.locations.length > 0) {
        await tx.insert(locations).values(
          extracted.locations.map((l) => ({ profileId: profile.id, ...l })),
        );
      }

      await tx.update(leads).set({ status: "Extracted" }).where(eq(leads.id, leadId));
    });

    logger.info({
      stage: "extract",
      status: "ok",
      leadId,
      durationMs: Date.now() - startedAt,
      message: `Extracted ${extracted.products.length} products, ${extracted.contacts.length} contacts`,
    });
  } catch (err) {
    // Mirror exact pattern from src/acquisition/index.ts lines 51-75
    try {
      await db.update(leads).set({ status: "Errored" }).where(eq(leads.id, leadId));
    } catch (statusErr) {
      logger.error({
        stage: "extract",
        status: "fail",
        leadId,
        message: `Failed to mark lead as Errored: ${String(statusErr)}`,
      });
    }

    logger.error({
      stage: "extract",
      status: "fail",
      leadId,
      message: `Errored: ${String(err)}`,
    });

    throw err;
  }
}
```

**Key differences from acquisition pattern:**
- Uses `db.transaction()` for atomic multi-table write (no equivalent in acquisition)
- `onConflictDoUpdate` on `manufacturerProfiles` for idempotency (per RESEARCH.md Open Question 2)
- Deletes child rows before re-inserting (idempotent re-run safety)

---

### `src/workers/extraction.worker.ts` (worker — CREATE)

**Analog:** `src/workers/acquisition.worker.ts` (exact structural mirror — lines 1–39)

**Full file** — copy `acquisition.worker.ts` and make these four substitutions:

| Find | Replace |
|------|---------|
| `acquisitionWorker` | `extractionWorker` |
| `"acquisition"` (queue name string) | `"extraction"` |
| `runAcquisitionJob` | `runExtractionJob` |
| `AcquisitionJobSchema` | `ExtractionJobSchema` |
| `concurrency: 3` | `concurrency: 5` |

**Imports pattern** (from `src/workers/acquisition.worker.ts` lines 1–6):
```typescript
import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { runAcquisitionJob } from "@/acquisition/index";
import { AcquisitionJobSchema } from "@/acquisition/types";
import { logger } from "@/lib/logger";
```
Becomes:
```typescript
import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { runExtractionJob } from "@/extraction/index";
import { ExtractionJobSchema } from "@/schemas/extraction";
import { logger } from "@/lib/logger";
```

**Worker instantiation pattern** (from `src/workers/acquisition.worker.ts` lines 8–21):
```typescript
export const acquisitionWorker = new Worker(
  "acquisition",
  async (job: Job) => {
    const parsed = AcquisitionJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new Error(`Invalid job data for job ${job.id}: ${parsed.error.message}`);
    }
    await runAcquisitionJob(parsed.data);
  },
  {
    connection: createRedisConnection(),
    concurrency: 3,
  },
);
```

**Event listener pattern** (from `src/workers/acquisition.worker.ts` lines 23–39):
```typescript
acquisitionWorker.on("completed", (job: Job) => {
  logger.info({
    stage: "worker",
    status: "ok",
    leadId: job.data.leadId,
    message: `Job ${job.id} completed`,
  });
});

acquisitionWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error({
    stage: "worker",
    status: "fail",
    leadId: job?.data?.leadId,
    message: `Job ${job?.id} failed: ${err.message}`,
  });
});
```

---

### `src/workers/queues.ts` (config — MODIFY)

**Analog:** `src/workers/queues.ts` (the file itself — additive extension)

**Existing pattern** (lines 1–8 — copy exactly):
```typescript
import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

// Queue name "acquisition" — must match the Worker name in src/workers/acquisition.worker.ts
// Each Queue must have its own IORedis connection (BullMQ requirement — see src/lib/redis.ts).
export const acquisitionQueue = new Queue("acquisition", {
  connection: createRedisConnection(),
});
```

**Add below the existing block:**
```typescript
// Queue name "extraction" — must match the Worker name in src/workers/extraction.worker.ts
// Separate IORedis connection required (BullMQ blocking mode constraint).
export const extractionQueue = new Queue("extraction", {
  connection: createRedisConnection(),
});
```

Note: `src/workers/index.ts` must also be updated to import and start `extractionWorker` alongside `acquisitionWorker` (see Shared Patterns below).

---

### `src/extraction/run.ts` (utility/cli — CREATE)

**Analog:** `src/acquisition/run.ts` (exact structural mirror — lines 1–74)

**Dotenv pattern** (from `src/acquisition/run.ts` lines 1–3):
```typescript
// MUST be the very first import — loads DATABASE_URL and REDIS_URL before singletons initialize
import { config } from "dotenv";
config({ path: ".env.local" });
```
The npm script for extraction uses `node --env-file=.env.local` (per Phase 3 Pitfall 6 lesson), so the `dotenv` import in `run.ts` is a belt-and-suspenders approach. Apply the same pattern from `acquisition/run.ts` — it matches what the codebase already does.

**Import pattern** (from `src/acquisition/run.ts` lines 7–11):
```typescript
import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { acquisitionQueue } from "@/workers/queues";
import { logger } from "@/lib/logger";
import { and, eq, lt } from "drizzle-orm";
```
Becomes:
```typescript
import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { extractionQueue } from "@/workers/queues";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
```
Note: No stale-reconciliation needed for extraction (unlike acquisition which has a "Processing" interim state). Only query `status = "Crawled"`.

**Query pattern** (from `src/acquisition/run.ts` lines 33–41):
```typescript
const newLeads = await db
  .select({ id: leads.id, url: leads.url })
  .from(leads)
  .where(eq(leads.status, "New"));

if (newLeads.length === 0) {
  logger.info({ stage: "acquire", status: "ok", message: "No New leads to enqueue" });
  await acquisitionQueue.close();
  return;
}
```
Becomes (extraction only needs `id`, not `url`):
```typescript
const crawledLeads = await db
  .select({ id: leads.id })
  .from(leads)
  .where(eq(leads.status, "Crawled"));

if (crawledLeads.length === 0) {
  logger.info({ stage: "extract", status: "ok", message: "No Crawled leads to enqueue" });
  await extractionQueue.close();
  return;
}
```

**Bulk-enqueue pattern** (from `src/acquisition/run.ts` lines 52–66):
```typescript
await acquisitionQueue.addBulk(
  validLeads.map((lead) => ({
    name: "acquire",
    data: { leadId: lead.id, url: lead.url },
  })),
);

logger.info({
  stage: "acquire",
  status: "ok",
  message: `Enqueued ${validLeads.length} acquisition jobs`,
});

await acquisitionQueue.close();
```
Becomes:
```typescript
await extractionQueue.addBulk(
  crawledLeads.map((lead) => ({
    name: "extract",
    data: { leadId: lead.id },
  })),
);

logger.info({
  stage: "extract",
  status: "ok",
  message: `Enqueued ${crawledLeads.length} extraction jobs`,
});

await extractionQueue.close();
```

**Main wrapper pattern** (from `src/acquisition/run.ts` lines 71–74):
```typescript
main().catch((err) => {
  logger.error({ stage: "acquire", status: "fail", message: `Fatal: ${String(err)}` });
  process.exit(1);
});
```

---

## Shared Patterns

### Structured Logger Shape
**Source:** `src/lib/logger.ts` (lines 1–33)
**Apply to:** All files in `src/extraction/`

The `LeadLogContext` interface defines all log call shapes:
```typescript
export interface LeadLogContext {
  leadId?: number;
  stage: string;
  status: "ok" | "skip" | "fail" | "start";
  durationMs?: number;
  message?: string;
  errorCount?: number;
}
```
Phase 4 log calls must use `stage: "extract"` (not `"acquire"`) and conform to this interface. Add `model` and `tokensUsed` via the `message` string field — do not extend the interface (avoids breaking the shared contract).

### Redis Connection (Never Share)
**Source:** `src/lib/redis.ts` (lines 9–18)
**Apply to:** `src/workers/extraction.worker.ts`, `src/workers/queues.ts` (new `extractionQueue`)

Always call `createRedisConnection()` — never import a shared IORedis instance. The comment on lines 14–17 is authoritative:
```typescript
// Each Queue and Worker MUST use a separate IORedis connection — BullMQ workers
// use SUBSCRIBE/BLPOP which puts the connection into blocking mode, making it
// unusable for normal Queue commands. Always call createRedisConnection() rather
// than sharing a single instance.
```

### `@/` Path Aliases
**Source:** All existing source files
**Apply to:** All new Phase 4 files

Every import of project code uses `@/` prefix. No relative paths (`./` or `../`) in `src/`. Verified in all three analog files:
- `src/workers/acquisition.worker.ts` line 3: `import { createRedisConnection } from "@/lib/redis";`
- `src/acquisition/index.ts` line 1: `import { crawlManufacturerSite } from "@/acquisition/site-crawler";`
- `src/acquisition/run.ts` line 7: `import { db } from "@/db/index";`

### Re-throw After Error Logging
**Source:** `src/acquisition/index.ts` (lines 71–75)
**Apply to:** `src/extraction/index.ts`

```typescript
// MUST re-throw so BullMQ records the job as failed and does NOT mark it completed
throw err;
```
This comment documents a BullMQ contract. Always re-throw from job handlers after error logging — never swallow.

### `void shutdown()` SIGTERM Pattern
**Source:** `src/workers/index.ts` (lines 11–19)
**Apply to:** `src/workers/index.ts` (MODIFY — add extraction worker)

```typescript
async function shutdown(): Promise<void> {
  logger.info({ stage: "worker", status: "ok", message: "Shutting down worker..." });
  await acquisitionWorker.close();
  logger.info({ stage: "worker", status: "ok", message: "Worker shut down cleanly" });
  process.exit(0);
}

process.on("SIGTERM", () => { void shutdown(); });
process.on("SIGINT", () => { void shutdown(); });
```
When adding `extractionWorker`, the `shutdown()` function must `await extractionWorker.close()` alongside `acquisitionWorker.close()` — close both before `process.exit(0)`.

### Dotenv-First Entry Point
**Source:** `src/acquisition/run.ts` (lines 1–3) and `src/workers/index.ts` (lines 1–3)
**Apply to:** `src/extraction/run.ts`

```typescript
// MUST be the very first import — loads DATABASE_URL and REDIS_URL before singletons initialize
import { config } from "dotenv";
config({ path: ".env.local" });
```
This pattern must appear before any `@/db` or `@/lib` imports in every entry point.

### Drizzle Type Exports
**Source:** `src/db/schema.ts` (lines 29–35, 57–60)
**Apply to:** `src/db/schema.ts` (new table type exports)

```typescript
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
```
Every new table must export both `$inferSelect` (for query return types) and `$inferInsert` (for insert payload types).

---

## No Analog Found

No files in Phase 4 are entirely without analog. All files map to existing codebase patterns. The closest "partial" matches are:

| File | Gap | Resolution |
|------|-----|------------|
| `src/extraction/instructor-client.ts` | No LLM client pattern exists | Use `src/lib/redis.ts` singleton pattern + RESEARCH.md Pattern 1 verbatim |
| `src/extraction/build-prompt.ts` | No text assembly function exists | Use data-assembly guard pattern from `src/acquisition/index.ts` + RESEARCH.md Pattern 4 |
| `src/extraction/normalize-capacity.ts` | No unit conversion pattern exists | Pure function module — no imports from `@/`, no side effects; RESEARCH.md Pattern 8 normalization rules |
| `src/schemas/extraction.ts` | No multi-object Zod schema exists (only simple flat schemas) | Extend `src/acquisition/types.ts` pattern + RESEARCH.md Pattern 3 verbatim |

---

## Metadata

**Analog search scope:** `src/workers/`, `src/acquisition/`, `src/schemas/`, `src/lib/`, `src/db/`
**Files read:** 10 source files + CONTEXT.md + RESEARCH.md + STRUCTURE.md
**Pattern extraction date:** 2026-04-27
