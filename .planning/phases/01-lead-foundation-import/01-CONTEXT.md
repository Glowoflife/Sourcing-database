# Phase 1: Lead Foundation & Import - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 establishes the lead management foundation: a PostgreSQL schema for manufacturer leads, a CSV import mechanism, and a basic status-tracking view. This is the data layer that every later phase (scraping, extraction, dashboard) depends on.

**In scope:** Lead schema (name, URL, status), CSV import, status list view, database client setup, migration tooling.
**Out of scope:** Automated discovery (Phase 2), scraping pipeline (Phase 3), AI extraction (Phase 4), full TanStack Table dashboard (Phase 5), workflow/notes (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Database Client
- **D-01:** Use **Drizzle ORM** as the database client. Schema-first, type-safe queries, TypeScript types auto-inferred from table definitions (`$inferSelect` / `$inferInsert`). Chosen for its Zod-compatible schema-first approach and lightweight SQL-close API.
- **D-02:** Use **drizzle-kit push** for migrations during development (schema diff applied directly, no migration files to track in early phases). Switch to `drizzle-kit generate + migrate` for production deployment when the time comes.

### Claude's Discretion
The following areas were not discussed — Claude has flexibility here:
- CSV import surface (UI upload vs CLI script vs API endpoint) — choose what's most pragmatic for Phase 1
- Lead status list scope — keep it minimal; full dashboard is Phase 5
- Duplicate URL handling strategy — choose a sensible default (skip/log is acceptable)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DISC-02 (lead lifecycle tracking) and DISC-03 (CSV import) are the two requirements this phase implements.

### Roadmap & State
- `.planning/ROADMAP.md` — Phase 1 success criteria (the 3 acceptance criteria are the definition of done).
- `.planning/STATE.md` — Current project state and accumulated decisions.

### Technology Stack
- `.planning/codebase/STACK.md` — Full stack decisions including Drizzle ORM, BullMQ, Next.js 14+. Phase 1 establishes the DB client that all later phases depend on.
- `.planning/codebase/ARCHITECTURE.md` — Planned architecture; Phase 1 implements the database layer and basic API routes.
- `.planning/codebase/STRUCTURE.md` — Planned directory structure; Phase 1 creates `src/db/`, `src/app/api/`, and `src/app/(dashboard)/` directories.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is the first phase. All code is greenfield.

### Established Patterns
- **Zod-as-source-of-truth:** Per CONVENTIONS.md, schema is defined first and TypeScript types are derived via `z.infer<>`. For Phase 1, the Drizzle table definition is the schema, and `$inferSelect` derives the TS type — consistent with this pattern.
- **Structured logging:** All service-layer operations should log `{ leadId, stage, status, durationMs }`.

### Integration Points
- Phase 1's `leads` table is the central entity that Phases 2–6 all write to and read from. The `status` column (`New` | `Processing` | `Crawled` | `Errored`) is the pipeline state machine.

</code_context>

<specifics>
## Specific Ideas

No specific UI references or "I want it like X" requirements — open to standard approaches for the import surface and status view.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Lead Foundation & Import*
*Context gathered: 2026-04-27*
