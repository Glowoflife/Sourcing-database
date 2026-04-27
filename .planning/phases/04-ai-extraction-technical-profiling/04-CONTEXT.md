# Phase 4: AI Extraction & Technical Profiling - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers the extraction pipeline that reads `manufacturer_pages` Markdown rows produced by Phase 3, calls an LLM via `instructor-js` (schema-validated structured output), and writes normalized technical profiles to new DB tables. The output is a complete manufacturer profile covering: product lines and chemical names, CAS numbers, contact details (email, phone, WhatsApp), plant locations/addresses, production capacity (normalized to MT/year), and industries served (standardized tags).

**In scope:** Instructor + LLM client setup, Zod extraction schemas, prompt templates, unit normalization (capacity → MT/year), CAS number formatting, new DB tables + Drizzle migration + `drizzle-kit push`, BullMQ extraction worker, CLI trigger (`npm run extract`), lead status transition (`Crawled → Extracted / Errored`).

**Out of scope:** Dashboard/search UI (Phase 5), sourcing workflow (Phase 6), proxy rotation, scheduled extraction, PubChem verification (v2), GSTIN validation (v2), reliability scoring (v2).

</domain>

<decisions>
## Implementation Decisions

### Multi-Page Merge Strategy
- **D-01:** Concatenate all `manufacturer_pages` rows for a manufacturer into **a single LLM prompt** — one extraction call per manufacturer. This gives the LLM cross-page reasoning (e.g., CAS numbers on the products page combined with capacity on the about page).
- **D-02:** Page ordering in the concatenated prompt: **homepage first, then in crawl order** (preserving natural site structure). Each page is prepended with a section header `## [Page Type: {page_type}] ##` so the LLM can attribute data to the correct source page.
- **D-03:** When combined pages exceed the LLM context window, **truncate to fit** — prioritise pages by type (products > about > homepage > other), then truncate at the character limit that fits the model's context window. Log a structured warning `{ leadId, url, droppedChars }` so the issue is auditable.

### Claude's Discretion
- **LLM provider and model selection** — STACK.md specifies GPT-4o-mini (OpenAI) as the primary extraction model and Claude 3.5 Sonnet (Anthropic) for deep technical reasoning. Claude has discretion on whether to use a single model or route complex fields to the higher-capability model.
- **Profile DB schema design** — Architecture doc specifies normalized tables (Products, Chemicals/CAS, Contacts, Locations). Claude has discretion on exact column names, nullable fields, and whether capacity is a separate table or a column on the manufacturer profile.
- **BullMQ worker design** — Separate `extraction.worker.ts` following the same pattern as `acquisition.worker.ts`. Claude has discretion on queue name, job payload shape, and concurrency level.
- **Industries Served taxonomy** — EXTR-06 requires a standardized set of tags. Claude derives a reasonable taxonomy from the Indian chemical industry domain (e.g., Pharma, Agrochemicals, Polymers, Specialty Chemicals, Dyes & Pigments, Petrochemicals).
- **Unit normalization logic** — Production capacity normalization to MT/year can be done in the LLM prompt or via post-processing Zod transform. Claude has discretion on approach.
- **Character/token cap for context window** — Claude determines the safe character limit based on the chosen model's context window minus prompt overhead.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — EXTR-02, EXTR-03, EXTR-04, EXTR-05, EXTR-06, TECH-01 are the requirements this phase implements.

### Roadmap & State
- `.planning/ROADMAP.md` — Phase 4 success criteria (4 acceptance criteria are the definition of done).
- `.planning/STATE.md` — Accumulated project decisions and current position.

### Architecture & Stack
- `.planning/codebase/ARCHITECTURE.md` — Extraction Pipeline spec (`src/extraction/`), planned DB tables (ManufacturerProfile, Products, Chemicals/CAS, Contacts, Locations), data flow from acquisition to extraction.
- `.planning/codebase/STACK.md` — `instructor-js`, OpenAI SDK (GPT-4o-mini), Anthropic SDK (Claude 3.5 Sonnet), Zod, BullMQ, ioredis. Confirms AI extraction stack.
- `.planning/codebase/STRUCTURE.md` — Canonical file layout: `src/extraction/`, `src/workers/`, `src/db/schema.ts`, `src/schemas/`.

### Phase 3 Foundation
- `.planning/phases/03-technical-acquisition-pipeline/03-CONTEXT.md` — D-08/D-09: `manufacturer_pages` table schema (the input to Phase 4). No token cap on stored Markdown.
- `.planning/phases/03-technical-acquisition-pipeline/03-04-PLAN.md` — BullMQ worker pattern (`acquisition.worker.ts`), concurrency config, job handler structure. Phase 4 mirrors this.

### Phase 1 Foundation
- `.planning/phases/01-lead-foundation-import/01-01-PLAN.md` — DB schema migration pattern (Drizzle + `drizzle-kit push`). Phase 4 adds profile tables via the same approach.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`manufacturer_pages` table** (`src/db/schema.ts`) — Phase 4 reads from this table. Columns: `id`, `lead_id`, `url`, `page_type`, `markdown_content`, `crawled_at`. Query by `lead_id` to get all pages for a manufacturer.
- **Drizzle DB client** (`src/db/index.ts`) — established singleton; import in extraction worker for reads and profile writes.
- **`acquisition.worker.ts`** (`src/workers/acquisition.worker.ts`) — BullMQ worker template with concurrency setup, job handler, graceful shutdown (SIGTERM/SIGINT via `void shutdown()`). Phase 4 extraction worker mirrors this structure.
- **Logger** (`src/lib/logger.ts`) — structured logging in use. Phase 4 uses it with `{ leadId, stage, model, tokensUsed, durationMs }`.
- **BullMQ queue setup** (`src/workers/queues.ts`) — existing queue registration pattern.

### Established Patterns
- **Drizzle for all DB writes** — no raw SQL. Insert via `drizzle.insert(...)`, upsert where idempotency needed.
- **`@/` path aliases** — all `src/` imports use `@/` prefix, never relative paths.
- **`dotenv` first import** — entry point (`src/extraction/run.ts`) must have `import 'dotenv/config'` or `node --env-file=.env.local` as the first statement, before any `@/db` import. (Phase 3 fixed a bug where dotenv hoisting caused DATABASE_URL not set on cold start — use the Node 20.6+ `--env-file` flag in npm scripts.)
- **Zod for validation** — all extraction outputs must pass Zod schemas before writing to DB. Never trust raw LLM JSON.
- **`unawaited_futures` lint rule** — async calls from event handlers (e.g., BullMQ job handler callbacks) must be wrapped with `void` or handled correctly.
- **`void shutdown()` pattern** — SIGTERM/SIGINT handlers use `void shutdown()` to satisfy unawaited_futures without a floating promise.
- **drizzle-kit push** — schema changes go through `drizzle-kit push` (not raw migration SQL). `DATABASE_URL` must be injected explicitly.

### Integration Points
- Phase 4 reads `manufacturer_pages` rows written by Phase 3 (keyed by `lead_id`).
- Phase 4 writes structured profiles to new tables; Phase 5 reads these for the dashboard.
- Lead status: Phase 4 transitions leads from `Crawled → Extracted` (new status value) or `Errored`. **New status value `Extracted` must be added to the `leadStatusEnum` in `src/db/schema.ts`.**
- BullMQ extraction queue requires the same running Redis instance (`REDIS_URL` env var).
- API keys required: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` — store in `.env.local` (gitignored).

</code_context>

<specifics>
## Specific Ideas

- The extraction CLI (`npm run extract`) should print a summary on completion: total manufacturers extracted, fields populated per extraction, jobs errored — consistent with Phase 2/3 runner output style.
- Section headers in the concatenated prompt should use the format `## [Page Type: products] ##` (lowercase page_type value from the enum) to keep it readable and consistent with the DB enum values.
- The `leadStatusEnum` must be extended to include `Extracted` — this is a schema migration that requires `drizzle-kit push` before the extraction worker can write results.

</specifics>

<deferred>
## Deferred Ideas

- **Semantic response cache** — STACK.md mentions ioredis for caching AI responses. Useful for idempotent re-runs but adds complexity. Defer to Phase 4 hotfix if extraction costs become a concern.
- **Scheduled/automatic extraction** — Auto-chain extraction from acquisition worker via BullMQ parent-child flow. Would reduce manual CLI steps. Defer to Phase 6+ or a hotfix.
- **PubChem verification** (TECH-02) — Automated verification of extracted CAS numbers against PubChem API. v2 requirement, out of scope.
- **GSTIN validation** (TECH-03) — Indian tax ID checksum + status check. v2 requirement, out of scope.
- **Reliability scoring** (TECH-04) — Confidence scores on AI-extracted data points. v2 requirement, out of scope.

</deferred>

---

*Phase: 4-AI Extraction & Technical Profiling*
*Context gathered: 2026-04-27*
