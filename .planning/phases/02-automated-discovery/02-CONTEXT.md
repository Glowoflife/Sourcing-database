# Phase 2: Automated Discovery - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers a Chemexcil discovery bot that crawls `https://chemexcil.in/members`, extracts manufacturer name + website URL from each paginated listing, and writes new Lead records to the `leads` table (status=New). This is the automated seeding layer — it produces the raw leads that Phases 3 and 4 will enrich.

**In scope:** Chemexcil directory scraper, pagination handling, lead deduplication, run tracking (scraper_runs table), structured terminal logging, parse-failure recording, resumable runs via Crawlee RequestQueue.
**Out of scope:** Manufacturer website crawling (Phase 3), AI extraction (Phase 4), proxy rotation (deferred hotfix), BullMQ scheduling (deferred).

</domain>

<decisions>
## Implementation Decisions

### Trigger & Visibility
- **D-01:** Invocation is a **CLI script** — `npm run discover` (or `npx tsx src/discovery/run.ts`). No API endpoint or BullMQ scheduler in Phase 2.
- **D-02:** Progress is surfaced two ways: **structured terminal logs** (page scraped, leads found/skipped/errored) AND **a `scraper_runs` DB table** that records `started_at`, `finished_at`, `leads_found`, `leads_written`, `leads_skipped`, `leads_errored` per run. This allows future dashboard visibility without requiring it in Phase 2.

### Re-run Behavior
- **D-03:** **Skip silently on duplicate URLs.** If a lead with the same `website_url` already exists in the `leads` table, the scraper skips it without writing or erroring. Idempotent — safe to re-run any number of times.
- **D-04:** **Resumable runs via Crawlee RequestQueue** (persisted to disk). If a run is interrupted mid-pagination, re-running the CLI resumes from the last unprocessed page. Crawlee manages this automatically via its `storageDir`.

### Rate Limiting & Proxy
- **D-05:** **Polite crawl** — 1 concurrent request, 2–5 second random delay between page fetches (`minConcurrency: 1`, `maxConcurrency: 1`, Crawlee `requestHandlerTimeoutSecs` and `minTime` configured accordingly). Minimises IP block risk for Phase 2.
- **D-06:** **Direct HTTP for Phase 2** — no proxy provider wired in. If Chemexcil blocks the IP, proxy rotation (already planned in ARCHITECTURE.md) is added as a hotfix. Do not defer this design decision into Phase 2 plans.

### Failure Surface
- **D-07:** **Parse failures (missing name or URL on a page element)** → log a structured warning to terminal (`{ page, element, reason }`) AND write a partial lead record to the DB with `status = 'Errored'` and whatever fields could be extracted. The `scraper_runs` row increments `leads_errored`.
- **D-08:** **Full run failure (network error, IP blocked, Chemexcil down)** → Crawlee's per-request retry handles transient request failures. If the entire run process crashes, the CLI wraps the run in an **exponential backoff retry loop** (3 attempts: 30s → 60s → 120s delay) before exiting with a non-zero code. Crawlee RequestQueue ensures already-processed pages are not re-fetched on retry.

### Claude's Discretion
- Browser engine choice (PlaywrightCrawler vs. CheerioCrawler): prefer CheerioCrawler (HTTP only) if Chemexcil is server-rendered; fall back to PlaywrightCrawler if JS rendering is required. Claude/researcher decides after inspecting the target.
- CSS selectors for member name and URL extraction: researcher/planner derives from live Chemexcil HTML.
- `scraper_runs` table schema details: Claude has discretion within the fields named in D-02.
- Logging format: structured JSON to stdout (e.g., `pino` or `console.log` with JSON).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DISC-01 is the sole requirement this phase implements. Success criteria are defined in ROADMAP.md Phase 2.

### Roadmap & State
- `.planning/ROADMAP.md` — Phase 2 success criteria (3 acceptance criteria are the definition of done).
- `.planning/STATE.md` — Current project state and accumulated decisions.

### Architecture & Stack
- `.planning/codebase/ARCHITECTURE.md` — Discovery Layer spec (`src/discovery/`), anti-patterns (in-memory state, raw HTML to LLM), rate limiting constraint, stateless crawler requirement.
- `.planning/codebase/STACK.md` — Crawlee + Playwright, Drizzle ORM, BullMQ (queue, not used in Phase 2 trigger), ioredis.

### Phase 1 Foundation
- `.planning/phases/01-lead-foundation-import/01-CONTEXT.md` — D-01 (Drizzle ORM), D-02 (drizzle-kit push). Phase 2 writes to the `leads` table established in Phase 1.
- `.planning/phases/01-lead-foundation-import/01-01-PLAN.md` — DB schema and push plan; defines `leads` table columns including `status` enum.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Drizzle DB client** (`src/db/index.ts`) — established in Phase 1. Phase 2 imports it to write lead records. Must not be imported in Client Components.
- **`leads` table schema** (`src/db/schema.ts`) — existing table with `name`, `url`, `status` columns. Phase 2 adds `scraper_runs` table alongside it.

### Established Patterns
- **Drizzle for all DB writes** — no raw SQL, no other ORM. Insert and conflict-handling via Drizzle's `insert(...).onConflictDoNothing()`.
- **`@/` path aliases** — all `src/` imports use `@/` prefix, not relative paths.
- **Structured logging** — per Phase 1 CONTEXT.md: log `{ leadId, stage, status, durationMs }` at service layer.
- **Status machine** — `New | Processing | Crawled | Errored` are the only valid lead statuses. Phase 2 writes `New` on discovery and `Errored` on parse failure.

### Integration Points
- Phase 2 writes to the `leads` table. Phase 3's acquisition service reads `status = 'New'` leads from that same table.
- `scraper_runs` is a new table — does not interact with Phase 1 code.

</code_context>

<specifics>
## Specific Ideas

- The `scraper_runs` table should store enough data that a future dashboard widget (Phase 5 or 6) can show "Last run: 2026-04-27, 847 leads found, 3 errors" without re-querying the leads table.

</specifics>

<deferred>
## Deferred Ideas

- **Proxy rotation** — ARCHITECTURE.md plans this; deferred to a hotfix after Phase 2 ships if IP blocking occurs.
- **BullMQ scheduled discovery** — Running discovery on a cron schedule is a useful future feature; deferred to Phase 6 or beyond.
- **Dashboard visibility for scraper runs** — The `scraper_runs` table sets this up, but actual UI is out of scope for Phase 2.

</deferred>

---

*Phase: 2-Automated Discovery*
*Context gathered: 2026-04-27*
