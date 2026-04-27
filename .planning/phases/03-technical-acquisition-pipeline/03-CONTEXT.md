# Phase 3: Technical Acquisition Pipeline - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the acquisition service that reads `status = New` leads from the database, crawls each manufacturer's website (homepage + up to 4 additional pages), converts the HTML to clean Markdown via Mozilla Readability + Turndown, and stores one row per crawled page in a new `manufacturer_pages` table. Jobs are enqueued via BullMQ (backed by Redis) using a CLI script and processed by 3 concurrent Playwright workers. This phase produces the Markdown content that Phase 4's AI extraction consumes.

**In scope:** BullMQ job setup, Redis worker, Playwright site crawl, link-text page discovery, Readability + Turndown HTML→Markdown, `manufacturer_pages` table schema + migration, lead status transitions (New → Processing → Crawled / Errored), CLI entry point (`npm run acquire`).
**Out of scope:** AI extraction (Phase 4), proxy rotation (deferred hotfix), UI for job status (Phase 5+), scheduled/automatic enqueueing (future phase).

</domain>

<decisions>
## Implementation Decisions

### Page Discovery Strategy
- **D-01:** Scan the manufacturer homepage `<a>` tags for **keyword matches** on link text or href: `product`, `about`, `company`, `catalogue`, `our-products`. Crawl matched pages up to a max of **5 pages per manufacturer** (homepage + up to 4 matched pages).
- **D-02:** On unreachable sites or crawl errors — let Crawlee handle per-request retries (**3 retry attempts**). After all retries exhausted, update lead `status = Errored` and log a structured error record (`{ leadId, url, reason, attempt }`). Consistent with Phase 2 error handling pattern.

### HTML→Markdown Conversion
- **D-03:** Use **Mozilla Readability + Turndown**. Readability strips nav, footer, and boilerplate before conversion, reducing token noise for Phase 4. Turndown converts the extracted content body to Markdown.
- **D-04:** **Preserve HTML tables as Markdown tables.** Chemical product tables contain CAS numbers, purity %, and capacity columns — losing column relationships would degrade Phase 4 extraction accuracy. Configure Turndown's table plugin accordingly.

### BullMQ Trigger & Concurrency
- **D-05:** **CLI script trigger** — `npm run acquire` reads all `status = New` leads and bulk-enqueues acquisition jobs. Consistent with Phase 2's `npm run discover` pattern. Explicit and auditable.
- **D-06:** **3 concurrent BullMQ workers**. Each worker processes a different manufacturer domain, so rate-limit conflicts are minimal. 3 concurrent Playwright instances is manageable memory-wise.
- **D-07:** **BullMQ persistence via Redis** — job state is durable. Crashed or interrupted runs resume from where they left off without re-processing already-`Crawled` leads.

### Markdown Storage Model
- **D-08:** New **`manufacturer_pages` table** with columns: `(id, lead_id, url, page_type, markdown_content, crawled_at)`. One row per crawled page. Phase 4 queries per `lead_id` and processes pages independently.
- **D-09:** **No character/token cap** on stored Markdown. Full page content preserved. Phase 4 is responsible for chunking or truncating before LLM calls based on its own context window strategy.

### Claude's Discretion
- CSS/heuristics for keyword matching — researcher derives exact keyword list and matching strategy from inspecting live Indian chemical manufacturer sites.
- `page_type` enum values for `manufacturer_pages` — Claude has discretion (e.g., `homepage`, `products`, `about`, `other`).
- BullMQ queue name and job payload shape — Claude has discretion within the structure implied by D-05 through D-07.
- Redis connection setup — assume `REDIS_URL` env var, consistent with existing stack plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — EXTR-01 is the sole requirement this phase implements. Success criteria defined in ROADMAP.md Phase 3.

### Roadmap & State
- `.planning/ROADMAP.md` — Phase 3 success criteria (3 acceptance criteria are the definition of done).
- `.planning/STATE.md` — Current project state and accumulated decisions.

### Architecture & Stack
- `.planning/codebase/ARCHITECTURE.md` — Acquisition Service spec (`src/acquisition/`), pipeline flow (Discovery → Acquisition → Extraction), BullMQ job orchestration pattern.
- `.planning/codebase/STACK.md` — Crawlee + Playwright, BullMQ, ioredis, Drizzle ORM, Zod. Confirms Redis 7 + BullMQ as the job queue.
- `.planning/codebase/STRUCTURE.md` — Canonical file layout: `src/acquisition/`, `src/workers/acquisition.worker.ts`, `src/db/schema.ts`, `src/db/migrations/`.

### Phase 2 Foundation
- `.planning/phases/02-automated-discovery/02-CONTEXT.md` — D-01 through D-08 (crawl patterns, Drizzle writes, status machine, error handling). Phase 3 reads the `leads` table written by Phase 2.
- `.planning/phases/02-automated-discovery/02-02-PLAN.md` — Lead status transitions and `leads` table schema. Phase 3 transitions leads from `New` → `Processing` → `Crawled` / `Errored`.

### Phase 1 Foundation
- `.planning/phases/01-lead-foundation-import/01-CONTEXT.md` — D-01 (Drizzle ORM), D-02 (drizzle-kit push). Phase 3 adds `manufacturer_pages` via the same migration pattern.
- `.planning/phases/01-lead-foundation-import/01-01-PLAN.md` — DB schema and migration push pattern; defines `leads` table and status enum.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Drizzle DB client** (`src/db/index.ts`) — established in Phase 1. Acquisition worker imports this to read leads and write `manufacturer_pages`. Must not be imported in Client Components.
- **`leads` table schema** (`src/db/schema.ts`) — existing table with `name`, `url`, `status`. Phase 3 adds `manufacturer_pages` alongside it.
- **PlaywrightCrawler setup** (`src/discovery/crawler.ts`) — Phase 2 has a working PlaywrightCrawler with polite crawl config, retry logic, and structured logging. Phase 3 mirrors this pattern for manufacturer sites.
- **Logger** (`src/lib/logger.ts`) — structured logging utility already in use. Phase 3 uses it with `{ leadId, url, stage, status, durationMs }`.

### Established Patterns
- **Drizzle for all DB writes** — no raw SQL, no other ORM. Insert via `drizzle.insert(...)`.
- **`@/` path aliases** — all `src/` imports use `@/` prefix, never relative paths.
- **Status machine** — `New | Processing | Crawled | Errored` are the only valid lead statuses. Phase 3 transitions: set `Processing` on job start, `Crawled` on success, `Errored` on permanent failure.
- **CLI entry point pattern** — `src/discovery/run.ts` with `dotenv/config` as the first import. Phase 3's `src/acquisition/run.ts` should follow the same pattern. `dotenv/config` must be the first executable statement before any `@/db` import.
- **drizzle-kit push** — schema changes go through `drizzle-kit push` (not raw migration SQL). Phase 3 adds `manufacturer_pages` table to `src/db/schema.ts` and runs push.

### Integration Points
- Phase 3 reads `status = New` leads from the `leads` table (written by Phase 2). Phase 4 reads `manufacturer_pages` rows (written by Phase 3).
- BullMQ requires a running Redis instance — `REDIS_URL` env var must be set (consistent with stack plan).
- `manufacturer_pages.lead_id` is a foreign key to `leads.id` — Drizzle relation defined in schema.

</code_context>

<specifics>
## Specific Ideas

- The acquisition CLI (`npm run acquire`) should print a summary on completion similar to Phase 2's discovery runner: total leads enqueued, jobs completed, jobs errored.
- Per-page crawl should identify page type (`homepage`, `products`, `about`, `other`) and store it in `manufacturer_pages.page_type` so Phase 4 can prioritise products pages for extraction.

</specifics>

<deferred>
## Deferred Ideas

- **Proxy rotation** — ARCHITECTURE.md plans this for manufacturer site crawling. Deferred to a hotfix if IP blocking occurs during Phase 3 testing.
- **Automatic/scheduled acquisition** — Auto-enqueue on lead discovery or cron-triggered runs. Useful for keeping the database fresh; deferred to Phase 6+.
- **Token/character cap on Markdown storage** — Not enforced in Phase 3. Phase 4 will handle chunking. Can revisit if DB storage becomes a concern.
- **UI for acquisition job status** — A dashboard panel showing BullMQ queue depth and per-lead crawl status would be useful in Phase 5.

</deferred>

---

*Phase: 3-Technical Acquisition Pipeline*
*Context gathered: 2026-04-27*
