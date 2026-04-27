# Phase 1: Lead Foundation & Import - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 1-Lead Foundation & Import
**Areas discussed:** Database client

---

## Database Client

| Option | Description | Selected |
|--------|-------------|----------|
| Drizzle ORM | Schema-first, type-safe queries, drizzle-kit migrations. Plays well with Zod. Lightweight and SQL-close. | ✓ |
| Prisma | Mature ORM with Prisma Studio UI. Code-gen based. Some friction with raw SQL for complex filtering in Phase 5. | |
| Raw pg driver | Minimal abstraction, full SQL control. Requires hand-written migrations and manual type assertions. | |

**User's choice:** Drizzle ORM
**Notes:** User selected the recommended option. No additional rationale provided — choice aligns with the Zod-compatible, schema-first pattern established in CONVENTIONS.md.

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| drizzle-kit push | Schema diff applied directly in dev — no migration files to commit in early phases. | ✓ |
| drizzle-kit generate + migrate | SQL migration files committed to git — safer for teams and production from day one. | |

**User's choice:** drizzle-kit push (dev) — switch to generate+migrate for production when the time comes.

---

## Claude's Discretion

The following areas were not discussed — Claude has flexibility:
- CSV import surface (UI upload, CLI script, or API endpoint)
- Lead status list scope (how minimal for Phase 1)
- Duplicate URL handling strategy

## Deferred Ideas

None — discussion stayed within phase scope.
