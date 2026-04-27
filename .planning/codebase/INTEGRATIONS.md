# External Integrations

**Analysis Date:** 2026-04-27
**Status:** Pre-implementation — all integrations are researched and decided. No integration code exists yet.

---

## APIs & External Services

**LLM Providers (AI Extraction):**
- OpenAI — GPT-4o-mini for high-throughput extraction at scale
  - SDK: `openai` npm package, wrapped by `instructor-js`
  - Auth: `OPENAI_API_KEY` environment variable
  - Usage: Default extraction model in Phase 4 pipeline
- Anthropic — Claude 3.5 Sonnet for complex technical chemical reasoning
  - SDK: `@anthropic-ai/sdk` npm package, wrapped by `instructor-js`
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Usage: Fallback/override for high-difficulty extraction tasks (capacity normalization, CAS inference)

**Chemical Data Validation (v2):**
- PubChem API — automated verification of extracted chemical names and CAS numbers
  - No API key required (public REST API)
  - Endpoint: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/`
  - Requirement: TECH-02 (deferred to v2)

**Web Scraping Sources:**
- Chemexcil Member Directory — `https://chemexcil.in/members`
  - Scraped by: Discovery Bot (Crawlee + Playwright)
  - No API — HTML scraping with pagination handling
  - Risk: IP blocking; mitigated with proxy rotation and rate limiting

---

## Data Storage

**Databases:**
- PostgreSQL 16 — primary relational store for all manufacturer, product, lead, and CRM data
  - Connection: `DATABASE_URL` environment variable
  - Client: ORM/driver TBD at Phase 1 implementation (`pg` or `drizzle-orm` most likely)
  - Key data: Leads table, Manufacturer Profiles table, Products/Chemicals table (with CAS numbers), Notes table
  - JSONB columns used for flexible technical profile data (products, capacity metrics, industries served)

**File Storage:**
- Local filesystem — Markdown conversion artifacts (HTML-to-Markdown output from manufacturer crawls) stored temporarily before AI extraction
- Persistent storage solution TBD if Markdown assets need long-term retention

**Caching:**
- Redis 7 — dual-purpose:
  1. BullMQ job queue backend (pipeline orchestration)
  2. Semantic response cache for AI extraction calls (prevents re-processing unchanged pages, reduces token costs)
  - Connection: `REDIS_URL` environment variable
  - Client: `ioredis`

---

## Authentication & Identity

**Auth Provider:**
- None planned (internal tool, no public access)
- Authentication strategy not yet decided — likely simple shared secret or basic auth at the Next.js middleware layer for v1

---

## Monitoring & Observability

**Error Tracking:**
- Not yet decided — standard Node.js `console.error` as baseline; structured logging library (e.g., `pino`) likely

**Logs:**
- Pipeline job status tracked in PostgreSQL via `lead_status` field (New, Processing, Crawled, Errored) — satisfies DISC-02 requirement
- BullMQ provides built-in job state visibility (active, completed, failed queues)
- `last_scraped_at` timestamp stored per lead to track staleness

**AI Cost Monitoring:**
- Token usage monitoring strategy TBD — critical risk identified in `.planning/research/PITFALLS.md` (unbounded AI costs)
- Semantic caching in Redis reduces redundant extraction calls

---

## CI/CD & Deployment

**Hosting:**
- Internal deployment target — platform not yet decided

**CI Pipeline:**
- None configured yet

---

## Environment Configuration

**Required environment variables:**
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `OPENAI_API_KEY` — OpenAI API key
- `ANTHROPIC_API_KEY` — Anthropic API key
- Proxy provider credentials — variable names TBD pending proxy provider selection

**Secrets location:**
- `.env.local` (Next.js convention, git-ignored)

---

## Webhooks & Callbacks

**Incoming:**
- None planned for v1

**Outgoing:**
- None planned for v1

---

## Proxy Infrastructure

**Provider:**
- Not yet selected — required before Phase 2 (Automated Discovery) to prevent IP blocking on Chemexcil
- Must support residential or datacenter proxies with rotation
- Integrated into Crawlee's built-in proxy configuration

---

*Integration audit: 2026-04-27*
