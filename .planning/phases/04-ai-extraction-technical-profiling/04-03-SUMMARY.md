---
phase: 04-ai-extraction-technical-profiling
plan: "03"
subsystem: extraction
tags: [anthropic, openai, drizzle, bullmq, zod, idempotency]

requires:
  - phase: 04-02
    provides: extraction schemas, instructor client, prompt builder
provides:
  - extractProfile() LLM call layer with schema-validated extraction responses
  - runExtractionJob() DB transaction layer for manufacturer profile persistence
  - Idempotent profile upsert + child-row replacement on re-extraction
affects:
  - 04-04-extraction-worker

key-files:
  created:
    - src/extraction/extract-profile.ts
    - src/extraction/index.ts
  modified: []

completed: 2026-04-27
---

# Phase 04 Plan 03: Extraction Call Layer and Job Handler Summary

**Implemented the core extraction pipeline: prompt assembly + validated LLM extraction in `extract-profile.ts`, and atomic DB orchestration in `index.ts` for profile upsert, child-row replacement, and `Crawled -> Extracted / Errored` status transitions.**

## Accomplishments

- Created `src/extraction/extract-profile.ts` with a purpose-built chemical extraction system prompt, prompt truncation warning, Anthropic-native tool-call extraction with Zod validation/retry, OpenAI fallback support, and plain-`Error` normalization
- Created `src/extraction/index.ts` with `runExtractionJob({ leadId })`, loading `manufacturer_pages`, calling `extractProfile()`, and writing `manufacturer_profiles`, `products`, `contacts`, and `locations` in a single Drizzle transaction
- Implemented `onConflictDoUpdate` on `manufacturer_profiles.lead_id` plus delete-before-reinsert for child rows so repeated extraction runs are idempotent
- Preserved the Phase 3 error-handling pattern: nested recovery for status-update failures, structured error logging, and `throw err` so BullMQ records the job failure correctly

## Notable Implementation Detail

- The page fetch and empty-page guard were kept inside the main `try` block so missing `manufacturer_pages` rows also transition the lead to `Errored` instead of leaving it stuck in `Crawled`

## Verification

- `npm run typecheck` passes after the implementation
- All new imports use `@/` aliases
- `extractProfile()` and `runExtractionJob()` exports are present and wired together
- `runExtractionJob()` includes `db.transaction()`, `onConflictDoUpdate`, child-row deletes, and `Extracted` / `Errored` status transitions

## Self-Check: PASSED

---
*Phase: 04-ai-extraction-technical-profiling*
*Completed: 2026-04-27*
