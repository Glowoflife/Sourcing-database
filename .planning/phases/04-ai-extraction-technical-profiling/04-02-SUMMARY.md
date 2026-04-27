---
phase: 04-ai-extraction-technical-profiling
plan: "02"
subsystem: extraction
tags: [zod, instructor-js, openai, anthropic, llm-polyglot, schemas, prompt-building]

# Dependency graph
requires:
  - phase: 04-01
    provides: AI extraction packages installed and schema tables created
provides:
  - ExtractionJobSchema and ManufacturerExtractionSchema exported from src/schemas/extraction.ts
  - openAIInstructor and anthropicInstructor exported from src/extraction/instructor-client.ts
  - buildPrompt, CHAR_CAP, BuildPromptResult exported from src/extraction/build-prompt.ts
affects:
  - 04-03-extract-profile (Wave 3 — imports all three files)
  - 04-04-extraction-worker (Wave 4 — uses ExtractionJobSchema for job validation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CAS regex /^\\d{2,7}-\\d{2}-\\d$/ enforced at Zod layer before any DB write"
    - "z.enum(INDUSTRY_TAGS) closed-set enforcement — LLM cannot invent new industry tags"
    - "nullable() vs optional() — instructor serializes nullable as type:[string,null], forcing explicit null from LLM"
    - "Fail-fast env-var guard at module load (mirrors redis.ts pattern for OPENAI_API_KEY)"
    - "anthropicInstructor conditional null — optional fallback, callers must null-check"
    - "D-02 section header format ## [Page Type: pageType] ## — exact bracket/casing locked"
    - "D-03 page-boundary truncation with droppedChars return for caller logging"

key-files:
  created:
    - src/schemas/extraction.ts
    - src/extraction/instructor-client.ts
    - src/extraction/build-prompt.ts
  modified: []

key-decisions:
  - "nullable() not optional() for all LLM-facing nullable fields — forces explicit null in JSON schema, instructor enforces LLM compliance"
  - "INDUSTRY_TAGS uses z.enum closed set — 14 tags prevent LLM hallucinating out-of-taxonomy values"
  - "OPENAI_API_KEY throws at module load (fail-fast); ANTHROPIC_API_KEY is optional (null if absent)"
  - "CHAR_CAP=350,000 chars (87,500 tokens) — 20% safety buffer below GPT-4o-mini 128k token context window"
  - "buildPrompt throws on empty pages array (guard-before-processing pattern from acquisition/index.ts)"

# Metrics
duration: 10min
completed: 2026-04-27
---

# Phase 04 Plan 02: Extraction Schemas, Instructor Clients, and Prompt Builder Summary

**Zod extraction schemas with CAS regex and closed industry taxonomy, instructor-js OpenAI/Anthropic clients with fail-fast env guards, and page priority sort + 350k char truncation prompt builder**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-27T12:36:00Z
- **Completed:** 2026-04-27T12:46:55Z
- **Tasks:** 3 of 3
- **Files created:** 3

## Accomplishments

- Created `src/schemas/extraction.ts` with ExtractionJobSchema, INDUSTRY_TAGS (14-item const), ProductSchema (CAS regex), ContactSchema (type enum), LocationSchema, CapacitySchema, ManufacturerExtractionSchema, and ManufacturerExtraction type
- Created `src/extraction/instructor-client.ts` with openAIInstructor (throws on missing OPENAI_API_KEY) and anthropicInstructor (null if ANTHROPIC_API_KEY absent), both mode:"TOOLS"
- Created `src/extraction/build-prompt.ts` with buildPrompt (D-01/D-02/D-03 locked decisions), CHAR_CAP=350_000, and BuildPromptResult interface

## Task Commits

1. **Task 1: Create src/schemas/extraction.ts** - `d1c03de` (feat)
2. **Task 2: Create src/extraction/instructor-client.ts** - `bdf9649` (feat)
3. **Task 3: Create src/extraction/build-prompt.ts** - `02ea3fa` (feat)

## Files Created/Modified

- `src/schemas/extraction.ts` — BullMQ payload schema + full LLM response schema with sub-schemas, INDUSTRY_TAGS const, ManufacturerExtraction type
- `src/extraction/instructor-client.ts` — Configured instructor clients for OpenAI (required) and Anthropic (optional)
- `src/extraction/build-prompt.ts` — Page concatenation with priority sort, section headers, and 350k char cap truncation

## Decisions Made

- Used `nullable()` not `optional()` for all nullable LLM-facing fields — instructor serializes nullable as `type: ["string", "null"]` in JSON schema, which forces the LLM to explicitly return null rather than omitting the field. Omitted fields cause Zod parse failures in instructor's retry loop.
- INDUSTRY_TAGS uses `z.enum(INDUSTRY_TAGS)` closed set — LLM cannot invent tags outside the 14-item taxonomy. "Other" is a required catch-all so the LLM always has a valid mapping for edge cases.
- buildPrompt guard throws on empty pages array — mirrors the guard-before-processing pattern in `src/acquisition/index.ts` and ensures callers get a clear error rather than silently sending an empty prompt to the LLM API.
- CHAR_CAP set at 350,000 chars (87,500 tokens at 4 chars/token) — provides a 20% safety buffer below GPT-4o-mini's 128k token limit, accounting for system prompt overhead and output tokens.

## Deviations from Plan

None — plan executed exactly as written. All three files match the exact content specified in the plan action blocks and PATTERNS.md. The pre-existing TypeScript error in `src/discovery/lead-writer.ts` (TS2769 — null url, pre-Phase 4) is unchanged and not caused by this plan's changes.

## Known Stubs

None — these are pure logic files (schemas, clients, prompt builder) with no data rendering or hardcoded placeholder values. All fields are either exported constants, Zod schema definitions, or pure functions. No UI components, no mock data, no TODO markers.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model:
- T-04-04 mitigated: OPENAI_API_KEY throws at module load with fixed error string (key value never logged)
- T-04-05 accepted: CHAR_CAP=350,000 enforces DoS boundary on LLM API calls
- T-04-06 mitigated: CAS_REGEX `/^\d{2,7}-\d{2}-\d$/` validates all cas_number values before they can reach the DB

## Self-Check: PASSED

- [x] `src/schemas/extraction.ts` — file exists, ExtractionJobSchema and ManufacturerExtractionSchema exported
- [x] `src/extraction/instructor-client.ts` — file exists, openAIInstructor and anthropicInstructor exported
- [x] `src/extraction/build-prompt.ts` — file exists, buildPrompt, CHAR_CAP, BuildPromptResult exported
- [x] Commits d1c03de, bdf9649, 02ea3fa — all exist in git log
- [x] `npx tsc --noEmit` — no errors in any of the three new files (only pre-existing lead-writer.ts error)

---

*Phase: 04-ai-extraction-technical-profiling*
*Completed: 2026-04-27*
