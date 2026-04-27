# Roadmap: Indian Chemical Sourcing Database

## Phases

- [x] **Phase 1: Lead Foundation & Import** - Core schema and manual lead management. *(Complete 2026-04-27)*
- [x] **Phase 2: Automated Discovery** - Chemexcil scraper for lead generation. *(Complete 2026-04-27)*
- [x] **Phase 3: Technical Acquisition Pipeline** - HTML to Markdown conversion and job orchestration. *(Complete 2026-04-27)*
- [x] **Phase 4: AI Extraction & Technical Profiling** - Deep technical data extraction from websites. *(Complete 2026-04-27)*
- [x] **Phase 5: Search & Discovery Dashboard** - High-density browsing and detail views. *(Complete 2026-04-27)*
- [ ] **Phase 6: Sourcing Workflow & Notes** - Decision support and team collaboration.

---

## Phase Details

### Phase 5: Search & Discovery Dashboard
**Goal**: Enable users to find manufacturers through a performant interface.
**Depends on**: Phase 4
**Requirements**: CRM-01, CRM-02
**Success Criteria**:
  1. User can search for manufacturers by chemical name or CAS number.
  2. User can filter manufacturers by industry and production capacity.
  3. Detail view displays all technical data, locations, and contact info on a single screen.
**Plans:** 3 plans in 2 waves

**Wave 1:**
- [x] 05-01-PLAN.md — Infrastructure (shadcn) and Data Access Layer (Drizzle queries) (CRM-01) *(complete 2026-04-27)*

**Wave 2:**
- [x] 05-02-PLAN.md — Manufacturers List Page (/manufacturers) with search/filters (CRM-01) *(complete 2026-04-27)*
- [x] 05-03-PLAN.md — Manufacturer Detail Page (/manufacturers/[leadId]) (CRM-02) *(complete 2026-04-27)*

### Phase 6: Sourcing Workflow & Notes
**Goal**: Implement decision support tools including sourcing status and manufacturer notes.
**Depends on**: Phase 5
**Requirements**: CRM-03, CRM-04
**Success Criteria**:
  1. User can update sourcing status (Approved, Rejected, Flagged) for any lead.
  2. Dashboard supports filtering by sourcing status.
  3. User can add and view chronological notes on manufacturer profiles.
**Plans:** 2 plans in 2 waves

**Wave 1:**
- [ ] 06-01-PLAN.md — Workflow Infrastructure (Schema, API, and Data Layer) (CRM-03, CRM-04)

**Wave 2:**
- [ ] 06-02-PLAN.md — Workflow UI Integration (Dashboard filters and Detail Page interactions) (CRM-03, CRM-04)

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Lead Foundation & Import | 3/3 | Complete | 2026-04-27 |
| 2. Automated Discovery | 2/2 | Complete | 2026-04-27 |
| 3. Technical Acquisition Pipeline | 4/4 | Complete | 2026-04-27 |
| 4. AI Extraction & Technical Profiling | 4/4 | Complete | 2026-04-27 |
| 5. Search & Discovery Dashboard | 3/3 | Complete | 2026-04-27 |
| 6. Sourcing Workflow & Notes | 0/2 | In progress | - |
