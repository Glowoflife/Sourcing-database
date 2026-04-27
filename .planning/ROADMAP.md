# Roadmap: Indian Chemical Sourcing Database

## Phases

- [x] **Phase 1: Lead Foundation & Import** - Core schema and manual lead management. *(Complete 2026-04-27)*
- [ ] **Phase 2: Automated Discovery** - Chemexcil scraper for lead generation.
- [ ] **Phase 3: Acquisition Pipeline** - HTML to Markdown conversion and job orchestration.
- [ ] **Phase 4: AI Extraction & Technical Profiling** - Deep technical data extraction from websites.
- [ ] **Phase 5: Search & Discovery Dashboard** - High-density browsing and detail views.
- [ ] **Phase 6: Sourcing Workflow & Notes** - Decision support and team collaboration.

---

## Phase Details

### Phase 1: Lead Foundation & Import
**Goal**: Establish the lead management system and initial data pool.
**Depends on**: Nothing
**Requirements**: DISC-02, DISC-03
**Success Criteria**:
  1. User can manually import a list of manufacturers via CSV.
  2. User can view the current processing status (New, Processing, Crawled, Errored) for any lead.
  3. Database correctly stores lead names and target URLs.
**Plans:** 3 plans in 2 waves

**Wave 1:**
- [x] 01-01-PLAN.md — Project bootstrap, Drizzle schema, and database push (DISC-02) *(complete 2026-04-27)*

**Wave 2** *(blocked on Wave 1 completion)*:
- [x] 01-02-PLAN.md — CSV import API and leads list API (DISC-03) *(complete 2026-04-27)*
- [x] 01-03-PLAN.md — Leads dashboard shell, status table, and CSV import UI (DISC-02, DISC-03) *(complete 2026-04-27)*

**Cross-cutting constraints:**
- `DATABASE_URL` must be set in `.env.local` before Wave 1 Task 3 runs
- All `src/` files must use `@/` path aliases (no relative imports)
- DB singleton (`src/db/index.ts`) must never be imported in Client Components

### Phase 2: Automated Discovery
**Goal**: Automate the seeding of leads from the primary industry source.
**Depends on**: Phase 1
**Requirements**: DISC-01
**Success Criteria**:
  1. System successfully identifies and saves member URLs from Chemexcil in a single run.
  2. System handles pagination on the Chemexcil directory without human intervention.
  3. System respects rate limits and completes a discovery run without IP blocks.
**Plans:** 2 plans in 2 waves

**Wave 1:**
- [ ] 02-01-PLAN.md — Schema migration (url nullable + scraper_runs table), crawlee/playwright install, db:push

**Wave 2** *(blocked on Wave 1 completion)*:
- [ ] 02-02-PLAN.md — Discovery implementation: types.ts, lead-writer.ts, crawler.ts, run.ts (DISC-01)

**Cross-cutting constraints:**
- `dotenv` config call MUST be the first executable statement in `src/discovery/run.ts` — before any `@/db` import
- `leads.url` is nullable from this phase onward — Errored leads may have `url = null`
- Playwright Chromium binary must be installed via `npx playwright install chromium` before first run
- All `src/discovery/` files must use `@/` path aliases (no relative imports)

### Phase 3: Technical Acquisition Pipeline
**Goal**: Prepare manufacturer website content for AI processing.
**Depends on**: Phase 2
**Requirements**: EXTR-01
**Success Criteria**:
  1. System can crawl a manufacturer's homepage and follow links to "Products" and "About" pages.
  2. Website content is successfully converted to Markdown, reducing token size compared to raw HTML.
  3. Acquisition jobs are queued and processed asynchronously via BullMQ.
**Plans**: TBD

### Phase 4: AI Extraction & Technical Profiling
**Goal**: Generate high-fidelity technical profiles using AI.
**Depends on**: Phase 3
**Requirements**: EXTR-02, EXTR-03, EXTR-04, EXTR-05, EXTR-06, TECH-01
**Success Criteria**:
  1. Manufacturer profiles show structured lists of products and CAS numbers.
  2. Contact information (Email/Phone) is extracted and validated for format.
  3. Production capacities are normalized to MT/year for comparison.
  4. "Industries Served" are mapped to a standardized set of industry tags.
**Plans**: TBD

### Phase 5: Search & Discovery Dashboard
**Goal**: Enable users to find manufacturers through a performant interface.
**Depends on**: Phase 4
**Requirements**: CRM-01, CRM-02
**Success Criteria**:
  1. User can search for manufacturers by chemical name or CAS number.
  2. User can filter manufacturers by industry and production capacity.
  3. Detail view displays all technical data, locations, and contact info on a single screen.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Sourcing Workflow & Notes
**Goal**: Facilitate procurement decision-making and team collaboration.
**Depends on**: Phase 5
**Requirements**: CRM-03, CRM-04
**Success Criteria**:
  1. User can change a manufacturer's status to "Approved" or "Rejected" with one click.
  2. Team members can add and view time-stamped notes on manufacturer profiles.
  3. The dashboard clearly highlights manufacturers flagged for manual review.
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Lead Foundation & Import | 3/3 | Complete | 2026-04-27 |
| 2. Automated Discovery | 0/2 | Ready to execute | - |
| 3. Technical Acquisition Pipeline | 0/0 | Not started | - |
| 4. AI Extraction & Technical Profiling | 0/0 | Not started | - |
| 5. Search & Discovery Dashboard | 0/0 | Not started | - |
| 6. Sourcing Workflow & Notes | 0/0 | Not started | - |
