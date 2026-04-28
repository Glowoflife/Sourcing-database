import { PlaywrightCrawler } from "crawlee";
import { writeErroredLead, writeLead } from "@/discovery/lead-writer";
import { ExtractedMemberSchema } from "@/discovery/types";
import { logger } from "@/lib/logger";
import type { RunCounters } from "@/discovery/lead-writer";

declare global {
  interface Window {
    fetch_more?: (url: string, offset: string) => void;
  }
}

export async function runCrawler(counters: RunCounters): Promise<void> {
  const crawler = new PlaywrightCrawler({
    // D-05: polite crawl — single concurrent request, max 20 req/min (= ~3s/page)
    minConcurrency: 1,
    maxConcurrency: 1,
    maxRequestsPerMinute: 20,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 600,
    launchContext: {
      launchOptions: { headless: true },
    },

    async requestHandler({ page, log }) {
      let pageNum = 1;

      while (true) {
        log.info(`Scraping page ${pageNum}`);

        // Wait for the member rows to be present
        await page.waitForSelector("table.time-table tr.griderow1, table.time-table tr.griderow2", {
          timeout: 30_000,
        });

        // 2026 layout: 2-column table — [0] company name + profile link, [1] website URL or "-"
        const rawMembers = await page.$$eval(
          "table.time-table tr.griderow1, table.time-table tr.griderow2",
          (rows) =>
            rows.map((row) => {
              const cells = row.querySelectorAll("td");
              const name = cells[0]?.textContent?.trim() ?? null;
              const websiteAnchor = cells[1]?.querySelector("a");
              const cellText = cells[1]?.textContent?.trim() ?? "";
              const url = websiteAnchor?.href ?? null;
              return { name, url, hasNoUrl: cellText === "-" || cellText === "" };
            }),
        );

        for (const raw of rawMembers) {
          if (!raw.name) {
            await writeErroredLead(null, pageNum, "missing_name", counters);
            continue;
          }
          if (raw.hasNoUrl || !raw.url) {
            await writeErroredLead(raw.name, pageNum, "missing_url", counters);
            continue;
          }

          const parsed = ExtractedMemberSchema.safeParse({ name: raw.name, url: raw.url });
          if (!parsed.success) {
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
            await writeErroredLead(member.name, pageNum, "missing_url", counters);
          } else {
            await writeLead({ name: member.name, url: member.url }, counters);
          }
        }

        logger.info({
          stage: "discovery",
          status: "ok",
          message: `page=${pageNum} extracted=${rawMembers.length} written=${counters.written} skipped=${counters.skipped} errored=${counters.errored}`,
        });

        // Pagination: chemexcil uses javascript:fetch_more('url','offset') — call it directly
        // rather than clicking the pseudo-anchor (which Playwright treats as not-visible).
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

        const currentOffset = (pageNum - 1) * 20;
        const nextOffset = allOffsets
          .filter((o) => o > currentOffset)
          .sort((a, b) => a - b)[0];

        if (nextOffset === undefined) {
          log.info("No next page offset found. Crawl complete.");
          break;
        }

        // Snapshot the first row's name so we can detect when AJAX has replaced it
        const prevFirstRowName = await page.$eval(
          "table.time-table tr.griderow1 td:first-child",
          (el) => (el.textContent ?? "").trim(),
        ).catch(() => "");

        // Invoke fetch_more in page context — same effect as clicking the anchor
        await page.evaluate((offset) => {
          if (typeof window.fetch_more === "function") {
            window.fetch_more("https://chemexcil.in/members/index", String(offset));
          }
        }, nextOffset);

        // Wait for the table to update — first griderow1 name must change
        await page.waitForFunction(
          (prev) => {
            const first = document.querySelector(
              "table.time-table tr.griderow1 td:first-child",
            );
            return first ? (first.textContent ?? "").trim() !== prev : false;
          },
          prevFirstRowName,
          { timeout: 30_000 },
        );

        // D-05: 2-5s random delay between pages
        const delayMs = 2_000 + Math.floor(Math.random() * 3_000);
        await page.waitForTimeout(delayMs);

        pageNum++;
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request failed permanently: ${request.url}`);
    },
  });

  await crawler.run(["https://chemexcil.in/members"]);
}
