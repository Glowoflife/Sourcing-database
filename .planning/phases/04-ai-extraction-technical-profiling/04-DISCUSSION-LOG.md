# Phase 4: AI Extraction & Technical Profiling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 4-AI Extraction & Technical Profiling
**Areas discussed:** Multi-page merge strategy

---

## Multi-Page Merge Strategy

### Q1: How should Phase 4 handle multiple Markdown pages per manufacturer?

| Option | Description | Selected |
|--------|-------------|----------|
| Concat all pages, one LLM call | Concatenate all pages into one prompt and extract the full profile in a single call. Simpler job design, better cross-page reasoning. Risk: large manufacturers may exceed context window. | ✓ |
| Per-page extraction, merge in code | Extract fields independently from each page, then merge in application logic. More reliable for large sites but requires dedup logic. | |
| Prioritize pages by type, one call | Send only highest-value pages (products first, then about, then homepage as fallback). Keeps token cost low. | |

**User's choice:** Concat all pages, one LLM call
**Notes:** Single call per manufacturer with cross-page context reasoning.

---

### Q2: Fallback when combined pages exceed the LLM context window?

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate to fit | Prioritize pages by type (products > about > homepage > other), truncate at character limit. Log warning with lead ID and dropped char count. | ✓ |
| Drop lowest-priority pages | Exclude 'other' pages first, then 'homepage' if still too large. No truncation within a page. | |
| You decide | Claude picks the safest approach. | |

**User's choice:** Truncate to fit
**Notes:** Log structured warning `{ leadId, url, droppedChars }` for auditability.

---

### Q3: Page ordering in the concatenated prompt?

| Option | Description | Selected |
|--------|-------------|----------|
| Products first, then about, homepage last | Put information-dense page first. LLMs weight early context more heavily. | |
| Homepage first, in crawl order | Natural site structure. Mirrors how a human reads a site. | ✓ |
| You decide | Claude picks based on extraction goals. | |

**User's choice:** Homepage first, in crawl order
**Notes:** Preserves natural site reading order.

---

### Q4: Include page-type section headers in the concatenated prompt?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — section headers with page type | Prepend each page with `## [Page Type: {page_type}] ##`. Helps LLM attribute data to correct source page. | ✓ |
| No — concatenate raw Markdown only | Join Markdown strings with separator. Simpler, less token overhead. LLM infers context from content. | |

**User's choice:** Yes — section headers with page type
**Notes:** Format: `## [Page Type: products] ##` using lowercase enum value.

---

## Claude's Discretion

- **LLM provider and model selection** — not discussed. Claude has discretion per STACK.md guidance (GPT-4o-mini primary, Claude 3.5 Sonnet for complex fields).
- **Profile DB schema design** — not discussed. Claude has discretion per ARCHITECTURE.md (normalized tables for products, contacts, locations).
- **BullMQ extraction worker design** — not discussed. Claude has discretion following `acquisition.worker.ts` pattern.
- **Industries Served taxonomy** — not discussed. Claude derives reasonable tag set from Indian chemical industry domain.
- **Unit normalization approach** — not discussed. Claude decides between prompt-based or Zod transform.
- **Character cap for context window** — not discussed. Claude determines safe limit based on chosen model.

## Deferred Ideas

- Semantic response cache via ioredis — defer to Phase 4 hotfix if extraction costs become a concern.
- Scheduled/automatic extraction with BullMQ parent-child flow — defer to Phase 6+.
- PubChem CAS verification (TECH-02) — v2, out of scope.
- GSTIN validation (TECH-03) — v2, out of scope.
- Reliability scoring (TECH-04) — v2, out of scope.
