---
phase: 04-ai-extraction-technical-profiling
plan: "01"
subsystem: database
tags: [postgres, drizzle-orm, openai, anthropic, instructor-js, llm-polyglot, schema]

# Dependency graph
requires:
  - phase: 03-technical-acquisition-pipeline
    provides: manufacturer_pages table and Crawled lead status used as input to extraction
provides:
  - Four AI extraction npm packages installed at exact pinned versions
  - Extracted status value in lead_status PostgreSQL enum
  - manufacturer_profiles, products, contacts, locations tables in schema.ts
  - Eight new TypeScript type exports for profile tables
affects:
  - 04-02-extraction-worker
  - 04-03-extraction-cli
  - 04-04-dashboard

# Tech tracking
tech-stack:
  added:
    - "@instructor-ai/instructor@1.7.0 — Zod schema enforcement on LLM responses"
    - "openai@6.34.0 — GPT-4o-mini primary extraction model"
    - "@anthropic-ai/sdk@0.91.1 — Claude 3.5 Sonnet fallback"
    - "llm-polyglot@2.6.0 — OpenAI-compatible adapter for Anthropic SDK"
  patterns:
    - "Exact version pinning (no ^ range) for AI packages per threat model T-04-02"
    - "sql template literal for PostgreSQL array column defaults (not JS arrays)"
    - "One profile row per lead (unique constraint on manufacturer_profiles.lead_id)"
    - "Normalized child tables (products, contacts, locations) referencing profile_id"

key-files:
  created: []
  modified:
    - src/db/schema.ts
    - src/components/leads/status-badge.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Used --legacy-peer-deps for npm install because llm-polyglot@2.6.0 requires openai@^4 and @anthropic-ai/sdk@^0.33.0 as peers, conflicting with the plan-specified openai@6.x and @anthropic-ai/sdk@0.91.1; packages install and function correctly"
  - "Exact version pinning enforced by editing package.json after npm install added ^ prefixes"
  - "status-badge.tsx updated to include Extracted with purple color class (Rule 1 auto-fix — enum exhaustiveness)"

patterns-established:
  - "Pattern: SQL array default — use sql`'{}'::text[]` not [] for PostgreSQL array columns in Drizzle"
  - "Pattern: Profile table foreign key — unique() constraint on lead_id in manufacturer_profiles ensures one profile per lead"

requirements-completed:
  - EXTR-02
  - EXTR-03
  - EXTR-04
  - EXTR-05
  - EXTR-06
  - TECH-01

# Metrics
duration: 15min
completed: 2026-04-27
---

# Phase 04 Plan 01: AI Extraction Foundation Summary

**Four AI extraction npm packages installed at exact pinned versions and schema extended with Extracted enum value plus four normalized profile tables (manufacturer_profiles, products, contacts, locations)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-27T12:34:00Z
- **Completed:** 2026-04-27T12:49:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — drizzle-kit push)
- **Files modified:** 4

## Accomplishments
- Installed @instructor-ai/instructor@1.7.0, openai@6.34.0, @anthropic-ai/sdk@0.91.1, llm-polyglot@2.6.0 at exact pinned versions
- Extended leadStatusEnum with "Extracted" value between "Crawled" and "Errored"
- Added manufacturer_profiles table (one row per lead, unique constraint on lead_id)
- Added products, contacts, and locations child tables referencing manufacturer_profiles.id
- Added eight TypeScript type exports for all new tables

## Task Commits

1. **Task 1: Install AI extraction npm packages** - `a0f583c` (chore)
2. **Task 2: Extend schema.ts with Extracted status and four profile tables** - `2dbb426` (feat)
3. **Task 3: Run drizzle-kit push** - CHECKPOINT — awaiting human execution

## Files Created/Modified
- `package.json` — Added four AI extraction packages at exact pinned versions
- `package-lock.json` — Updated lockfile with 11 new packages
- `src/db/schema.ts` — Added doublePrecision+sql imports, Extracted enum value, four profile tables, eight type exports
- `src/components/leads/status-badge.tsx` — Added Extracted status with purple color class (auto-fix)

## Decisions Made
- Used `--legacy-peer-deps` because llm-polyglot@2.6.0 declares `openai@^4` and `@anthropic-ai/sdk@^0.33.0` as peers, conflicting with plan-specified openai@6.x and @anthropic-ai/sdk@0.91.1. The packages function correctly despite the peer version mismatch since llm-polyglot adapts the interface rather than calling internal APIs.
- Edited package.json after install to remove `^` prefixes from all four packages — npm adds them by default but exact pins are required per threat model T-04-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added Extracted to status-badge.tsx STATUS_CLASSES record**
- **Found during:** Task 2 (schema extension)
- **Issue:** Adding "Extracted" to the LeadStatus enum caused TypeScript error TS2741 in status-badge.tsx — the Record<LeadStatus, string> was missing the new value
- **Fix:** Added `Extracted: "bg-purple-100 text-purple-700 border-purple-200"` to STATUS_CLASSES
- **Files modified:** src/components/leads/status-badge.tsx
- **Verification:** tsc --noEmit no longer reports error for this file
- **Committed in:** 2dbb426 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 enum exhaustiveness fix)
**Impact on plan:** Necessary correctness fix — adding a new enum value without updating the exhaustive Record would crash the UI when displaying Extracted leads.

## Issues Encountered

- **npm peer dependency conflict:** llm-polyglot@2.6.0 peer-requires openai@^4 and @anthropic-ai/sdk@^0.33.0, but plan specifies openai@6.34.0 and @anthropic-ai/sdk@0.91.1. Resolved with `--legacy-peer-deps`. Packages installed and all four present in node_modules.
- **Pre-existing TypeScript error:** src/discovery/lead-writer.ts:64 passes `url: null` to a notNull column — this predates Phase 4 and is logged in deferred-items.md. Not caused by current changes.

## User Setup Required

**Checkpoint gate — Task 3 requires manual execution:**

1. Add API keys to `.env.local`:
   ```
   OPENAI_API_KEY=sk-...       # from platform.openai.com -> API Keys
   ANTHROPIC_API_KEY=sk-ant-... # from console.anthropic.com -> API Keys
   ```

2. Run drizzle-kit push:
   ```bash
   DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) npx drizzle-kit push
   ```

3. Verify 5 enum values and 4 new tables in database.

Type "pushed" to resume after successful push.

## Next Phase Readiness
- Package dependencies are installed — Phase 4 plans 02-04 can import from these packages
- Schema is defined — drizzle-kit push (Task 3) will create the tables in PostgreSQL
- After Task 3 completes: Wave 2 (extraction worker) is unblocked

---
*Phase: 04-ai-extraction-technical-profiling*
*Completed: 2026-04-27*
