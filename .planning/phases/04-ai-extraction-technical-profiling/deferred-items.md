# Deferred Items — Phase 04

## Pre-existing TypeScript Error (Out of Scope)

**File**: `src/discovery/lead-writer.ts:64`
**Error**: `url: null` passed to leads insert, but `leads.url` is `.notNull()` in schema
**Discovered during**: Task 2 of plan 04-01 (tsc --noEmit check)
**Status**: Pre-existing before Phase 4 began — not introduced by current changes
**Action needed**: Fix `writeErroredLead` to handle leads with no URL differently (either omit the insert or make url optional in schema)
