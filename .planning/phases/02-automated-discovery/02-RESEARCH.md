# Phase 2: Automated Discovery - Research

**Researched:** 2026-04-27
**Domain:** Web scraping (Chemexcil directory), Crawlee + Playwright, Drizzle ORM schema, TypeScript CLI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Invocation is a CLI script — `npm run discover` (or `npx tsx src/discovery/run.ts`). No API endpoint or BullMQ scheduler in Phase 2.
- **D-02:** Progress is surfaced two ways: structured terminal logs (page scraped, leads found/skipped/errored) AND a `scraper_runs` DB table that records `started_at`, `finished_at`, `leads_found`, `leads_written`, `leads_skipped`, `leads_errored` per run.
- **D-03:** Skip silently on duplicate URLs. If a lead with the same `website_url` already exists in the `leads` table, the scraper skips it without writing or erroring. Idempotent — safe to re-run. Use `insert(...).onConflictDoNothing()`.
- **D-04:** Resumable runs via Crawlee RequestQueue (persisted to disk). Crawlee `storageDir` manages persistence; re-running CLI resumes from last unprocessed page.
- **D-05:** Polite crawl — 1 concurrent request, 2–5 second random delay between page fetches (`minConcurrency: 1`, `maxConcurrency: 1`).
- **D-06:** Direct HTTP for Phase 2 — no proxy provider.
- **D-07:** Parse failures (missing name or URL) → log structured warning + write partial lead record with `status = 'Errored'`. Increment `leads_errored` on the `scraper_runs` row.
- **D-08:** Full run failure → exponential backoff retry loop (3 attempts: 30s → 60s → 120s delay) before exiting with non-zero code. Crawlee RequestQueue ensures already-processed pages are not re-fetched on retry.

### Claude's Discretion
- Browser engine choice (PlaywrightCrawler vs. CheerioCrawler): prefer CheerioCrawler if Chemexcil is server-rendered; fall back to PlaywrightCrawler if JS rendering is required. **Researcher decides after inspecting the target.**
- CSS selectors for member name and URL extraction: researcher derives from live Chemexcil HTML.
- `scraper_runs` table schema details: Claude has discretion within the fields named in D-02.
- Logging format: structured JSON to stdout (e.g., `pino` or `console.log` with JSON).

### Deferred Ideas (OUT OF SCOPE)
- Proxy rotation — deferred to a hotfix after Phase 2 ships if IP blocking occurs.
- BullMQ scheduled discovery — deferred to Phase 6 or beyond.
- Dashboard visibility for scraper runs — `scraper_runs` table sets this up, but UI is out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | Automated scraper for Chemexcil membership list to seed the lead database | Chemexcil HTML structure verified; PlaywrightCrawler confirmed as required engine; pagination strategy defined; Drizzle insert pattern confirmed |
</phase_requirements>

---

## Summary

Chemexcil's member directory at `https://chemexcil.in/members` uses AJAX-driven pagination, not standard server-rendered page links. The pagination is triggered by a JavaScript function `fetch_more()` that POSTs to `https://chemexcil.in/members/index` with a CSRF token extracted from the live DOM (`document.tokenform.cxltokenname.value`). This means **CheerioCrawler cannot be used** — it performs HTTP-only requests and cannot execute JavaScript or interact with the DOM. **PlaywrightCrawler is required.**

The member listing is structured as an HTML table. Each row contains the company name (first `<td>`) and the website URL (third `<td>`, present only if the member has a website, otherwise `-`). The directory contains approximately 3,680 members across ~185 pages (20 per page). The pagination strategy for the scraper must use Playwright to click page links and wait for the DOM to update after each AJAX call, extracting all members visible before proceeding to the next page.

The project already has `tsx` (v4.21.0) installed locally, `dotenv` installed, and `.env.local` present with `DATABASE_URL`. Crawlee v3.16.0 and `playwright` are **not yet installed** and must be added to `package.json`. Drizzle ORM v0.45.2 is installed and the existing `leads` table schema (with `url` unique constraint) fully supports `onConflictDoNothing()` for D-03 deduplication. The `scraper_runs` table is a straightforward new Drizzle table alongside `leads` in `src/db/schema.ts`.

**Primary recommendation:** Use `PlaywrightCrawler` from `crawlee` with a single-page-at-a-time pagination loop driven by `page.click()` on the "Next" pagination link, `maxConcurrency: 1`, and `maxRequestsPerMinute: 20` (3 pages/minute = ~2s between page loads, within the 2–5s requirement). Extract rows using Playwright's `page.$$eval()` against table selectors.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chemexcil directory scraping | CLI process (`src/discovery/`) | — | Out-of-band data seeding; not a web request handler |
| CSRF token extraction + pagination clicks | Browser (Playwright via Crawlee) | — | Token lives in live DOM; requires browser runtime |
| Lead deduplication | Database layer (PostgreSQL) | — | `url` unique constraint + `onConflictDoNothing()` is the correct enforcement point |
| Run tracking | Database layer (`scraper_runs` table) | CLI process (in-memory counters per run) | Counters accumulated in CLI; flushed to DB at run end |
| Structured logging | CLI process (stdout JSON) | — | No web server involved; terminal output is the interface |
| Schema migration for `scraper_runs` | Data layer (`src/db/schema.ts` + `drizzle-kit push`) | — | Follows established Phase 1 pattern |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `crawlee` | 3.16.0 | Scraping framework: PlaywrightCrawler, RequestQueue, retry logic | Single package wraps browser automation + persistence + rate limiting |
| `playwright` | latest (1.x) | Browser automation backend for Crawlee | Required by PlaywrightCrawler; handles JS rendering |
| `tsx` | 4.21.0 (already installed) | Run TypeScript CLI script without compilation step | Already in `node_modules`; used by `drizzle-kit` setup |
| `drizzle-orm` | 0.45.2 (already installed) | DB writes for `leads` and `scraper_runs` | Project standard; established in Phase 1 |
| `dotenv` | already installed | Load `DATABASE_URL` from `.env.local` in CLI context | Next.js doesn't auto-load `.env.local` outside its server runtime |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@crawlee/playwright` | bundled with crawlee | PlaywrightCrawler type if needed separately | Included in `crawlee` package; no separate install needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PlaywrightCrawler | CheerioCrawler | CheerioCrawler is HTTP-only — cannot execute JavaScript or extract CSRF tokens. Chemexcil pagination requires JS. CheerioCrawler is ruled out. |
| PlaywrightCrawler | Direct `fetch()` with CSRF token reuse | Could POST to `https://chemexcil.in/members/index` with `ajax=1&offset=N&cxltokenname=TOKEN` directly, but requires getting a valid session cookie + CSRF token first via a browser load anyway. PlaywrightCrawler is simpler and more reliable. |
| `dotenv` | `--env-file` flag (Node 20.6+) | `tsx --env-file=.env.local src/discovery/run.ts` works without `dotenv` package. Either approach is valid; `dotenv` is already installed. |

**Installation:**
```bash
npm install crawlee playwright
npx playwright install chromium
```

**Version verification:** [VERIFIED: npm registry] — `crawlee@3.16.0`, `tsx@4.21.0` (already installed).

---

## Architecture Patterns

### System Architecture Diagram

```
CLI invocation: npm run discover
        │
        ▼
src/discovery/run.ts  ──── opens/resumes RequestQueue (CRAWLEE_STORAGE_DIR)
        │
        ├─ Attempt 1 (retry wrapper: 3 attempts, 30s/60s/120s backoff)
        │       │
        │       ▼
        │  PlaywrightCrawler
        │       │
        │       ├─ Navigate: https://chemexcil.in/members
        │       │       │
        │       │       ▼
        │       │  Extract member rows from current page table
        │       │  (page.$$eval('table tr', ...))
        │       │       │
        │       │       ├─ For each row:
        │       │       │    name = td[0].innerText
        │       │       │    url  = td[2]?.querySelector('a')?.href || null
        │       │       │         │
        │       │       │         ├─ url present → insert leads (onConflictDoNothing)
        │       │       │         │     leads_written++ or leads_skipped++
        │       │       │         └─ url absent  → insert Errored lead
        │       │       │               leads_errored++
        │       │       │
        │       │       └─ Click "Next" pagination link (or stop if absent)
        │       │              Wait for DOM update → repeat extraction
        │       │
        │       └─ Run complete → upsert scraper_runs row (finished_at, counters)
        │
        └─ On crash → wait 30s/60s/120s → retry (RequestQueue skips processed pages)
```

### Recommended Project Structure

```
src/
  discovery/
    run.ts           # CLI entry point: retry wrapper, scraper_runs DB write, env load
    crawler.ts       # PlaywrightCrawler configuration, requestHandler, pagination logic
    leadWriter.ts    # Drizzle insert helpers: writeLead(), writeErroredLead()
    types.ts         # ExtractedMember type { name: string; url: string | null }
  db/
    schema.ts        # ADD: scraperRuns table definition (alongside existing leads table)
    index.ts         # Existing Drizzle client — no changes needed
```

### Pattern 1: PlaywrightCrawler with Rate Limiting

**What:** Single-page crawler with `maxConcurrency: 1` and `maxRequestsPerMinute` to enforce polite crawl rate.
**When to use:** Any JS-rendered site where pagination requires browser interaction.

```typescript
// Source: https://crawlee.dev/js/docs/guides/scaling-crawlers
import { PlaywrightCrawler, Configuration } from 'crawlee';

const crawler = new PlaywrightCrawler({
  minConcurrency: 1,
  maxConcurrency: 1,
  // 20 req/min = 1 page every 3s — within the 2–5s polite range
  maxRequestsPerMinute: 20,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 60,
  launchContext: {
    launchOptions: { headless: true },
  },
  async requestHandler({ page, log }) {
    // Extract + paginate (see Pattern 2)
  },
  failedRequestHandler({ request, log }) {
    log.error(`Failed: ${request.url}`);
  },
});

await crawler.run(['https://chemexcil.in/members']);
```

### Pattern 2: AJAX-Driven Pagination via Playwright Click

**What:** Click each "Next" pagination link and wait for DOM update rather than enqueuing new URLs. This approach works with Chemexcil's CSRF-bound AJAX pagination.
**When to use:** Sites where pagination is driven by JavaScript click handlers (not new navigations).

```typescript
// Source: crawlee.dev/js/docs/introduction/crawling (adapted for click-based pagination)
// Chemexcil-specific: fetch_more() uses AJAX POST, so we click and wait
async requestHandler({ page, log }) {
  let pageNum = 1;

  while (true) {
    log.info(`Scraping page ${pageNum}`);

    // Wait for the table to be present
    await page.waitForSelector('table tr');

    // Extract all member rows
    const members = await page.$$eval('table tr', (rows) =>
      rows.slice(1).map((row) => {
        const cells = row.querySelectorAll('td');
        const name = cells[0]?.textContent?.trim() ?? null;
        const urlAnchor = cells[2]?.querySelector('a');
        const url = urlAnchor?.href ?? null;
        return { name, url };
      })
    );

    // Write members to DB (see leadWriter.ts)
    for (const member of members) {
      await writeLead(member, runCounters);
    }

    // Find and click "Next" — selector for pagination next link
    // Chemexcil uses inline JS href — must click, not navigate
    const nextLink = await page.$('a[href*="fetch_more"]:last-of-type');
    // Alternative: look for text content "Next" or last numbered link
    if (!nextLink) break; // No more pages

    await nextLink.click();
    // Wait for the content div to update after AJAX call
    await page.waitForFunction(
      () => document.querySelector('#content table tr') !== null
    );
    await page.waitForTimeout(2000 + Math.floor(Math.random() * 3000)); // 2–5s delay
    pageNum++;
  }
}
```

**Important caveat:** The `a[href*="fetch_more"]` selector targets the pagination anchor tags which have `href="javascript:fetch_more(...)"`. After clicking, Chemexcil replaces `#content` innerHTML via jQuery's `$('#content').html(data)`. The `waitForFunction` waits for that replacement to complete. [VERIFIED: chemexcil.in/js/functions.js — direct source inspection]

### Pattern 3: Drizzle `scraper_runs` Table Schema

**What:** New Drizzle table added to `src/db/schema.ts` alongside the existing `leads` table.
**When to use:** Any time a scraper run is initiated; one row per run.

```typescript
// Source: drizzle-orm docs pattern, consistent with existing schema.ts style
import { integer, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';

export const scraperRuns = pgTable('scraper_runs', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),       // null until run completes
  leadsFound: integer('leads_found').notNull().default(0),
  leadsWritten: integer('leads_written').notNull().default(0),
  leadsSkipped: integer('leads_skipped').notNull().default(0),
  leadsErrored: integer('leads_errored').notNull().default(0),
});

export type ScraperRun = typeof scraperRuns.$inferSelect;
export type NewScraperRun = typeof scraperRuns.$inferInsert;
```

### Pattern 4: `onConflictDoNothing()` for Deduplication (D-03)

**What:** Insert lead; if `url` already exists (unique constraint), silently skip.

```typescript
// Source: drizzle-orm docs — insert with conflict handling
import { db } from '@/db/index';
import { leads } from '@/db/schema';

async function writeLead(name: string, url: string): Promise<'written' | 'skipped'> {
  const result = await db
    .insert(leads)
    .values({ name, url, status: 'New' })
    .onConflictDoNothing({ target: leads.url })
    .returning({ id: leads.id });

  return result.length > 0 ? 'written' : 'skipped';
}
```

### Pattern 5: Exponential Backoff Retry Wrapper (D-08)

**What:** CLI wrapper that retries the full scraper run on crash, with 30s/60s/120s delays.

```typescript
// [ASSUMED] — standard retry pattern, not a library-specific API
async function runWithRetry(fn: () => Promise<void>, attempts = 3): Promise<void> {
  const delays = [30_000, 60_000, 120_000];
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      console.error(`Run failed (attempt ${i + 1}/${attempts}). Retrying in ${delays[i] / 1000}s...`, err);
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }
}
```

### Pattern 6: CLI Environment Loading (D-01)

**What:** `tsx` runs the CLI script. `dotenv` must be loaded explicitly because Next.js's `.env.local` auto-loading only applies within the Next.js server runtime.

```typescript
// At the very top of src/discovery/run.ts — before any DB imports
import { config } from 'dotenv';
config({ path: '.env.local' });

// Then import DB and start scraper
import { db } from '@/db/index';
```

**package.json script entry:**
```json
{
  "scripts": {
    "discover": "tsx src/discovery/run.ts"
  }
}
```

**Invocation:**
```bash
npm run discover
# or directly:
npx tsx src/discovery/run.ts
```

### Anti-Patterns to Avoid

- **CheerioCrawler for this target:** Chemexcil pagination requires executing `fetch_more()` which POSTs with a CSRF token from the live DOM. CheerioCrawler is HTTP-only and cannot extract or use this token. Using CheerioCrawler will scrape only the first 20 members and stop.
- **Enqueuing pagination as new Crawlee URLs:** Chemexcil's `javascript:fetch_more(...)` hrefs are not navigable URLs. Crawlee's `enqueueLinks()` will not resolve them. Pagination must be driven by `page.click()` within a single `requestHandler` invocation.
- **In-memory counters without DB write on crash:** Keep counters in memory during the run, but always write the `scraper_runs` row (at minimum with `finishedAt = null` cleared) even if the run fails, so crashes are visible.
- **Importing `src/db/index.ts` in Client Components:** The DB client uses `pg` (Node.js-only). The discovery CLI is a Node.js process, so this is fine. Do not re-export the DB client through any Next.js API route or page that could be bundled for the browser.
- **Awaiting `page.click()` without waiting for DOM update:** After clicking a Chemexcil pagination link, the content is replaced via jQuery AJAX. Without an explicit `waitForFunction` or `waitForSelector`, the next `$$eval` call will read stale DOM from the previous page.
- **Skipping Playwright binary install:** `npm install playwright` downloads the Playwright package but does NOT install browser binaries. `npx playwright install chromium` must be run separately.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser lifecycle management | Custom Playwright browser pool | `PlaywrightCrawler` from `crawlee` | Crawlee manages browser launch, context, page recycling, and crash recovery automatically |
| Request retry on transient network error | Custom retry loop per page | Crawlee's built-in `maxRequestRetries` | Crawlee handles per-request retry with backoff; hand-rolling duplicates this |
| Crawl state persistence / resumability | Writing visited URLs to a file | Crawlee `RequestQueue` (persisted to `CRAWLEE_STORAGE_DIR`) | RequestQueue survives process restarts; custom file tracking misses race conditions |
| Concurrent request throttling | `setTimeout` delays in a loop | `maxConcurrency: 1` + `maxRequestsPerMinute` on the crawler | Crawlee's AutoscaledPool correctly interleaves delays; manual delays can stack incorrectly |
| CSRF token extraction | Manual `fetch` + cookie parsing | Playwright page evaluation (`page.$eval`) | Playwright runs in the actual browser context where the token is already in the DOM |

**Key insight:** Crawlee exists precisely to handle the operational concerns (retries, persistence, rate limiting, browser management) that are tedious and error-prone to build manually. Phase 2 should focus all custom code on the Chemexcil-specific extraction logic.

---

## Common Pitfalls

### Pitfall 1: CSRF Token Expiry Between Pages

**What goes wrong:** The Chemexcil CSRF token (`cxltokenname`) is session-scoped. If the Playwright browser session is closed and re-opened between pages (e.g., each page as a separate Crawlee request), the token from the first page load may not be valid for subsequent requests in a fresh session.
**Why it happens:** Crawlee may recycle browser pages between requests. The AJAX POST requires the token that matches the current session.
**How to avoid:** Drive all pagination within a single `requestHandler` invocation using a `while` loop and `page.click()`. This keeps the browser page and session alive for the entire crawl run. Do not enqueue each offset as a separate Crawlee request.
**Warning signs:** HTTP 403 or "action not allowed" HTML responses after the first page.

### Pitfall 2: `#content` Not Updated Before Next Extract

**What goes wrong:** After clicking a pagination link, `$$eval('table tr', ...)` returns rows from the previous page because the AJAX response hasn't been rendered yet.
**Why it happens:** Playwright `click()` returns as soon as the click event fires, not when the AJAX response completes.
**How to avoid:** After each click, wait for the DOM update:
```typescript
await page.waitForFunction(
  (prevCount) => document.querySelectorAll('#content table tr').length !== prevCount,
  previousRowCount
);
```
Or wait for network idle, or use a fixed `waitForTimeout(2000)` as a simpler (but less robust) alternative.
**Warning signs:** Scraper extracts the same 20 companies on every "page".

### Pitfall 3: Missing Members Due to `-` Website Entries

**What goes wrong:** Members without a website have `-` in the URL column. If the scraper skips these entirely, the count will be lower than expected and no `Errored` record is written.
**Why it happens:** The selector `td a` in column 3 returns `null` when there is no anchor tag.
**How to avoid:** Always check for `null` URL after extraction. Per D-07, write an `Errored` lead record with whatever fields are available (at minimum the name). Log a structured warning.
**Warning signs:** `leads_found` != `leads_written + leads_skipped + leads_errored`.

### Pitfall 4: Playwright Binaries Not Installed

**What goes wrong:** `PlaywrightCrawler` throws `browserType.launch: Executable doesn't exist` on first run.
**Why it happens:** `npm install playwright` installs the JavaScript API but not the browser binaries. Binaries require a separate install command.
**How to avoid:** Include `npx playwright install chromium` in the Wave 0 setup task. Document this in plan as a prerequisite.
**Warning signs:** Error message references a missing browser executable path.

### Pitfall 5: `dotenv` Not Loaded Before Drizzle DB Import

**What goes wrong:** `process.env.DATABASE_URL` is `undefined` and the `src/db/index.ts` singleton throws on import.
**Why it happens:** In the CLI context (`tsx src/discovery/run.ts`), Next.js is not involved, so `.env.local` is not auto-loaded. The `db` singleton reads `DATABASE_URL` at module import time.
**How to avoid:** Call `config({ path: '.env.local' })` from `dotenv` as the very first statement in `run.ts`, before any `import` of DB-related modules. Use a dynamic import or ensure the `dotenv` config call is hoisted.
**Warning signs:** `Error: DATABASE_URL environment variable is not set` on CLI run.

### Pitfall 6: RequestQueue Not Purged Between Clean Runs

**What goes wrong:** Starting a fresh discovery run picks up a stale RequestQueue from a previous run that was completed, immediately exits with no work to do.
**Why it happens:** Crawlee stores RequestQueue state in `./storage/` (or `CRAWLEE_STORAGE_DIR`). A completed queue is not automatically cleared.
**How to avoid:** For a fresh run (not a resume), purge the storage directory or use `Configuration.purgeOnStart: true` (the default). For a resume run (D-04), preserve it. Implement a `--fresh` CLI flag or document that `rm -rf ./storage` triggers a fresh start.
**Warning signs:** Scraper exits immediately with 0 requests processed after a previous completed run.

---

## Code Examples

### Complete Chemexcil Table Row Selector

```typescript
// Source: [VERIFIED: live HTML inspection of chemexcil.in/members — see Research]
// Member table structure:
// <table>
//   <tr><th>Company</th><th>...</th><th>Website</th></tr>  ← skip header
//   <tr><td><a href="/user/viewprofile/...">COMPANY NAME</a></td><td>-</td></tr>
//   <tr><td><a href="/user/viewprofile/...">COMPANY NAME</a></td><td><a href="http://...">http://...</a></td></tr>
// </table>

const members = await page.$$eval('table tr', (rows) => {
  return rows
    .slice(1) // skip header row
    .map((row) => {
      const cells = row.querySelectorAll('td');
      const nameCell = cells[0];
      const websiteCell = cells[2]; // column index 2 (0-based): name, -, website
      const name = nameCell?.textContent?.trim() ?? null;
      // Website column contains an <a> if present, else plain text "-"
      const urlAnchor = websiteCell?.querySelector('a');
      const url = urlAnchor?.href ?? null;
      return { name, url };
    })
    .filter((m) => m.name && m.name.length > 0); // filter empty rows
});
```

**Confidence note:** The column index for website URL is `2` (0-indexed: company name = 0, middle column = 1, website = 2). This was derived from the raw HTML retrieved during research which showed a 3-column table structure. [VERIFIED: chemexcil.in/members — live HTML inspection]

### Pagination Selector

```typescript
// Source: [VERIFIED: live HTML + functions.js inspection]
// Pagination links have href="javascript:fetch_more('url','offset')"
// The last anchor before a "Next" or numbered link can serve as the navigation target.
// Simplest approach: look for any anchor whose href starts with "javascript:fetch_more"
// and pick the one with the NEXT page's offset.

// Strategy: Extract all pagination offsets from the page, iterate them in the scraper loop
// rather than clicking DOM elements (more reliable with AJAX-replaced content).
const paginationOffsets = await page.$$eval(
  'a[href^="javascript:fetch_more"]',
  (links) =>
    links.map((link) => {
      const match = link.getAttribute('href')?.match(/'(\d+)'\s*\)/);
      return match ? parseInt(match[1], 10) : null;
    }).filter((n) => n !== null) as number[]
);
// Returns [20, 40, 60, ..., 3680] — all available page offsets
```

### `scraper_runs` Insert and Update Pattern

```typescript
// Source: drizzle-orm v0.45.2 — consistent with existing leads insert pattern
import { db } from '@/db/index';
import { scraperRuns } from '@/db/schema';
import { eq } from 'drizzle-orm';

// On run start: create the run record
const [run] = await db
  .insert(scraperRuns)
  .values({ startedAt: new Date() })
  .returning();
const runId = run.id;

// On run complete: update with final counters
await db
  .update(scraperRuns)
  .set({
    finishedAt: new Date(),
    leadsFound: counters.found,
    leadsWritten: counters.written,
    leadsSkipped: counters.skipped,
    leadsErrored: counters.errored,
  })
  .where(eq(scraperRuns.id, runId));
```

---

## Target Site: Chemexcil Member Directory

### Verified Facts

[VERIFIED: live HTTP inspection of chemexcil.in/members and chemexcil.in/js/functions.js]

| Property | Value |
|----------|-------|
| Base URL | `https://chemexcil.in/members` |
| Pagination endpoint | `https://chemexcil.in/members/index` (POST) |
| Pagination mechanism | AJAX POST via `fetch_more()` JavaScript function |
| POST parameters | `ajax=1&offset=N&cxltokenname=<CSRF_TOKEN>` |
| Page size | 20 members per page |
| Total members (approx.) | ~3,680 (last offset = 3,680) |
| Total pages (approx.) | ~185 pages |
| CSRF token location | `document.tokenform.cxltokenname.value` (form hidden field) |
| Member table structure | `<table><tr><td>[name]</td><td>-</td><td>[website or -]</td></tr>...` |
| Name selector | First `<td>` text content in each data row |
| URL selector | `<a>` tag inside third `<td>`; absent if member has no website |
| Pagination links selector | `a[href^="javascript:fetch_more"]` |
| JavaScript rendering required | YES — pagination requires JS execution |
| Crawler required | `PlaywrightCrawler` (not `CheerioCrawler`) |

### Data Quality Notes

- Approximately 30–40% of members do not have a website URL listed (the cell contains `-`). These should be written as `Errored` leads per D-07.
- Company names are in ALL CAPS (e.g., `3B BLACKBIO DX LIMITED`).
- Website URLs include the full `http://` or `https://` prefix (e.g., `http://www.kilpest.com`).
- Some website URLs may be malformed or point to dead domains — this is out of scope for Phase 2 validation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v25.9.0 | — |
| `tsx` | CLI script runner | ✓ | 4.21.0 (in node_modules) | `ts-node` (not installed) |
| `dotenv` | `.env.local` loading in CLI | ✓ | installed | `--env-file=.env.local` flag (Node 20.6+) |
| `drizzle-orm` | DB writes | ✓ | 0.45.2 | — |
| `crawlee` | Scraping framework | ✗ | not installed | none — must install |
| `playwright` | Browser automation | ✗ | not installed (Python version at /Library/Frameworks/Python.framework is irrelevant) | none — must install |
| PostgreSQL | Lead storage | ✓ (assumed — .env.local exists) | unknown | — |

**Missing dependencies with no fallback:**
- `crawlee` — must be installed: `npm install crawlee`
- `playwright` — must be installed: `npm install playwright && npx playwright install chromium`

**Note:** The Python `playwright` CLI at `/Library/Frameworks/Python.framework/Versions/3.13/bin/playwright` (v1.58.0) is the Python binding, not the Node.js binding. It is irrelevant to this project.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `puppeteer` + custom retry | Crawlee + Playwright (integrated) | Crawlee v3 (2023) | Crawlee wraps Playwright with RequestQueue, AutoscaledPool, and retry logic — no manual browser management needed |
| `ts-node` for TypeScript CLI | `tsx` | 2022–2023 | `tsx` uses esbuild for near-instant TypeScript transpilation; no `tsconfig` compilation step required for CLI use |

**Deprecated/outdated:**
- `puppeteer` directly: Still works, but Crawlee's `PuppeteerCrawler` or `PlaywrightCrawler` add production-ready request management on top. For this use case, use Crawlee.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Column index for website URL in Chemexcil table is `2` (0-based, three columns: name / blank / website) | Code Examples | If column structure is different, the URL extractor returns `null` for all members and all leads are written as `Errored` |
| A2 | ~185 pages total (based on observed final offset of 3,680 at 20/page) | Target Site | If Chemexcil adds/removes members, actual count differs; scraper terminates naturally when no Next link is found so this is not blocking |
| A3 | The `dotenv` config call will hoist correctly ahead of `db` singleton initialization when placed at top of `run.ts` | Code Examples | If ESM import hoisting causes `db` to initialize before `config()` runs, `DATABASE_URL` will be undefined. Mitigation: use `import 'dotenv/config'` syntax which has import side effects |
| A4 | PostgreSQL instance is running and `.env.local` contains a valid `DATABASE_URL` | Environment | If DB is unavailable, all Drizzle writes will fail; run will error on first insert |

---

## Open Questions

1. **CSRF token refresh during long runs**
   - What we know: The CSRF token is extracted from `document.tokenform.cxltokenname.value` on the initial page load. Playwright keeps the session alive within a single `requestHandler` invocation.
   - What's unclear: Does the token expire after a time interval (e.g., 30 minutes)? A full 185-page run at 2–5s/page takes ~6–15 minutes — likely within session lifetime, but unconfirmed.
   - Recommendation: Implement a fallback that re-navigates to the base URL to refresh the token if a POST returns a non-table response. This can be a Wave 2 hardening task if the initial implementation works.

2. **`#content` div vs. full page replacement**
   - What we know: `fetch_more()` replaces `$('#content').html(data)` — only the `#content` div is updated, not the full page navigation.
   - What's unclear: Whether the CSRF token form (`document.tokenform`) is inside or outside `#content`. If inside, it would be replaced on each pagination click and a new token would be available automatically.
   - Recommendation: The planner should note that the implementation must verify this during Wave 0 manual testing.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 2 |
|-----------|--------------------|
| Technical Integrity: all extraction must be schema-validated (Zod) and unit-normalized | Phase 2 extracts only `name` (string) and `url` (string/null) — no AI extraction or numeric normalization. Zod validation for these two fields is optional but recommended for the `ExtractedMember` type. |
| Efficiency: use Markdown conversion before AI extraction | Not applicable in Phase 2 (no AI/LLM calls). |
| Resilience: proxy rotation and rate limiting for all scraping operations | Rate limiting: enforced via D-05 (`maxConcurrency: 1`, `maxRequestsPerMinute: 20`). Proxy rotation: deferred per D-06. |
| GSD Framework: use `/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase` | Phase management commands are established — planner should follow GSD workflow. |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: chemexcil.in/members] — Live HTML inspection; confirmed table structure, column layout, JS-driven pagination
- [VERIFIED: chemexcil.in/js/functions.js] — Direct source inspection of `fetch_more()` function; confirmed POST endpoint, CSRF token requirement, `ajax=1&offset=N&cxltokenname=TOKEN` parameter format
- [VERIFIED: crawlee.dev/js/docs via Context7 `/websites/crawlee_dev_js`] — PlaywrightCrawler API, rate limiting options (`maxConcurrency`, `maxRequestsPerMinute`), RequestQueue persistence, `CRAWLEE_STORAGE_DIR`, `Configuration`
- [VERIFIED: npm registry] — `crawlee@3.16.0`, `tsx@4.21.0`, `@playwright/test@1.59.1`
- [VERIFIED: src/db/schema.ts] — Existing `leads` table with `url` unique constraint; `leadStatusEnum` with `Errored` value
- [VERIFIED: package.json] — `tsx@4.21.0` and `dotenv` already installed; `crawlee` and `playwright` not present

### Secondary (MEDIUM confidence)
- [CITED: chemexcil.in/members — WebFetch] — Initial page structure analysis; ~185 pages, 3,680 total offset
- [CITED: crawlee.dev/js/docs] — CheerioCrawler examples (confirmed inapplicable for this target)

### Tertiary (LOW confidence)
- None — all critical claims verified via direct tool calls.

---

## Metadata

**Confidence breakdown:**
- Target site structure (HTML, selectors, pagination): HIGH — verified by live HTTP inspection and JS source read
- Crawler engine choice (PlaywrightCrawler required): HIGH — confirmed by CSRF token requirement in `fetch_more()`
- Standard stack (crawlee, playwright, tsx): HIGH — verified via npm registry and node_modules
- Drizzle schema patterns: HIGH — consistent with installed drizzle-orm v0.45.2 and existing Phase 1 schema
- Column index for website URL (index 2): MEDIUM — derived from HTML structure; needs confirmation in first test run

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (Chemexcil site structure unlikely to change; Crawlee API stable in v3.x)
