# Codebase Concerns

**Analysis Date:** 2026-04-27
**Status:** Pre-implementation — all concerns are architectural risks and design-time decisions derived from `.planning/research/PITFALLS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/research/ARCHITECTURE.md`, and `.planning/research/STACK.md`. No source code exists yet.

---

## Tech Debt

**ORM / Database Client Undecided:**
- Issue: The database client is noted as "TBD at Phase 1 implementation — `pg` or `drizzle-orm` most likely" in `.planning/codebase/INTEGRATIONS.md`.
- Files: `src/db/` (planned)
- Impact: Choosing raw `pg` later after schema patterns are established will require a full migration to a typed ORM or leave the project with untyped query strings that undermine TypeScript safety. Choosing `drizzle-orm` from the start provides schema-as-code and type-safe queries.
- Fix approach: Decide and commit to `drizzle-orm` in Phase 1 before any query code is written. This choice cascades into migration strategy, type generation, and query patterns across all layers.

**Markdown Asset Persistence Undecided:**
- Issue: `.planning/codebase/INTEGRATIONS.md` notes "Persistent storage solution TBD if Markdown assets need long-term retention." The Acquisition Service writes Markdown to local filesystem before extraction.
- Files: `src/acquisition/` (planned)
- Impact: Local filesystem storage is incompatible with distributed worker deployments. If workers ever run on multiple machines, they cannot share a local filesystem. Deferring this decision creates a hard refactor boundary later.
- Fix approach: Default to storing Markdown content in PostgreSQL as a `TEXT` column on the `leads` table (or a dedicated `acquisitions` table). This is simpler than S3/object storage for early scale and removes the filesystem coupling.

**Proxy Provider Not Selected:**
- Issue: "Not yet selected" per `.planning/codebase/INTEGRATIONS.md`. Proxy infrastructure is required before Phase 2 (Automated Discovery) ships.
- Files: Crawlee config in `src/discovery/` (planned)
- Impact: Phase 2 cannot safely ship without proxy rotation. Chemexcil is an industry directory with detectable scraping patterns. An unrotated residential IP will be blocked within hours of a full-run, burning discovery progress and potentially blacklisting the operator's IP.
- Fix approach: Select a proxy provider (Bright Data, Oxylabs, or Webshare) during Phase 1 planning. Wire Crawlee's `ProxyConfiguration` to it before writing any Phase 2 scraping code.

**Authentication Strategy Undefined:**
- Issue: `.planning/codebase/INTEGRATIONS.md` states "Authentication strategy not yet decided — likely simple shared secret or basic auth at the Next.js middleware layer for v1."
- Files: `src/app/middleware.ts` (planned)
- Impact: Shipping an internal tool with no authentication — even a shared secret — means any user on the same network can access sensitive supplier contact data, CAS numbers, and procurement strategy signals. The longer authentication is deferred, the more routes and API handlers accumulate without protection.
- Fix approach: Implement HTTP Basic Auth at the Next.js middleware layer in Phase 5 (before the dashboard is usable). One middleware file protects all `/api` and `/` routes simultaneously. Upgrade to NextAuth.js with Google OAuth if multi-user access is needed in v2.

---

## Security Considerations

**Supplier Contact Data Exposure:**
- Risk: The database stores extracted contact details including personal emails, phone numbers, and WhatsApp numbers of manufacturer sales staff. These are personal data under India's Digital Personal Data Protection Act (DPDPA).
- Files: `src/schemas/manufacturer.ts` (planned), `src/db/` (planned)
- Current mitigation: Internal-only access is stated as a design constraint, but no authentication is implemented.
- Recommendations: (1) Implement authentication before any contact data is stored. (2) Add a `data_source: 'public_website'` audit field to distinguish scraped public data from team-entered data. (3) Document data retention policy — contact data scraped from public sources can change ownership; stale records become a liability.

**API Keys in Environment — No Rotation Strategy:**
- Risk: `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are used directly from environment variables per `.planning/codebase/INTEGRATIONS.md`. Pipeline workers will need access to these keys. If a worker process is compromised, keys are exposed.
- Files: `.env.local` (planned)
- Current mitigation: Git-ignored `.env.local` per Next.js convention.
- Recommendations: Use a secrets manager (e.g., AWS Secrets Manager, Doppler, or Infisical) rather than flat `.env` files before deploying to any shared infrastructure. Scope OpenAI/Anthropic keys to the minimum spend limit possible via the provider's dashboard.

**Scraping Legal/Terms-of-Service Risk:**
- Risk: Automated scraping of `chemexcil.in` and individual manufacturer websites may violate their terms of service. The `robots.txt` compliance requirement is noted in `.planning/PROJECT.md` ("Must respect rate limits and robots.txt") but is not yet codified in any planned implementation.
- Files: `src/discovery/` (planned), `src/acquisition/` (planned)
- Current mitigation: Rate limiting is planned but not implemented.
- Recommendations: (1) Read and cache `robots.txt` for each domain before crawling — Crawlee supports this natively via `RobotsFile`. (2) Set a conservative `requestsPerMinute` limit (e.g., 10 RPM) as a hardcoded floor regardless of proxy rotation. (3) Document internal policy on scraping use to distinguish procurement intelligence from redistribution.

---

## Performance Bottlenecks

**Unbounded AI Token Cost Per Crawl Run:**
- Problem: A recursive Playwright crawl of a large manufacturer site (100+ pages) with each page sent to GPT-4o-mini has no natural ceiling.
- Files: `src/acquisition/` (planned), `src/extraction/` (planned)
- Cause: `.planning/research/PITFALLS.md` identifies this as a critical risk: "A single company crawl could cost $50-$100 in tokens" without intelligent page selection.
- Improvement path: (1) Implement a page-selection heuristic in the Acquisition Service — only crawl pages with URLs or titles matching `products`, `about`, `contact`, `capabilities`, `manufacturing`. (2) Set a hard `MAX_PAGES_PER_DOMAIN` constant (e.g., 10) as a safety ceiling. (3) Implement semantic caching in Redis so re-crawls of unchanged pages do not re-invoke LLM calls. Token usage per run must be logged with each BullMQ job.

**Full-Table Scans on Manufacturer Search:**
- Problem: Phase 5 search requires filtering by chemical name, CAS number, industry, and production capacity. Without proper indexing these queries degrade at scale.
- Files: `src/db/` (planned)
- Cause: The schema is not yet defined; index planning has not been documented.
- Improvement path: Define indexes at schema creation time in Phase 1: (1) GIN index on `products` JSONB column for chemical name search; (2) B-tree index on `cas_number` in the chemicals table; (3) B-tree index on `industries_served` array; (4) B-tree index on `lead_status`. Do not defer index design to Phase 5.

**Virtualization Dependency for Dashboard Performance:**
- Problem: The dashboard will render thousands of manufacturer rows. Without TanStack Virtual, DOM-heavy renders will freeze the browser.
- Files: `src/app/(dashboard)/` (planned)
- Cause: Noted in `.planning/research/PITFALLS.md` as a "Laggy UI" risk. TanStack Virtual is in the stack but its integration is not yet planned.
- Improvement path: Wire TanStack Virtual to the TanStack Table row model from day one in Phase 5. Never render a non-virtualized table with more than 50 rows.

---

## Fragile Areas

**Chemexcil Scraper (Single External Dependency for Lead Generation):**
- Files: `src/discovery/` (planned)
- Why fragile: The entire lead pipeline starts with `https://chemexcil.in/members`. If Chemexcil redesigns their page layout, adds bot detection, or changes pagination structure, Phase 2's primary output breaks entirely. There is no fallback discovery source in v1.
- Safe modification: (1) Build the scraper against explicit CSS selectors, not XPath, and document the selectors in a config file (not inline). (2) Add an integration test that mocks the Chemexcil HTML fixture and asserts the number of extracted leads. (3) Implement DISC-03 (external CSV import) in Phase 1 as a manual fallback for when automated discovery fails.
- Test coverage: No tests planned yet. Integration test with a saved HTML fixture is the minimum acceptable.

**LLM Extraction Accuracy (Hallucinations on Technical Data):**
- Files: `src/extraction/` (planned), `src/schemas/extraction.ts` (planned)
- Why fragile: Chemical names, CAS numbers, and production capacities extracted by LLMs can be plausibly wrong — hallucinated CAS numbers look structurally valid (e.g., `64-17-5` for ethanol is correct, but an LLM may generate `64-17-6` for a novel compound). Zod schema validation enforces structure but cannot validate chemical identity.
- Safe modification: (1) Store LLM extraction output with a `confidence: 'low' | 'medium' | 'high'` field from Instructor's retry/fallback signals. (2) Flag all CAS numbers as `unverified` until TECH-02 (PubChem API verification) ships in v2. (3) Never overwrite an existing `Crawled` profile without displaying a diff — implement TECH-04 (reliability scoring) before blindly allowing re-extraction overwrites.
- Test coverage: Unit tests needed for Zod schemas to assert rejection of invalid structures. No AI mocking strategy is yet planned.

**Unit Normalization Logic (Capacity Extraction):**
- Files: `src/extraction/` (planned), `src/schemas/extraction.ts` (planned)
- Why fragile: EXTR-05 requires normalizing "100 MT", "10,000 kg", "100 tonnes/month", "1,200 MT/year" into a single comparable value. This logic is complex enough that LLM-based normalization alone is unreliable. `.planning/research/PITFALLS.md` (Pitfall 3) flags this explicitly.
- Safe modification: Implement a deterministic normalization function `normalizeCapacity(raw: string): { value: number; unit: 'MT_PER_YEAR' }` in `src/extraction/normalize.ts`. This function should be unit-tested with at least 20 representative examples before Phase 4 ships. Do not rely on the LLM to perform unit conversion inside the Zod schema alone.
- Test coverage: This is the highest-priority test surface in the entire codebase. Zero test coverage planned yet.

**BullMQ Worker Process Lifecycle (Two-Process Deployment):**
- Files: `src/workers/` (planned)
- Why fragile: The architecture requires running a BullMQ worker process *separately* from the Next.js server. This is not native to Next.js's default deployment model. Without a process manager (e.g., PM2 or a separate Dockerfile), the worker will not start automatically, and the pipeline will silently stop processing jobs.
- Safe modification: Document the two-process startup in a `Makefile` or `docker-compose.yml` from Phase 1. Never describe setup as "just run `npm run dev`" — the worker process must be explicitly documented and started.
- Test coverage: No worker lifecycle tests planned. At minimum, a smoke test that enqueues a job and asserts it moves through to completion is needed before Phase 3 ships.

---

## Scaling Limits

**Single PostgreSQL Instance:**
- Current capacity: Adequate for a single-team internal tool scraping thousands of manufacturers.
- Limit: Full-text search on JSONB product data, combined with high-frequency BullMQ status updates during a pipeline run, will cause write/read contention at ~50,000+ manufacturer records.
- Scaling path: Add a read replica for dashboard queries at that threshold. For earlier scale, ensure the BullMQ job-update writes (lead status) hit a dedicated `leads` table index and do not lock the wider `manufacturers` table.

**Redis Memory for Semantic Cache:**
- Current capacity: Semantic caching of AI extraction responses in Redis is planned but has no TTL or eviction strategy documented.
- Limit: Caching full Markdown content + LLM output for thousands of manufacturers will exhaust Redis memory without TTL expiration.
- Scaling path: Set a `maxmemory-policy` of `allkeys-lru` on the Redis instance. Apply a per-key TTL of 30 days on semantic cache entries. Do not cache raw Markdown in Redis — only cache the structured extraction output (smaller payload).

---

## Dependencies at Risk

**`instructor-js` Library Maturity:**
- Risk: `instructor-js` is listed as "Latest" with no pinned version. The JS port of the Python `instructor` library is less mature than the Python original. Breaking API changes between minor versions are possible.
- Impact: The entire extraction pipeline depends on `instructor-js` for schema enforcement. A breaking change silently fails extractions or returns unvalidated output.
- Migration plan: Pin to an exact version at installation. Add an integration smoke test that calls `instructor-js` with a fixture Markdown document and asserts a valid `ManufacturerProfile` is returned. Monitor the GitHub releases page.

**Playwright/Crawlee Version Coupling:**
- Risk: Crawlee manages its own Playwright version internally. Mismatches between the Crawlee-bundled Playwright and any separately-installed Playwright version cause headless browser launch failures that are difficult to debug.
- Impact: Both Discovery (Phase 2) and Acquisition (Phase 3) depend on this combination.
- Migration plan: Do not install `playwright` separately. Use only the Playwright version bundled with Crawlee (`crawlee/playwright-crawler`). Document this explicitly in the project README.

---

## Missing Critical Features

**No Token Budget Enforcement:**
- Problem: There is no planned mechanism to hard-stop an extraction run that exceeds a cost threshold. The semantic cache mitigates redundancy, but the first pass on a large dataset has no ceiling.
- Blocks: Safe Phase 4 operation — a runaway crawl of 500 manufacturers could generate hundreds of dollars in LLM costs without human intervention.
- Resolution path: Implement a `TOKEN_BUDGET_PER_RUN` environment variable checked before each LLM call. Log cumulative token usage to a `pipeline_runs` table. Pause the BullMQ queue and alert (via log/email) when the budget is reached.

**No Re-crawl / Change Detection Strategy:**
- Problem: TECH-04 (Reliability Scoring) and CRM-05 (Change Detection) are deferred to v2 per REQUIREMENTS.md, but the `last_scraped_at` field is the only staleness signal planned for v1.
- Blocks: Users cannot tell how outdated a profile is without a visible "scraped X days ago" UI indicator. A profile crawled 6 months ago may show discontinued products as active.
- Resolution path: Display `last_scraped_at` prominently in the Phase 5 manufacturer detail view. Add a "Re-scrape" manual trigger button in Phase 6 that enqueues a fresh acquisition job for a specific lead.

**No CSV Export:**
- Problem: The CRM is internal-only, but procurement workflows frequently require exporting a shortlist of approved manufacturers to share with stakeholders not using the internal tool.
- Blocks: Sourcing decisions made in the dashboard cannot easily leave the system.
- Resolution path: Add a `/api/manufacturers/export?status=approved` CSV endpoint in Phase 6 alongside the notes/workflow features. TanStack Table's column model makes it trivial to generate the export payload.

---

## Test Coverage Gaps

**Unit Normalization Function (Highest Priority):**
- What's not tested: `normalizeCapacity()` conversion logic from arbitrary capacity strings to MT/year.
- Files: `src/extraction/normalize.ts` (planned)
- Risk: Silent data corruption — capacity values stored in incomparable units make the "filter by capacity" search feature (Phase 5 success criterion) return incorrect results.
- Priority: High — must have 20+ test cases before Phase 4 ships.

**Zod Schema Validation (Extraction Output):**
- What's not tested: `src/schemas/extraction.ts` (planned) Zod models for `ManufacturerProfile`, `Product`, `ContactInfo`, `Location`.
- Files: `src/schemas/` (planned)
- Risk: Schema gaps allow malformed LLM output to reach the database. A missing `.optional()` on a nullable field causes entire extraction jobs to fail on real-world data where the LLM returns null for missing fields.
- Priority: High — schema tests must run in CI before Phase 4.

**Chemexcil Scraper HTML Fixture Test:**
- What's not tested: Discovery Bot pagination and lead extraction logic.
- Files: `src/discovery/` (planned)
- Risk: Chemexcil layout changes break lead generation silently. Without a fixture-based test, the only way to notice breakage is a zero-lead run.
- Priority: Medium — implement alongside Phase 2 development.

**BullMQ Worker Integration Smoke Test:**
- What's not tested: Full job lifecycle from enqueue to completion to database write.
- Files: `src/workers/` (planned)
- Risk: Worker configuration errors (wrong queue name, missing Redis key, uncaught async exceptions in job handlers) fail silently — jobs stall in BullMQ's `waiting` state indefinitely.
- Priority: Medium — implement before Phase 3 ships.

**API Route Input Validation:**
- What's not tested: Zod validation of incoming request bodies for POST/PATCH routes.
- Files: `src/app/api/` (planned)
- Risk: Missing validation allows malformed data (e.g., empty `status` string, non-UUID `id`) to propagate to database queries, causing 500 errors instead of 422 responses.
- Priority: Medium — wire Zod request validation to all API routes from Phase 5 onward.

---

*Concerns audit: 2026-04-27*
