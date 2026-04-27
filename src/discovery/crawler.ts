import { PlaywrightCrawler } from "crawlee";
import { writeErroredLead, writeLead } from "@/discovery/lead-writer";
import { ExtractedMemberSchema } from "@/discovery/types";
import { logger } from "@/lib/logger";
import type { RunCounters } from "@/discovery/lead-writer";

export async function runCrawler(counters: RunCounters): Promise<void> {
  const crawler = new PlaywrightCrawler({
    // D-05: polite crawl — single concurrent request, max 20 req/min (= ~3s/page)
    minConcurrency: 1,
    maxConcurrency: 1,
    maxRequestsPerMinute: 20,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 120,
    launchContext: {
      launchOptions: { headless: true },
    },

    async requestHandler({ page, log }) {
      let pageNum = 1;

      while (true) {
        log.info(`Scraping page ${pageNum}`);

        // Wait for the member table to be present before extracting
        await page.waitForSelector("#content table tr", { timeout: 30_000 });

        // Extract all member rows — verified selector from RESEARCH.md Code Examples
        // Column layout: [0] company name, [1] middle column, [2] website URL
        const rawMembers = await page.$$eval("#content table tr", (rows) =>
          rows
            .slice(1) // skip header row
            .map((row) => {
              const cells = row.querySelectorAll("td");
              const name = cells[0]?.textContent?.trim() ?? null;
              const urlAnchor = cells[2]?.querySelector("a");
              const url = urlAnchor?.href ?? null;
              return { name, url };
            })
            .filter((m) => m.name && m.name.length > 0),
        );

        // Validate and write each member
        for (const raw of rawMembers) {
          const parsed = ExtractedMemberSchema.safeParse(raw);

          if (!parsed.success) {
            // name present but url failed Zod validation (malformed href) — treat as errored
            await writeErroredLead(
              raw.name,
              pageNum,
              `zod_validation_failed: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
              counters,
            );
            continue;
          }

          const member = parsed.data;

          if (member.url === null) {
            // Member has no website — D-07: write Errored record
            await writeErroredLead(member.name, pageNum, "missing_url", counters);
          } else {
            // Member has a URL — write New lead, dedup via onConflictDoNothing (D-03)
            await writeLead({ name: member.name, url: member.url }, counters);
          }
        }

        logger.info({
          stage: "discovery",
          status: "ok",
          message: `page=${pageNum} extracted=${rawMembers.length} written=${counters.written} skipped=${counters.skipped} errored=${counters.errored}`,
        });

        // --- Pagination: find the next page offset ---
        // Chemexcil pagination uses javascript:fetch_more('url','offset') anchors
        // Strategy: extract all available offsets, determine the next one to click
        const allOffsets = await page.$$eval(
          "a[href^=\"javascript:fetch_more\"]",
          (links) =>
            links
              .map((link) => {
                const match = link.getAttribute("href")?.match(/'(\d+)'\s*\)/);
                return match ? parseInt(match[1], 10) : null;
              })
              .filter((n): n is number => n !== null),
        );

        if (allOffsets.length === 0) {
          log.info("No more pagination links found. Crawl complete.");
          break;
        }

        // Current page displays offset = (pageNum - 1) * 20.
        // The next page link is the smallest offset greater than the current page's start.
        const currentOffset = (pageNum - 1) * 20;
        const nextOffset = allOffsets
          .filter((o) => o > currentOffset)
          .sort((a, b) => a - b)[0];

        if (nextOffset === undefined) {
          log.info("No next page offset found. Crawl complete.");
          break;
        }

        // Record the current row count to detect DOM update after click (Pitfall 2 mitigation)
        const prevRowCount = await page.$$eval("#content table tr", (rows) => rows.length);

        // Click the anchor for the next offset
        const nextLink = await page.$(`a[href*="${nextOffset}"]`);
        if (!nextLink) {
          log.warning(`Could not find anchor for offset ${nextOffset}. Stopping.`);
          break;
        }

        await nextLink.click();

        // Wait for AJAX response: row count must change to indicate DOM update
        // Pitfall 2: must wait for #content to be replaced before next $$eval
        await page.waitForFunction(
          (prev) => {
            const rows = document.querySelectorAll("#content table tr");
            return rows.length !== prev;
          },
          prevRowCount,
          { timeout: 30_000 },
        );

        // D-05: 2-5s random delay between pages (on top of maxRequestsPerMinute)
        const delayMs = 2_000 + Math.floor(Math.random() * 3_000);
        await page.waitForTimeout(delayMs);

        pageNum++;
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request failed permanently: ${request.url}`);
    },
  });

  // D-04: Crawlee RequestQueue is persisted to ./storage by default (CRAWLEE_STORAGE_DIR)
  // Re-running after interruption resumes from the last unprocessed page.
  // For a fresh run, purgeOnStart (Crawlee default) clears a completed queue automatically.
  await crawler.run(["https://chemexcil.in/members"]);
}
