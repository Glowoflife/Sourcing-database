# Phase 3: Technical Acquisition Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 3-Technical Acquisition Pipeline
**Areas discussed:** Page discovery strategy, HTML→Markdown conversion, BullMQ trigger & concurrency, Markdown storage model

---

## Page Discovery Strategy

### Q1: How to identify which pages to crawl?

| Option | Description | Selected |
|--------|-------------|----------|
| Link-text matching | Scan homepage `<a>` tags for keywords: 'product', 'about', 'company', 'catalogue' | ✓ |
| Fixed URL probing | Try hardcoded paths: /products, /about, /company, /catalogue | |
| Depth-2 crawl | Follow all homepage links then their links, capped at N pages | |

**User's choice:** Link-text matching
**Notes:** Simple approach that works across different site structures.

### Q2: Maximum pages per manufacturer?

| Option | Description | Selected |
|--------|-------------|----------|
| 3 pages max | Homepage + up to 2 matched pages | |
| 5 pages max | Homepage + up to 4 matched pages | ✓ |
| You decide | Let Claude/researcher pick | |

**User's choice:** 5 pages max
**Notes:** Good for larger sites with multiple product category pages.

### Q3: Error handling for unreachable sites?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry 3x then mark Errored | Crawlee retries, then status=Errored + structured log | ✓ |
| Retry 3x then skip silently | Errored status but no log | |
| Retry once then Errored | Faster throughput, higher error rate | |

**User's choice:** Retry 3x then mark Errored
**Notes:** Consistent with Phase 2 error handling pattern.

---

## HTML→Markdown Conversion

### Q1: Conversion library?

| Option | Description | Selected |
|--------|-------------|----------|
| Readability + Turndown | Mozilla Readability strips boilerplate, Turndown converts to MD | ✓ |
| Turndown only | Direct HTML→MD, no content stripping | |
| node-html-markdown | Faster single-step conversion | |

**User's choice:** Readability + Turndown
**Notes:** Best signal-to-noise ratio for AI extraction; strips nav/footer noise.

### Q2: HTML table handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve as Markdown tables | `<table>` renders as `\| col \| col \|` rows | ✓ |
| Flatten to bullet lists | Tables become flat text | |
| You decide | Let researcher evaluate | |

**User's choice:** Preserve as Markdown tables
**Notes:** Column relationships are critical for CAS numbers, purity %, capacity extraction in Phase 4.

---

## BullMQ Trigger & Concurrency

### Q1: How are acquisition jobs enqueued?

| Option | Description | Selected |
|--------|-------------|----------|
| CLI script | `npm run acquire` reads status=New leads and enqueues | ✓ |
| API endpoint | POST /api/acquire triggers bulk enqueue | |
| Auto-enqueue on discovery | Phase 2 lead writer enqueues on every insert | |

**User's choice:** CLI script
**Notes:** Consistent with Phase 2's `npm run discover` pattern.

### Q2: Concurrency level?

| Option | Description | Selected |
|--------|-------------|----------|
| 3 concurrent workers | 3 domains in parallel, manageable Playwright memory | ✓ |
| 5 concurrent workers | Faster at scale, heavier memory | |
| 1 worker (sequential) | Safest, slowest at 800+ leads | |

**User's choice:** 3 concurrent workers

### Q3: Job resumability?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — BullMQ persistence | Redis-backed job state, crash-resilient | ✓ |
| No — re-enqueue from CLI | Simpler, re-run script skips Crawled leads | |
| You decide | Defer to Claude/researcher | |

**User's choice:** Yes — BullMQ persistence
**Notes:** Essential for 800+ lead runs.

---

## Markdown Storage Model

### Q1: Storage structure?

| Option | Description | Selected |
|--------|-------------|----------|
| One row per page, new DB table | `manufacturer_pages` table, per-page provenance | ✓ |
| One concatenated doc per manufacturer | All pages merged into single string | |
| Files on disk | Write .md files to local directory | |

**User's choice:** One row per page, new `manufacturer_pages` table
**Notes:** Queryable, supports per-page re-extraction in Phase 4.

### Q2: Markdown size cap?

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate at ~20k chars | ~5k tokens, predictable LLM budget | |
| Truncate at ~50k chars | More content, higher Phase 4 cost | |
| No cap — store everything | Full fidelity, Phase 4 handles chunking | ✓ |

**User's choice:** No cap — store everything
**Notes:** Phase 4 is responsible for chunking before LLM calls.

---

## Claude's Discretion

- CSS/heuristics for exact keyword matching strategy on link text
- `page_type` enum values for `manufacturer_pages` (e.g., `homepage`, `products`, `about`, `other`)
- BullMQ queue name and job payload shape
- Redis connection setup details

## Deferred Ideas

- **Proxy rotation** — deferred to hotfix if IP blocking occurs
- **Scheduled/auto acquisition** — deferred to Phase 6+
- **BullMQ queue status UI** — deferred to Phase 5
