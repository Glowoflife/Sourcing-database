# Architecture

**Analysis Date:** 2026-04-27
**Status:** Pre-implementation — architecture is designed and decided. No source code exists yet. All patterns reflect decisions in `.planning/research/ARCHITECTURE.md`, `.planning/ROADMAP.md`, and `.planning/PROJECT.md`.

---

## System Overview

```text
┌──────────────────────────────────────────────────────────────┐
│                    Chemexcil Directory                        │
│              https://chemexcil.in/members                    │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTML scrape
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Discovery Bot (Crawlee + Playwright)             │
│  `src/discovery/`                                            │
│  Reads Chemexcil pages, extracts company name + URL          │
└──────────────────────┬───────────────────────────────────────┘
                       │ write Lead record
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL — Leads Table                         │
│  status: New | Processing | Crawled | Errored                │
└───────────┬──────────────────────────────────────────────────┘
            │ BullMQ job enqueue
            ▼
┌──────────────────────────────────────────────────────────────┐
│            Acquisition Service (Crawlee + Playwright)         │
│  `src/acquisition/`                                          │
│  Crawls manufacturer URL → converts HTML to Markdown         │
└──────────────────────┬───────────────────────────────────────┘
                       │ Markdown content
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Extraction Pipeline (Instructor + LLM)           │
│  `src/extraction/`                                           │
│  Schema-validated AI extraction via Zod models               │
└──────────────────────┬───────────────────────────────────────┘
                       │ write ManufacturerProfile
                       ▼
┌──────────────────────────────────────────────────────────────┐
│         PostgreSQL — Manufacturer Profiles, Products,         │
│         Chemicals (CAS), Contacts, Locations                  │
└──────────────────────┬───────────────────────────────────────┘
                       │ Next.js API routes
                       ▼
┌──────────────────────────────────────────────────────────────┐
│    Internal Dashboard (Next.js + TanStack Table/Query)        │
│  `src/app/` or `src/pages/`                                  │
│  Search, filter, detail view, CRM workflow, notes            │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Planned Path |
|-----------|----------------|--------------|
| Discovery Bot | Scrapes Chemexcil; writes Lead records with status=New | `src/discovery/` |
| Acquisition Service | Crawls manufacturer URLs; converts HTML to Markdown | `src/acquisition/` |
| Extraction Pipeline | Runs Instructor+LLM against Markdown; writes structured profiles | `src/extraction/` |
| BullMQ Workers | Orchestrate async jobs across all pipeline stages | `src/workers/` |
| Next.js API Routes | REST endpoints consumed by the dashboard | `src/app/api/` |
| Internal Dashboard | React UI for search, filtering, detail view, CRM actions | `src/app/(dashboard)/` |
| Database Schema | PostgreSQL tables and migrations | `src/db/` |
| Zod Schemas | Shared validation models for extraction output and API I/O | `src/schemas/` |

---

## Pattern Overview

**Overall:** Multi-stage asynchronous pipeline feeding a read-optimized internal dashboard.

**Key Characteristics:**
- Each pipeline stage is decoupled via BullMQ job queues — stages can fail independently and retry
- Schema-first extraction: Zod models are defined before LLM calls via Instructor; no raw JSON parsing
- HTML is always converted to Markdown before LLM processing — never raw HTML to AI
- Lead status (`New → Processing → Crawled → Errored`) is the single source of truth for pipeline progress
- The dashboard is read-heavy; the pipeline is write-heavy — they share one PostgreSQL database but are otherwise independent

---

## Layers

**Discovery Layer:**
- Purpose: Seed the database with manufacturer leads from Chemexcil
- Location: `src/discovery/` (planned)
- Contains: Crawlee crawler config, pagination logic, lead writer
- Depends on: Crawlee, Playwright, PostgreSQL
- Used by: BullMQ scheduler or manual CLI trigger

**Acquisition Layer:**
- Purpose: Convert manufacturer website pages to clean Markdown
- Location: `src/acquisition/` (planned)
- Contains: Crawlee crawler, Playwright page navigator, html-to-markdown converter
- Depends on: Crawlee, Playwright, BullMQ
- Used by: Extraction layer

**Extraction Layer:**
- Purpose: Use LLMs to extract structured technical profiles from Markdown
- Location: `src/extraction/` (planned)
- Contains: Instructor client setup, Zod schemas, prompt templates, unit normalization logic
- Depends on: `instructor-js`, OpenAI SDK, Anthropic SDK, Zod, PostgreSQL
- Used by: BullMQ workers

**Queue/Worker Layer:**
- Purpose: Orchestrate async jobs across pipeline stages with rate limiting and retries
- Location: `src/workers/` (planned)
- Contains: BullMQ worker definitions, queue configurations, flow producers
- Depends on: BullMQ, Redis
- Used by: All pipeline stages

**Data Layer:**
- Purpose: Define and migrate the PostgreSQL schema; provide typed query helpers
- Location: `src/db/` (planned)
- Contains: Table definitions, migrations, DAO-style query functions
- Depends on: PostgreSQL driver (pg or drizzle-orm)
- Used by: All layers

**API Layer:**
- Purpose: Expose data to the dashboard via Next.js API routes
- Location: `src/app/api/` (planned)
- Contains: Route handlers for manufacturers, leads, products, notes, sourcing actions
- Depends on: Data layer, Zod (request validation)
- Used by: Dashboard (TanStack Query)

**Dashboard Layer:**
- Purpose: Internal UI for browsing, filtering, and managing the manufacturer database
- Location: `src/app/(dashboard)/` (planned)
- Contains: Next.js page components, TanStack Table/Virtual setup, detail views, CRM workflow UI
- Depends on: TanStack Query, TanStack Table, TanStack Virtual, shadcn/ui
- Used by: Internal procurement team

---

## Data Flow

### Primary Pipeline: Lead Discovery to Profile

1. Discovery Bot crawls `https://chemexcil.in/members` with pagination — `src/discovery/`
2. Each manufacturer name + URL is written to PostgreSQL `leads` table with `status=New`
3. BullMQ enqueues an acquisition job for each lead — `src/workers/`
4. Acquisition Service crawls the manufacturer URL, converts HTML pages (Products, About, Contact) to Markdown — `src/acquisition/`
5. Lead status updated to `Processing`; Markdown passed to extraction queue
6. Extraction Pipeline calls Instructor with Zod schema + LLM against Markdown — `src/extraction/`
7. Structured `ManufacturerProfile` written to PostgreSQL; lead status updated to `Crawled`
8. On any unrecoverable error, lead status set to `Errored`

### Secondary Flow: Dashboard Consumption

1. User opens dashboard at `/` — Next.js page component
2. TanStack Query fetches paginated manufacturer list from `GET /api/manufacturers`
3. User searches/filters — query params passed back to API route, which applies PostgreSQL WHERE clauses
4. User opens a manufacturer detail view — `GET /api/manufacturers/[id]` returns full profile
5. User performs sourcing action (Approve/Reject/Flag) — `PATCH /api/manufacturers/[id]/status`
6. User adds a note — `POST /api/manufacturers/[id]/notes`

**State Management:**
- Server state: TanStack Query (caching, background refetch, optimistic updates)
- No client-side global state store needed in v1 (data is server-sourced)

---

## Key Abstractions

**ManufacturerProfile (Zod/DB Model):**
- Purpose: The central entity representing a fully-extracted chemical manufacturer
- Location: `src/schemas/manufacturer.ts` (planned)
- Fields: name, website_url, products (array with CAS numbers), locations, contacts, industries_served, capacity_metrics (normalized to MT/year), lead_status, last_scraped_at, sourcing_status, notes

**Lead:**
- Purpose: Represents a discovered manufacturer URL that has not yet been fully profiled
- Location: `src/db/` (planned)
- Lifecycle states: `New → Processing → Crawled → Errored`

**ExtractionSchema (Zod):**
- Purpose: The Zod model passed to Instructor before every LLM call — guarantees structured output
- Location: `src/schemas/extraction.ts` (planned)
- Pattern: Defined once, reused across OpenAI and Anthropic calls via Instructor's provider-agnostic interface

---

## Entry Points

**Discovery CLI / Scheduler:**
- Location: `src/discovery/` (planned)
- Triggers: Manual run or BullMQ scheduled job
- Responsibilities: Crawls Chemexcil, writes leads to DB

**Next.js Dev Server / Production Server:**
- Location: `src/app/` (planned)
- Triggers: `npm run dev` or `npm run start`
- Responsibilities: Serves dashboard UI and API routes

**BullMQ Worker Process:**
- Location: `src/workers/` (planned)
- Triggers: Separate Node.js process started alongside Next.js
- Responsibilities: Processes acquisition and extraction jobs from Redis queues

---

## Architectural Constraints

- **HTML to Markdown is mandatory:** Raw HTML must never be passed to an LLM. Convert first. See `.planning/research/PITFALLS.md` — this is the primary cost-control constraint.
- **Schema before LLM call:** Every LLM extraction call must have a Zod schema registered with Instructor before invocation. Ad-hoc JSON parsing of LLM responses is not allowed.
- **Stateless scrapers:** No pipeline state held in memory across Crawlee runs. All state stored in PostgreSQL (lead status) or Redis (BullMQ queues). See Anti-Pattern 2 in `.planning/research/ARCHITECTURE.md`.
- **Rate limiting:** All Crawlee crawlers must configure per-domain rate limits and proxy rotation before Phase 2 ships to avoid IP blocks on Chemexcil.
- **Unit normalization:** All production capacity values extracted by AI must be normalized to MT/year via Zod enum or secondary normalization step before writing to the database.

---

## Anti-Patterns

### Raw HTML to LLM

**What happens:** Acquisition Service passes raw HTML directly to the Extraction Pipeline.
**Why it's wrong:** High token cost, noise from JS/CSS/HTML boilerplate, degraded extraction accuracy.
**Do this instead:** Always run HTML through a Markdown conversion step in `src/acquisition/` before handing off to `src/extraction/`.

### In-Memory Scraper State

**What happens:** A Crawlee crawler stores visited URLs or partial results in a JavaScript Map in-process.
**Why it's wrong:** A crash or restart loses all progress; the crawl must restart from scratch.
**Do this instead:** Use Crawlee's built-in `RequestQueue` (persisted to disk or Redis) and write lead status to PostgreSQL immediately on discovery.

### Unvalidated LLM Output

**What happens:** Code calls OpenAI directly and does `JSON.parse(response.content)` with no schema validation.
**Why it's wrong:** LLMs hallucinate field names and types; a single bad response corrupts the database.
**Do this instead:** Always use `instructor-js` with a Zod schema. The schema definition in `src/schemas/extraction.ts` is the contract.

---

## Error Handling

**Strategy:** Lead-status-based error tracking with per-job retries

**Patterns:**
- BullMQ jobs automatically retry on transient failures (configurable backoff)
- After max retries, the lead's `status` is set to `Errored` in PostgreSQL — visible in the dashboard
- The dashboard's scraping status view (FEATURES.md) surfaces all `Errored` leads for manual review
- AI extraction errors caught by Instructor's retry/fallback mechanism before the error propagates

---

## Cross-Cutting Concerns

**Logging:** Structured logs per pipeline stage; minimum fields: `lead_id`, `stage`, `status`, `error` (if any)
**Validation:** Zod at all data entry points — extraction output, API request bodies, CSV import (Phase 1)
**Authentication:** Internal use; basic protection strategy TBD at implementation

---

*Architecture analysis: 2026-04-27*
