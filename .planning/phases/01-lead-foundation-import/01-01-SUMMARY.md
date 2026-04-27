---
phase: "01"
plan: "01-01"
subsystem: "database-bootstrap"
tags: ["next.js", "drizzle-orm", "postgresql", "tailwind-v4", "shadcn-ui", "typescript"]
dependency_graph:
  requires: []
  provides:
    - "Next.js 16 App Router project scaffold"
    - "Drizzle ORM + pg.Pool db singleton"
    - "leadStatusEnum PostgreSQL enum (New/Processing/Crawled/Errored)"
    - "leads table with unique URL constraint — verified live on Neon"
    - "Structured logger (LeadLogContext)"
  affects:
    - "01-02: CSV import API (uses src/db/schema.ts, src/db/index.ts)"
    - "01-03: Leads dashboard UI (uses leads table and shadcn/ui components)"
tech_stack:
  added:
    - "next@16.2.4"
    - "drizzle-orm@0.45.2"
    - "drizzle-kit@0.31.10"
    - "pg@8.20.0"
    - "csv-parse@6.2.1"
    - "zod@4.3.6"
    - "typescript@6.0.3"
    - "tailwindcss@4.2.4"
    - "@tailwindcss/postcss@4.2.4"
    - "shadcn@4.5.0 (CLI)"
  patterns:
    - "Tailwind v4 CSS-first config via @import tailwindcss in globals.css"
    - "shadcn/ui initialized with --yes --defaults (Zinc color scheme)"
    - "Drizzle schema-first: $inferSelect/$inferInsert for TypeScript types"
    - "Module-level pg.Pool singleton (never inside route handler)"
    - "drizzle-kit push (no migration files) for rapid schema iteration in dev"
key_files:
  created:
    - "package.json"
    - "tsconfig.json"
    - "next.config.ts"
    - "postcss.config.mjs"
    - "drizzle.config.ts"
    - ".gitignore"
    - ".env.example"
    - "components.json"
    - "src/app/layout.tsx"
    - "src/app/page.tsx"
    - "src/app/globals.css"
    - "src/db/schema.ts"
    - "src/db/index.ts"
    - "src/lib/logger.ts"
    - "src/lib/utils.ts"
    - "src/components/ui/button.tsx"
  modified: []
decisions:
  - "Added ignoreDeprecations: 6.0 to tsconfig.json — TypeScript 6.0.3 deprecated baseUrl; this silences the error while keeping @/ alias working until TS7 migration"
  - "shadcn init added tw-animate-css, class-variance-authority, clsx, lucide-react, tailwind-merge to package.json — these are shadcn's standard dependencies accepted per plan"
  - "Next.js build updated tsconfig.json with allowJs, esModuleInterop, react-jsx, .next/types include — standard Next.js mutations, committed as-is"
  - "Used drizzle-kit push (not migrate) for schema application — appropriate for greenfield dev with no migration history needed"
metrics:
  duration: "~15 minutes (including checkpoint for DATABASE_URL provision)"
  completed: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 16
---

# Phase 01 Plan 01: Project Bootstrap, Drizzle Schema, and Database Push Summary

**One-liner:** Next.js 16 + Tailwind v4 + shadcn/ui scaffolded with Drizzle ORM schema defining `leadStatusEnum` (New/Processing/Crawled/Errored) and `leads` table with unique URL constraint — all three tasks complete with live Neon PostgreSQL verification.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold Next.js 16 + Tailwind v4 + shadcn/ui | e7b9079 | package.json, tsconfig.json, next.config.ts, postcss.config.mjs, .gitignore, .env.example, components.json, src/app/* |
| 2 | Define Drizzle schema + db singleton + logger | 9b52257 | src/db/schema.ts, src/db/index.ts, src/lib/logger.ts, drizzle.config.ts |
| (chore) | Commit Next.js tsconfig mutations from npm run build | 366b74e | tsconfig.json |
| 3 | drizzle-kit push to Neon PostgreSQL | (no file changes — DB-only operation) | Live DB: leads table + lead_status enum |

## Installed Package Versions

All packages installed at exact pinned versions — no fallbacks needed:

| Package | Requested | Installed |
|---------|-----------|-----------|
| next | 16.2.4 | 16.2.4 |
| drizzle-orm | 0.45.2 | 0.45.2 |
| drizzle-kit | 0.31.10 | 0.31.10 |
| pg | 8.20.0 | 8.20.0 |
| csv-parse | 6.2.1 | 6.2.1 |
| zod | 4.3.6 | 4.3.6 |
| typescript | 6.0.3 | 6.0.3 |
| tailwindcss | 4.2.4 | 4.2.4 |

## shadcn/ui Init Choices

- Command: `npx shadcn@latest init --yes --defaults`
- Style: Default (Zinc)
- Tailwind v4 detected automatically — no manual config needed
- Bootstrapped components: `src/components/ui/button.tsx` and `src/lib/utils.ts`
- globals.css updated with full shadcn CSS variable set (dark mode vars included)
- layout.tsx updated to use Geist font via `next/font/google`

## Live Database Verification (Task 3)

Provider: **Neon** (https://console.neon.tech) — free tier, serverless PostgreSQL

`drizzle-kit push` output: `[✓] Changes applied`

Node.js introspection result:
```
table: leads
enum: New,Processing,Crawled,Errored
```

Both `SELECT to_regclass('public.leads')` and `SELECT unnest(enum_range(NULL::lead_status))` confirmed correct schema on the live database.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript 6.0 deprecated baseUrl option**
- **Found during:** Task 1 acceptance verification (`npx tsc --noEmit`)
- **Issue:** TypeScript 6.0.3 deprecated `baseUrl` and emits error TS5101 unless `ignoreDeprecations: "6.0"` is set
- **Fix:** Added `"ignoreDeprecations": "6.0"` to tsconfig.json compilerOptions
- **Files modified:** tsconfig.json
- **Commit:** e7b9079

**2. [Expected] Next.js build auto-updated tsconfig.json**
- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** Next.js 16 adds `allowJs`, `esModuleInterop`, `jsx: react-jsx`, and `.next/types/**/*.ts` to tsconfig.json on first build
- **Fix:** Accepted and committed the changes (correct Next.js behavior, not a bug)
- **Files modified:** tsconfig.json
- **Commit:** 366b74e

**3. [Checkpoint] Task 3 required human action — DATABASE_URL provision**
- **Found during:** Task 3 start
- **Issue:** DATABASE_URL was not present in .env.local; drizzle-kit push cannot proceed without a live database connection string
- **Resolution:** User provisioned Neon PostgreSQL and added DATABASE_URL to .env.local; resumed as continuation agent
- **Impact:** No code changes; ~5 minute delay

## Security Posture

| Threat | Status |
|--------|--------|
| T-01-01: .env.local gitignored | Mitigated — .gitignore contains `.env.local` and `.env*.local` |
| T-01-02: enum values fixed | Mitigated — exactly "New", "Processing", "Crawled", "Errored" |
| T-01-03: logger does not log DATABASE_URL | Mitigated — logger.ts comment explicitly notes secret exclusion |
| T-01-04: Pool not instantiated inside handler | Mitigated — module-level Pool in src/db/index.ts |
| T-01-05: drizzle-kit push to wrong DB | Accepted — confirmed correct Neon database via to_regclass introspection |

## Known Stubs

None — this plan establishes infrastructure only. No UI components with data stubs exist yet.

## Self-Check: PASSED

- [x] package.json exists: YES
- [x] tsconfig.json exists with @/ alias: YES
- [x] next.config.ts exists: YES
- [x] postcss.config.mjs exists with @tailwindcss/postcss: YES
- [x] src/app/layout.tsx with globals.css import: YES
- [x] src/app/page.tsx with redirect(/leads): YES
- [x] src/db/schema.ts with leadStatusEnum: YES
- [x] src/db/index.ts with Pool singleton: YES
- [x] src/lib/logger.ts without DATABASE_URL: YES (comment only)
- [x] drizzle.config.ts at project root: YES
- [x] .gitignore with .env.local: YES
- [x] .env.example with DATABASE_URL=: YES
- [x] components.json exists: YES
- [x] npx tsc --noEmit exits 0: YES
- [x] npm run build exits 0: YES
- [x] Commit e7b9079 exists: YES
- [x] Commit 9b52257 exists: YES
- [x] Commit 366b74e exists: YES
- [x] drizzle-kit push: COMPLETE — [✓] Changes applied
- [x] Live DB table: leads
- [x] Live DB enum: New,Processing,Crawled,Errored
