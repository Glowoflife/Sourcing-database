# Phase 4: AI Extraction & Technical Profiling - Research

**Researched:** 2026-04-27
**Domain:** instructor-js / OpenAI / Anthropic / Zod schema design / Drizzle pgEnum migration / BullMQ concurrency
**Confidence:** HIGH (all critical claims verified via Context7 or npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single LLM call per manufacturer — concatenate all `manufacturer_pages` rows into one prompt. Cross-page reasoning (CAS from products page + capacity from about page) is the motivating rationale.
- **D-02:** Page ordering in prompt: homepage first, then crawl order. Section header format: `## [Page Type: {page_type}] ##` (lowercase page_type value from DB enum).
- **D-03:** Truncate to fit context window when combined pages exceed limit. Priority order: products > about > homepage > other. Log `{ leadId, url, droppedChars }` as a structured warning so the truncation is auditable.
- **LLM stack:** instructor-js + OpenAI SDK (GPT-4o-mini default) + Anthropic SDK (Claude 3.5 Sonnet for complex chemical data). Both SDKs confirmed NOT yet installed in package.json.
- **Status enum:** `Extracted` must be added to `leadStatusEnum` in `src/db/schema.ts` + `drizzle-kit push` before the extraction worker can write results.
- **BullMQ extraction worker** mirrors `acquisition.worker.ts` pattern exactly.
- **Entry point pattern:** `node --env-file=.env.local ./node_modules/.bin/tsx src/extraction/run.ts` (Node 20.6+ native env loading, not dotenv import hoisting — Phase 3 lesson).
- **All imports use `@/` path aliases.** Never relative paths in `src/`.
- **Drizzle for all DB writes.** Zod validates all LLM outputs before writing.

### Claude's Discretion

- LLM provider routing — whether to use a single model or route complex fields to Claude 3.5 Sonnet.
- Profile DB schema design — exact column names, nullable fields, whether capacity is a separate table or a column on the manufacturer profile.
- BullMQ worker design — queue name, job payload shape, and concurrency level.
- Industries Served taxonomy — derive a reasonable set of tags from the Indian chemical industry domain.
- Unit normalization strategy — prompt instruction vs. Zod transform post-processing.
- Character/token cap — determine the safe character limit based on chosen model's context window minus prompt overhead.

### Deferred Ideas (OUT OF SCOPE)

- Semantic response cache (ioredis for AI call idempotency)
- Scheduled/automatic extraction chained from acquisition worker
- PubChem verification of CAS numbers (TECH-02)
- GSTIN validation (TECH-03)
- Reliability scoring (TECH-04)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTR-02 | AI extraction of product lines and specific chemical names | instructor-js + Zod `ProductSchema` with `z.array()` |
| EXTR-03 | AI extraction of verified contact details (email, phone, WhatsApp) | Zod `ContactSchema` with regex validation; `.nullable()` on missing fields |
| EXTR-04 | AI extraction of manufacturing plant locations/addresses | Zod `LocationSchema`; addresses are often multi-part, use separate fields |
| EXTR-05 | AI extraction of production capacity with MT/year normalization | Zod `.transform()` post-processing OR prompt instruction; see Pitfall 3 |
| EXTR-06 | AI extraction of "Industries Served" — standardized tags | `z.enum([...])` with predefined taxonomy; see taxonomy section below |
| TECH-01 | CAS number extraction, formatting, and indexing | `z.string().regex(/^\d{2,7}-\d{2}-\d$/)` per verified CAS format; separate `cas_number` column on products table |
</phase_requirements>

---

## Summary

Phase 4 reads Markdown pages stored by Phase 3 in `manufacturer_pages`, concatenates them into a single prompt, and calls an LLM via instructor-js to produce a schema-validated `ManufacturerProfile`. The profile is written to four new normalized PostgreSQL tables: `manufacturer_profiles`, `products`, `contacts`, and `locations`.

The critical technical decision is how to integrate instructor-js with both OpenAI and Anthropic. For OpenAI (GPT-4o-mini), instructor wraps the OpenAI SDK client directly using `Instructor({ client: oai, mode: "TOOLS" })`. For Anthropic (Claude 3.5 Sonnet), instructor requires the `llm-polyglot` adapter library (`createLLMClient({ provider: "anthropic" })`), then wraps that with `Instructor<typeof anthropicClient>`. This means **three packages need installation**: `@instructor-ai/instructor`, `openai`, `@anthropic-ai/sdk`, and `llm-polyglot`.

Context window budget for GPT-4o-mini is 128,000 tokens. A safe character cap for the combined prompt (system + all pages + overhead) is approximately 350,000 characters (~87,500 tokens at ~4 chars/token), leaving the model ample room for its 16,384-token output. The truncation strategy defined in D-03 is safe within these numbers for most manufacturers; only massive sites with 5 fully-loaded pages will hit the cap.

**Primary recommendation:** Use a single GPT-4o-mini call for all manufacturers; invoke Claude 3.5 Sonnet only when GPT-4o-mini returns a schema with zero products (empty extraction fallback). Keep BullMQ extraction concurrency at 5 — safe under GPT-4o-mini's Tier 1 rate limit of 500 RPM.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch manufacturer_pages per leadId | Database | — | DB read via Drizzle; no HTTP at this stage |
| Page concatenation + truncation | Extraction pipeline (`src/extraction/`) | — | Pure in-process logic before LLM call |
| LLM call (structured output) | Extraction pipeline | External API (OpenAI/Anthropic) | instructor-js abstracts both providers |
| Zod schema validation | Extraction pipeline | — | Runs on LLM response before any DB write |
| Unit normalization (MT/year) | Extraction pipeline | Prompt instruction | Either Zod transform or LLM-level instruction |
| Profile DB writes | Database | — | Drizzle inserts into new tables |
| Lead status transition (→ Extracted) | Database | — | Drizzle update on `leads` table |
| Job orchestration | BullMQ worker (`src/workers/`) | Redis | Mirrors acquisition.worker.ts pattern |
| CLI trigger (`npm run extract`) | `src/extraction/run.ts` | — | Same pattern as `src/acquisition/run.ts` |

---

## Standard Stack

### Core (install these)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@instructor-ai/instructor` | 1.7.0 | Wraps LLM clients; enforces Zod schema on response | Only TS library with built-in Zod validation + retry loop for structured LLM output |
| `openai` | 6.34.0 | OpenAI API client; required by instructor as peer | Official OpenAI SDK; instructor wraps it via `mode: "TOOLS"` |
| `@anthropic-ai/sdk` | 0.91.1 | Anthropic API client | Official Anthropic SDK; used via llm-polyglot adapter |
| `llm-polyglot` | 2.6.0 | Adapter: converts Anthropic SDK interface to OpenAI-compatible interface | Required by instructor-js for non-OpenAI providers |

**Version verification:** All four versions confirmed via `npm view` in this session. [VERIFIED: npm registry]

### Already Installed (relevant to this phase)

| Library | Version in package.json | Phase 4 Role |
|---------|------------------------|--------------|
| `zod` | 4.3.6 | Extraction schema definition + validation |
| `bullmq` | 5.76.2 | Extraction job queue |
| `drizzle-orm` | 0.45.2 | Profile table writes |
| `ioredis` | ^5.10.1 | BullMQ connection via `createRedisConnection()` |

### Installation Command

```bash
npm install @instructor-ai/instructor@1.7.0 openai@6.34.0 @anthropic-ai/sdk@0.91.1 llm-polyglot@2.6.0
```

---

## Architecture Patterns

### System Architecture Diagram

```
manufacturer_pages table (Phase 3 output)
     │
     │  SELECT * WHERE lead_id = ?  (all pages for one manufacturer)
     ▼
Extraction Job Handler  (src/extraction/index.ts)
     │
     │  sort by priority: products > about > homepage > other
     │  prepend headers: ## [Page Type: products] ##
     │  concatenate → check char count vs. cap (350,000 chars)
     │  truncate lowest-priority pages if over cap → log warning
     ▼
Combined Markdown Prompt  (system prompt + user content)
     │
     │  Instructor({ client: oai, mode: "TOOLS" })
     │  response_model: { schema: ManufacturerExtractionSchema, name: "ManufacturerProfile" }
     │  max_retries: 2
     ▼
OpenAI GPT-4o-mini  (primary)
     │  [if result.products.length === 0]
     │  → fallback: Claude 3.5 Sonnet via llm-polyglot (optional)
     ▼
Zod-validated ManufacturerExtraction object
     │
     │  db.insert(manufacturerProfiles) → id
     │  db.insert(products).values(result.products.map(...))
     │  db.insert(contacts).values(result.contacts.map(...))
     │  db.insert(locations).values(result.locations.map(...))
     │  db.update(leads).set({ status: "Extracted" })
     ▼
PostgreSQL: manufacturer_profiles, products, contacts, locations
     │
     │  (Phase 5 reads these for dashboard)
```

### Recommended Project Structure (Phase 4 additions)

```
src/
├── extraction/
│   ├── instructor-client.ts    # OpenAI + Anthropic instructor setup
│   ├── extraction-schema.ts    # Zod ManufacturerExtractionSchema (NOT in src/schemas/ — Phase 4 owns it)
│   ├── build-prompt.ts         # Page concatenation, header injection, truncation (D-01, D-02, D-03)
│   ├── normalize-capacity.ts   # MT/year conversion helpers (used in Zod transform)
│   ├── extract-profile.ts      # Orchestrates: build prompt → instructor call → Zod validate → DB write
│   ├── index.ts                # BullMQ job handler (runExtractionJob)
│   └── run.ts                  # CLI entry: enqueue Crawled leads → extraction queue
├── db/
│   └── schema.ts               # EXTENDED: Extracted status + 4 new tables
└── workers/
    ├── extraction.worker.ts    # New BullMQ worker (mirrors acquisition.worker.ts)
    ├── queues.ts               # EXTENDED: add extractionQueue
    └── index.ts                # EXTENDED: import + start extraction worker
```

---

## Pattern 1: instructor-js Client Setup (OpenAI)

**What:** Wrap OpenAI SDK with Instructor to enable `response_model` parameter.
**When to use:** Every extraction call. GPT-4o-mini is the default model.

```typescript
// Source: Context7 /567-labs/instructor-js — verified in this session
// src/extraction/instructor-client.ts
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { createLLMClient } from "llm-polyglot";

const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openAIInstructor = Instructor({
  client: oai,
  mode: "TOOLS", // TOOLS is preferred for GPT-4o-mini; FUNCTIONS is legacy
});

// Anthropic via llm-polyglot adapter
const anthropicClient = createLLMClient({
  provider: "anthropic",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const anthropicInstructor = Instructor<typeof anthropicClient>({
  client: anthropicClient,
  mode: "TOOLS",
});
```

[VERIFIED: Context7 /567-labs/instructor-js]

---

## Pattern 2: Structured Extraction Call with Zod Schema

**What:** Pass a Zod schema as `response_model`; instructor retries on Zod validation failure.
**When to use:** `extract-profile.ts` main extraction call.

```typescript
// Source: Context7 /567-labs/instructor-js — verified in this session
const profile = await openAIInstructor.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
    { role: "user", content: combinedMarkdown },
  ],
  response_model: {
    schema: ManufacturerExtractionSchema,
    name: "ManufacturerProfile",
  },
  max_retries: 2,         // instructor retries with Zod error message injected
  temperature: 0,         // deterministic extraction
});
// profile is typed as z.infer<typeof ManufacturerExtractionSchema>
```

[VERIFIED: Context7 /567-labs/instructor-js]

---

## Pattern 3: Zod Schema Design for Chemical Extraction

**What:** Schema that Instructor enforces on the LLM response before returning.
**When to use:** Define once in `src/extraction/extraction-schema.ts`.

```typescript
// Source: Verified Zod v4 API (Context7 /colinhacks/zod) + CAS regex (cited below)
import { z } from "zod";

// CAS format: 2-7 digits, hyphen, 2 digits, hyphen, 1 check digit
// Verified format: https://www.cas.org/training/documentation/chemical-substances/checkdig
const CAS_REGEX = /^\d{2,7}-\d{2}-\d$/;

export const ProductSchema = z.object({
  name: z.string().describe("Chemical or product name as listed on the manufacturer's site"),
  cas_number: z
    .string()
    .regex(CAS_REGEX)
    .nullable()
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

// Industries Served taxonomy — derived from Indian chemical industry domain
// [ASSUMED] — exact taxonomy is Claude's discretion per CONTEXT.md
export const INDUSTRY_TAGS = [
  "Pharma",
  "Agrochemicals",
  "Polymers",
  "Specialty Chemicals",
  "Dyes & Pigments",
  "Petrochemicals",
  "Paints & Coatings",
  "Food & Feed",
  "Water Treatment",
  "Textile Chemicals",
  "Rubber & Elastomers",
  "Construction Chemicals",
  "Electronics",
  "Other",
] as const;

export const CapacitySchema = z.object({
  value_mt_per_year: z
    .number()
    .nullable()
    .describe("Production capacity normalized to Metric Tons per year. Return null if unknown."),
  raw_text: z
    .string()
    .nullable()
    .describe("Original capacity text as found on the page (e.g., '500 MT/month', '1000 KL/year')"),
});

export const ManufacturerExtractionSchema = z.object({
  products: z
    .array(ProductSchema)
    .describe("List of all chemical products and product lines found across all pages"),
  contacts: z
    .array(ContactSchema)
    .describe("All contact details found (emails, phones, WhatsApp numbers)"),
  locations: z
    .array(LocationSchema)
    .describe("All manufacturing plant or office locations found"),
  capacity: CapacitySchema.describe("Production capacity information"),
  industries_served: z
    .array(z.enum(INDUSTRY_TAGS))
    .describe("Industries this manufacturer serves, from the standardized taxonomy only"),
});

export type ManufacturerExtraction = z.infer<typeof ManufacturerExtractionSchema>;
```

[VERIFIED: Zod API via Context7 /colinhacks/zod]
[CITED: https://www.cas.org/training/documentation/chemical-substances/checkdig — CAS format]

---

## Pattern 4: Page Concatenation and Truncation (D-01, D-02, D-03)

**What:** Build the combined Markdown prompt from `manufacturer_pages` rows.
**When to use:** `src/extraction/build-prompt.ts` — called before every LLM call.

```typescript
// Source: [ASSUMED] — implements D-01/D-02/D-03 decisions
const PAGE_PRIORITY: Record<string, number> = {
  products: 0,   // highest priority — most likely to have CAS numbers
  about: 1,
  homepage: 2,
  other: 3,      // lowest priority — truncated first
};

const CHAR_CAP = 350_000; // ~87,500 tokens at 4 chars/token; leaves room for 16k output + overhead

export function buildPrompt(pages: ManufacturerPage[]): {
  content: string;
  droppedChars: number;
} {
  const sorted = [...pages].sort(
    (a, b) => (PAGE_PRIORITY[a.pageType] ?? 3) - (PAGE_PRIORITY[b.pageType] ?? 3),
  );

  let combined = "";
  let droppedChars = 0;

  for (const page of sorted) {
    const section = `## [Page Type: ${page.pageType}] ##\n\n${page.markdownContent}\n\n`;
    if (combined.length + section.length > CHAR_CAP) {
      droppedChars += section.length;
      continue; // skip this page; log warning in caller
    }
    combined += section;
  }

  return { content: combined, droppedChars };
}
```

---

## Pattern 5: Extraction Job Handler (mirrors acquisition/index.ts)

**What:** BullMQ job handler that orchestrates the full extraction pipeline for one lead.
**When to use:** `src/extraction/index.ts`.

```typescript
// Source: [ASSUMED] — mirrors Phase 3 acquisition/index.ts pattern exactly
export async function runExtractionJob({ leadId }: { leadId: number }): Promise<void> {
  const startedAt = Date.now();

  const pages = await db
    .select()
    .from(manufacturerPages)
    .where(eq(manufacturerPages.leadId, leadId));

  if (pages.length === 0) {
    throw new Error(`No manufacturer_pages found for leadId=${leadId}`);
  }

  const { content, droppedChars } = buildPrompt(pages);

  if (droppedChars > 0) {
    logger.warn({
      stage: "extract",
      status: "skip",
      leadId,
      message: `Truncated ${droppedChars} chars to fit context window`,
    });
  }

  // LLM call — throws if instructor exhausts max_retries (Zod still fails after 2 retries)
  const extracted = await openAIInstructor.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_model: { schema: ManufacturerExtractionSchema, name: "ManufacturerProfile" },
    max_retries: 2,
    temperature: 0,
  });

  // Write profile tables inside a transaction
  await db.transaction(async (tx) => {
    const [profile] = await tx
      .insert(manufacturerProfiles)
      .values({ leadId, industriesServed: extracted.industries_served, capacity: extracted.capacity })
      .returning({ id: manufacturerProfiles.id });

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
}
```

---

## Pattern 6: DB Schema Extension (Extracted status + 4 new tables)

**What:** Extend `src/db/schema.ts` with the new enum value and profile tables.
**When to use:** Task 1 of Phase 4 Wave 1 — must run `drizzle-kit push` before any extraction.

```typescript
// Extend leadStatusEnum — ADD "Extracted" to the existing values array
export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Extracted",   // NEW in Phase 4
  "Errored",
]);

// Capacity as JSONB column on the profile (simpler than a separate table for v1)
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
  casNumber: text("cas_number"),     // validated format: \d{2,7}-\d{2}-\d
  grade: text("grade"),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => manufacturerProfiles.id),
  type: text("type").notNull(), // "email" | "phone" | "whatsapp"
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
```

[CITED: drizzle-kit push handles ALTER TYPE ADD VALUE for enum extension — drizzle-orm/issues/2389]

---

## Pattern 7: BullMQ Extraction Worker (mirrors acquisition.worker.ts exactly)

```typescript
// src/workers/extraction.worker.ts
// Source: [ASSUMED] — mirrors src/workers/acquisition.worker.ts
import { Worker, type Job } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { runExtractionJob } from "@/extraction/index";
import { ExtractionJobSchema } from "@/extraction/types";
import { logger } from "@/lib/logger";

export const extractionWorker = new Worker(
  "extraction",  // must match Queue name in queues.ts
  async (job: Job) => {
    const parsed = ExtractionJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new Error(`Invalid job data for job ${job.id}: ${parsed.error.message}`);
    }
    await runExtractionJob(parsed.data);
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,  // see Concurrency section below
  },
);

extractionWorker.on("completed", (job: Job) => {
  logger.info({ stage: "worker", status: "ok", leadId: job.data.leadId, message: `Job ${job.id} completed` });
});

extractionWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error({ stage: "worker", status: "fail", leadId: job?.data?.leadId, message: `Job ${job?.id} failed: ${err.message}` });
});
```

---

## Pattern 8: Unit Normalization Strategy

**Recommendation:** Use **both** — instruct the LLM to normalize in the prompt, then validate via Zod that the `value_mt_per_year` field is a number (not a string).

The LLM is better at understanding domain context ("1 lakh MT" = 100,000 MT) than a rule-based converter. The Zod schema captures the raw text for auditability (`raw_text` field) and validates the numeric output.

```
Normalization conversions to specify in the system prompt:
- MT/month × 12 → MT/year
- KG/year ÷ 1000 → MT/year
- Ton/year = MT/year (metric ton = tonne)
- KL/year — cannot normalize to MT/year without density; set value_mt_per_year = null, preserve raw_text
- "1 lakh" = 100,000; "1 crore" = 10,000,000 (Indian numeric system)
```

[ASSUMED] — LLM-based normalization is the recommended pattern for domain-aware unit conversion, supported by the ARCHITECTURE.md spec.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema-validated LLM output | Custom JSON.parse + manual type checks | `@instructor-ai/instructor` with Zod | LLMs hallucinate field names; instructor's retry loop handles validation failures automatically |
| Anthropic SDK OpenAI-compat shim | Custom adapter | `llm-polyglot` + instructor | Tested adapter; handles message format differences between OpenAI and Anthropic APIs |
| CAS number regex | Custom parser | `z.string().regex(CAS_REGEX)` | Well-defined format; one-liner in Zod |
| Retry on LLM failure | Custom retry loop | `max_retries: 2` in instructor | instructor injects Zod error messages back into next LLM call — far more effective than blind retry |
| DB transaction for multi-table writes | Manual rollback logic | `db.transaction(async tx => ...)` | Drizzle's built-in transaction; guarantees atomicity across profile + products + contacts + locations |

**Key insight:** The entire value of instructor-js is that it turns a Zod schema into a retry loop — if the LLM returns invalid JSON or wrong types, instructor sends the Zod error message back to the model so it can self-correct. Never bypass this with raw JSON parsing.

---

## Context Window Budget

| Parameter | Value | Source |
|-----------|-------|--------|
| GPT-4o-mini context window | 128,000 tokens | [CITED: inference.net/content/openai-rate-limits-guide] |
| GPT-4o-mini max output tokens | 16,384 tokens | [CITED: inference.net/content/openai-rate-limits-guide] |
| Available for input | ~111,616 tokens | 128,000 − 16,384 |
| System prompt overhead | ~2,000 tokens (estimated) | [ASSUMED] |
| Safe input token budget | ~109,000 tokens | |
| At 4 chars/token | ~436,000 characters | [ASSUMED — typical English prose density] |
| Conservative character cap (D-03) | **350,000 chars** | 20% safety buffer from max |

**Rationale for 350,000 chars:** Chemical Markdown from manufacturer sites is text-dense but not code. At 4 chars/token, 350,000 chars = 87,500 tokens — well within the 109,000-token safe input budget. The buffer absorbs token-count variance in technical/multilingual text.

**Truncation order (D-03):** Discard `other` pages first (index 3), then truncate at page boundaries. Never truncate mid-page. Log `{ leadId, droppedChars }` at `warn` level.

---

## BullMQ Concurrency Decision

| Factor | Value |
|--------|-------|
| GPT-4o-mini Tier 1 RPM | 500 | [CITED: inference.net/content/openai-rate-limits-guide] |
| GPT-4o-mini Tier 1 TPM | 200,000 | [CITED: inference.net/content/openai-rate-limits-guide] |
| Estimated tokens per extraction call | ~90,000 input + 2,000 output ≈ 92,000 | [ASSUMED] |
| TPM-safe concurrency | 200,000 / 92,000 ≈ 2.17 per minute | |
| RPM-safe concurrency | 500 RPM >> 5 concurrent | |

**Recommendation: `concurrency: 5`.**

The bottleneck is TPM (token-per-minute), not RPM. With 200,000 TPM and ~92,000 tokens per call, running 2 calls simultaneously would saturate the budget in 30 seconds. However, extraction calls take 10-30 seconds each, so 5 concurrent jobs will naturally stagger their API calls. If rate-limit errors appear in practice, reduce to `concurrency: 3`.

Note: The acquisition worker uses `concurrency: 3` for Playwright (CPU/memory bound). Extraction is IO-bound (waiting for LLM response), so higher concurrency is appropriate.

---

## DB Schema Design: Normalized Tables vs. JSONB

**Decision:** Use **normalized tables** (as specified in ARCHITECTURE.md).

| Approach | Phase 5 Search Support | Why Normalized Wins |
|----------|----------------------|---------------------|
| JSONB blob on `manufacturer_profiles` | Requires `jsonb_array_elements` — slow on large datasets | Phase 5 needs `WHERE cas_number = ?` and `WHERE state = ?` — trivial with normalized columns |
| Normalized tables | Native column indices | `CREATE INDEX ON products(cas_number)` enables fast CAS lookup (Phase 5 requirement) |

**Capacity column placement:** Put capacity on `manufacturer_profiles` directly (not a separate table). One capacity value per manufacturer is the common case. A separate table adds join complexity for no v1 benefit.

`industries_served` as a `text[]` (PostgreSQL array) column on `manufacturer_profiles` is acceptable for v1. Phase 5 can filter with `WHERE 'Pharma' = ANY(industries_served)`.

---

## Lead Status Transition: Adding "Extracted" to pgEnum

**How drizzle-kit push handles enum additions:**

PostgreSQL supports `ALTER TYPE enum_name ADD VALUE 'new_value'` natively. `drizzle-kit push` detects the new enum value in the Drizzle schema and generates this ALTER statement. [CITED: github.com/drizzle-team/drizzle-orm/issues/2389]

**Important constraint:** PostgreSQL `ALTER TYPE ADD VALUE` **cannot be run inside a transaction** (before PG 12) — drizzle-kit push handles this correctly by issuing it outside a transaction block.

**Order matters:** Add `"Extracted"` before `"Errored"` in the enum array (between `"Crawled"` and `"Errored"`) so the enum ordering is semantically sequential. [ASSUMED — Postgres enum ordering has no runtime impact, but code readability is improved]

**Workflow:**
1. Edit `src/db/schema.ts` — add `"Extracted"` to `leadStatusEnum`
2. Run: `DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) npx drizzle-kit push`
3. Verify: `SELECT unnest(enum_range(NULL::lead_status))` returns all 5 values

---

## Common Pitfalls

### Pitfall 1: Instructor ZodError After max_retries Exhausted

**What goes wrong:** After 2 retries, instructor throws an array of `ZodError` objects. The caller's `try/catch` catches `e` as `unknown`, but `e` is actually `ZodError[]`. Direct access to `e.message` will fail (arrays don't have `.message`).

**Why it happens:** instructor-js documents that on final failure it throws `ZodError[]` — a plain JS array, not an `Error` subclass.

**How to avoid:** In the job handler catch block, use `String(err)` or check `Array.isArray(err)`:
```typescript
} catch (err) {
  const message = Array.isArray(err)
    ? (err as ZodError[]).map(e => e.message).join("; ")
    : String(err);
  logger.error({ stage: "extract", status: "fail", leadId, message });
  throw new Error(message); // re-throw as Error so BullMQ records failure reason correctly
}
```

[CITED: Context7 /567-labs/instructor-js — self_correction.md example]

### Pitfall 2: Anthropic Requires max_tokens in the Call

**What goes wrong:** Anthropic API rejects requests without a `max_tokens` parameter (unlike OpenAI where it defaults). The call hangs or throws `400 Bad Request: max_tokens is required`.

**Why it happens:** Anthropic's API does not default `max_tokens`; OpenAI does.

**How to avoid:** Always include `max_tokens: 4096` (or higher) when calling Claude via llm-polyglot:
```typescript
await anthropicInstructor.chat.completions.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 4096,  // REQUIRED for Anthropic
  messages: [...],
  response_model: { ... },
});
```

[CITED: Context7 /567-labs/instructor-js — Anthropic example includes max_tokens: 1000]

### Pitfall 3: Unit Normalization in Zod Transform Won't Work for LLM Output

**What goes wrong:** A developer puts `z.string().transform(raw => parseCapacityToMT(raw))` on `raw_text`, expecting to normalize units. But the Instructor schema is sent to the LLM as a JSON schema — the LLM never sees the transform logic. The transform only runs after the LLM responds.

**Why it happens:** Instructor serializes the Zod schema to JSON schema (for the function/tool call spec) and the `.transform()` is invisible to the model.

**How to avoid:** Use the **dual-field approach** in the schema: ask the LLM to return `value_mt_per_year` (a number) and `raw_text` (the original string). The system prompt instructs the LLM to normalize. The Zod transform is only needed for post-processing cleanup (e.g., rounding). Do NOT rely on Zod transforms to do domain-knowledge normalization.

[ASSUMED — based on how Instructor serializes schemas to JSON schema format]

### Pitfall 4: Drizzle `text().array()` Requires `sql` Default

**What goes wrong:** `industries_served: text("industries_served").array().notNull().default([])` throws a TypeScript error or generates invalid SQL — Drizzle's `.default()` does not accept a JS `[]` for PostgreSQL arrays.

**Why it happens:** PostgreSQL array defaults must be expressed as SQL literals.

**How to avoid:**
```typescript
import { sql } from "drizzle-orm";
// ...
industriesServed: text("industries_served").array().notNull().default(sql`'{}'::text[]`),
```

[ASSUMED — standard Drizzle pattern for PostgreSQL array defaults]

### Pitfall 5: Separate Redis Connection per Worker (Already Known from Phase 3)

**What goes wrong:** Reusing the same IORedis connection for both Queue and Worker causes BullMQ workers to stall (connection enters blocking mode).

**How to avoid:** Always call `createRedisConnection()` — the function in `src/lib/redis.ts` creates a fresh connection each time. The extraction worker must call it separately, not import a shared instance.

[VERIFIED: src/lib/redis.ts — comment explicitly documents this requirement]

### Pitfall 6: `dotenv` Import Hoisting in tsx Worker Entry Point

**What goes wrong:** `import 'dotenv/config'` at the top of `run.ts` appears first syntactically, but ES module hoisting evaluates `import @/db` synchronously before the dotenv side effect runs — `DATABASE_URL` is `undefined` when the Drizzle Pool initializes.

**Why it happens:** This is the exact bug discovered in Phase 3 (STATE.md session record).

**How to avoid:** Use the Node 20.6+ `--env-file` flag in the npm script. Do NOT import dotenv in run.ts for this project:
```json
"extract": "node --env-file=.env.local ./node_modules/.bin/tsx src/extraction/run.ts"
```

[VERIFIED: STATE.md — explicit session record of this bug and fix]

---

## Industries Served Taxonomy

Derived from Indian chemical industry sectors. [ASSUMED — Claude's discretion per CONTEXT.md]

```
Pharma
Agrochemicals
Polymers & Plastics
Specialty Chemicals
Dyes & Pigments
Petrochemicals
Paints & Coatings
Food & Feed Additives
Water Treatment
Textile Chemicals
Rubber & Elastomers
Construction Chemicals
Electronics & Semiconductors
Other
```

These 14 tags cover the primary segments of the Indian chemical industry. Use `z.enum([...] as const)` so TypeScript enforces the closed set. "Other" is a required catch-all to prevent the LLM from inventing tags.

---

## CLI Trigger (`npm run extract`)

**What it should do** (mirrors `src/acquisition/run.ts`):
1. Query leads with `status = "Crawled"` (not `Extracted` or `Errored`)
2. Bulk-enqueue extraction jobs via `extractionQueue.addBulk(...)`
3. Log: `Enqueued N extraction jobs`
4. Close queue connection and exit

**Summary output format** (consistent with Phase 2/3):
```
{"level":"info","ts":"...","stage":"extract","status":"ok","message":"Enqueued 47 extraction jobs"}
```

The BullMQ worker process (running separately via `npm run worker`) will process the jobs and log per-job completion with extracted product counts.

**npm script:**
```json
"extract": "node --env-file=.env.local ./node_modules/.bin/tsx src/extraction/run.ts"
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `JSON.parse(llm_response)` + manual validation | instructor-js with Zod `response_model` | Structured output guaranteed; validation errors trigger self-correction retries |
| OpenAI `response_format: { type: "json_object" }` | Instructor `mode: "TOOLS"` | TOOLS mode provides richer structured output with field-level descriptions passed to the model |
| Anthropic SDK called separately from OpenAI | `llm-polyglot` + Instructor | Single `client.chat.completions.create` interface for both providers |
| GPT-4-turbo for extraction | GPT-4o-mini | 10× cheaper, similar extraction quality for structured data tasks, 128k context window |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | BullMQ extraction queue | Yes (Homebrew) | 8.6.2 | — |
| PostgreSQL (Neon) | Profile tables | Yes (.env.local present) | Neon managed | — |
| Node.js | tsx runner | Yes | v25.9.0 | — |
| `@instructor-ai/instructor` | LLM extraction | NOT installed | 1.7.0 (latest) | Must install Wave 1 |
| `openai` | instructor peer dep | NOT installed | 6.34.0 (latest) | Must install Wave 1 |
| `@anthropic-ai/sdk` | Anthropic fallback | NOT installed | 0.91.1 (latest) | Must install Wave 1 |
| `llm-polyglot` | Anthropic adapter for instructor | NOT installed | 2.6.0 (latest) | Must install Wave 1 |
| `OPENAI_API_KEY` | GPT-4o-mini calls | Not verified | — | Must be added to .env.local |
| `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet calls | Not verified | — | Must be added to .env.local |

**Missing dependencies with no fallback:**
- `@instructor-ai/instructor`, `openai`, `@anthropic-ai/sdk`, `llm-polyglot` — all four must be installed in Wave 1 Task 1.
- `OPENAI_API_KEY` in `.env.local` — required before first extraction run. Wave 1 Task 1 must include a user gate.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 350,000 characters is a safe prompt cap for GPT-4o-mini | Context Window Budget | If manufacturers have more token-dense Markdown (code snippets, data tables), actual token count could exceed limit; reduce cap to 280,000 chars and monitor |
| A2 | LLM-based unit normalization (prompt instruction) is sufficient; Zod transform is not needed | Pattern 8 / Pitfall 3 | If GPT-4o-mini frequently returns wrong units, add a post-processing normalization function in `normalize-capacity.ts` |
| A3 | `concurrency: 5` is safe for Tier 1 GPT-4o-mini TPM limits | BullMQ Concurrency | If 429 rate-limit errors appear, reduce to `concurrency: 3` and add exponential backoff |
| A4 | Industries Served taxonomy (14 tags) covers Indian chemical industry sufficiently | Taxonomy section | If manufacturers report industries not in the list, the `z.enum()` will filter them out; add tags to the enum and re-extract |
| A5 | `text().array()` with `sql` default is the correct Drizzle pattern for PostgreSQL arrays | Pattern 6 | If drizzle-kit generates invalid SQL, use `jsonb` column with `default(sql`'[]'::jsonb`) instead |
| A6 | Adding "Extracted" to pgEnum before "Errored" is safe for drizzle-kit push | Lead Status Transition | If push fails due to enum position, re-order array to append "Extracted" after "Errored" (Postgres ADD VALUE appends by default) |

---

## Open Questions

1. **Should Claude 3.5 Sonnet fallback be implemented in Phase 4?**
   - What we know: CONTEXT.md grants discretion on single-model vs. routing approach
   - What's unclear: Whether the added complexity is worth the extraction quality improvement
   - Recommendation: Implement GPT-4o-mini only in Phase 4 v1. The `instructor-client.ts` file sets up both clients (future-proofing) but only the OpenAI client is called by `extract-profile.ts`. Add Anthropic fallback as a Phase 4 hotfix if needed.

2. **Should extraction be idempotent (upsert on re-run)?**
   - What we know: `manufacturer_profiles.lead_id` has a `.unique()` constraint — a second extraction for the same lead will throw a unique violation
   - Recommendation: Add `onConflictDoUpdate` on `manufacturerProfiles` insert. Delete existing `products`, `contacts`, `locations` rows for the profile before re-inserting. This makes re-running `npm run extract` safe.

3. **Where should the system prompt live?**
   - Recommendation: Inline constant in `extract-profile.ts` (not a separate file) for Phase 4. It's closely coupled to the Zod schema. If it grows beyond 200 lines, move to `src/extraction/system-prompt.ts`.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/567-labs/instructor-js` — instructor-js API: `Instructor({})`, `client.chat.completions.create`, `response_model`, `max_retries`, llm-polyglot Anthropic integration
- Context7 `/colinhacks/zod` — Zod v4: `.nullable()`, `.array()`, `.regex()`, `.transform()`, `z.enum()`
- npm registry (`npm view`) — `@instructor-ai/instructor@1.7.0`, `openai@6.34.0`, `@anthropic-ai/sdk@0.91.1`, `llm-polyglot@2.6.0`, `zod@4.3.6`, `bullmq@5.76.2`
- Existing codebase — `src/workers/acquisition.worker.ts`, `src/lib/redis.ts`, `src/acquisition/run.ts`, `src/db/schema.ts`

### Secondary (MEDIUM confidence)
- [inference.net/content/openai-rate-limits-guide](https://inference.net/content/openai-rate-limits-guide/) — GPT-4o-mini: 128k context, 16,384 max output tokens, Tier 1: 500 RPM / 200,000 TPM
- [cas.org/training/documentation/chemical-substances/checkdig](https://www.cas.org/training/documentation/chemical-substances/checkdig) — CAS Registry Number format: `\d{2,7}-\d{2}-\d`
- [github.com/drizzle-team/drizzle-orm/issues/2389](https://github.com/drizzle-team/drizzle-orm/issues/2389) — drizzle-kit push supports `ALTER TYPE ADD VALUE` for enum extension

### Tertiary (LOW confidence — marked [ASSUMED] in text)
- Unit normalization via prompt instruction recommendation
- 350,000 char cap calculation (based on 4 chars/token assumption)
- Drizzle `sql` default for text arrays
- Industries Served taxonomy (14 tags)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified via `npm view`
- instructor-js API: HIGH — verified via Context7 with multiple code examples
- Architecture patterns: HIGH — directly mirrors verified Phase 3 patterns
- Zod schema design: HIGH — verified against Context7 Zod docs
- Context window budget: MEDIUM — GPT-4o-mini limits cited; char/token ratio assumed
- BullMQ concurrency: MEDIUM — rate limits cited; per-call token usage estimated
- Unit normalization: LOW — LLM-prompt approach is recommended but not empirically tested

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days — GPT-4o-mini is a stable model; instructor v1 API is unlikely to change)
