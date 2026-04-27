# Phase 2: Automated Discovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 2-Automated Discovery
**Areas discussed:** Trigger & visibility, Re-run behavior, Rate limiting & proxy, Failure surface

---

## Trigger & Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| CLI script | `npm run discover` / `npx tsx src/discovery/run.ts` from terminal | ✓ |
| Next.js API endpoint | POST /api/discovery/start — requires background process management from Next.js | |
| Scheduled BullMQ job | Cron-style job, fully automated, requires Redis + worker 24/7 | |

**User's choice:** CLI script

| Option | Description | Selected |
|--------|-------------|----------|
| Terminal logs only | Structured console output, no dashboard changes in Phase 2 | |
| Terminal logs + DB timestamps | Log to terminal AND write last_run_at / leads_found_count to scraper_runs table | ✓ |
| You decide | Claude picks simplest logging approach | |

**User's choice:** Terminal logs + DB timestamps

**Notes:** scraper_runs table should store enough data for a future dashboard widget without re-querying leads.

---

## Re-run Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Skip silently | If URL exists, skip. Idempotent — safe to run multiple times. | ✓ |
| Upsert | Update company name if URL exists. Risks overwriting manual edits. | |
| Always insert, flag duplicates | Insert every time, let unique constraint catch duplicates. | |

**User's choice:** Skip silently

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — resumable runs | Use Crawlee's built-in RequestQueue (persisted to disk) to resume interrupted runs | ✓ |
| No — always start fresh | Restart from page 1 each run. Simpler but re-scrapes everything. | |

**User's choice:** Yes — resumable runs

---

## Rate Limiting & Proxy

| Option | Description | Selected |
|--------|-------------|----------|
| Polite crawl — 2–5s delay | 1 concurrent request, 2–5s delay. Very unlikely to get blocked. | ✓ |
| Moderate — 1–2s delay | Slightly faster, still respectful. | |
| Aggressive — no artificial delay | Crawlee defaults (fast). Higher IP block risk without proxy. | |

**User's choice:** Polite crawl — 2–5s delay

| Option | Description | Selected |
|--------|-------------|----------|
| Direct for now, proxy later | Start without proxy, add rotation as hotfix if needed. | ✓ |
| Proxy from day one | Wire proxy provider into Crawlee before Phase 2 ships. | |

**User's choice:** Direct for now, proxy later

---

## Failure Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Log & skip — terminal warning | Log warning, skip unparseable entry, continue run. | |
| Log & write error record to DB | Write partial lead with status=Errored + increment leads_errored in scraper_runs. | ✓ |
| Halt the run | Treat parse failures as fatal. | |

**User's choice:** Log & write error record to DB

| Option | Description | Selected |
|--------|-------------|----------|
| Exit and log — re-run manually | Log error and exit. User re-runs CLI. | |
| Auto-retry with exponential backoff | 3 attempts: 30s → 60s → 120s delay before exiting non-zero. | ✓ |

**User's choice:** Auto-retry with exponential backoff

---

## Claude's Discretion

- Browser engine: CheerioCrawler (HTTP) vs PlaywrightCrawler — decide after inspecting Chemexcil HTML
- CSS selectors for member name/URL extraction
- `scraper_runs` table schema column details (within the fields named in D-02)
- Logging library (pino vs console.log JSON)

## Deferred Ideas

- Proxy rotation — deferred to hotfix if IP blocking occurs
- BullMQ scheduled discovery — deferred to Phase 6 or beyond
- Dashboard UI for scraper runs — `scraper_runs` table enables it but UI is out of scope
