import { PlaywrightCrawler } from "crawlee";
import { htmlToMarkdown } from "@/acquisition/html-to-markdown";
import type { CrawledPage } from "@/acquisition/types";

// D-01: keyword pattern for link discovery (per CONTEXT.md decision)
const KEYWORD_PATTERN = /product|about|company|catalogue|our.products/i;

/**
 * Crawl a manufacturer's homepage and follow up to 4 keyword-matched inner pages.
 * Returns one CrawledPage per successfully crawled URL (homepage first, then inner pages).
 *
 * Each call creates a fresh PlaywrightCrawler instance — never reuse across concurrent jobs.
 * maxRequestsPerCrawl: 5 enforces D-01 (homepage + up to 4 inner pages).
 *
 * @param homepageUrl  The manufacturer's website homepage URL (from leads.url)
 * @returns            Array of CrawledPage objects
 */
export async function crawlManufacturerSite(homepageUrl: string): Promise<CrawledPage[]> {
  const results: CrawledPage[] = [];

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 5,        // D-01: cap at 5 pages total (homepage + 4 inner)
    maxRequestRetries: 3,           // D-02: 3 Crawlee-level retries per page before failedRequestHandler
    requestHandlerTimeoutSecs: 60,
    launchContext: {
      launchOptions: { headless: true },
    },

    async requestHandler({ page, request, enqueueLinks }) {
      const html = await page.content();
      const url = request.loadedUrl ?? request.url;
      const label = (request.label ?? "HOMEPAGE") as string;

      const pageType = inferPageType(url, label);
      const markdown = htmlToMarkdown(html, url);
      results.push({ url, pageType, markdown });

      // Only enqueue links from the homepage — do NOT cascade link-following to inner pages
      if (label === "HOMEPAGE") {
        await enqueueLinks({
          selector: "a[href]",
          label: "PAGE",
          transformRequestFunction(req) {
            // Filter: only enqueue links whose href matches the keyword pattern
            if (KEYWORD_PATTERN.test(req.url)) return req;
            return false; // skip non-matching links
          },
        });
      }
    },

    failedRequestHandler({ request, log }) {
      // Crawlee calls this after maxRequestRetries exhausted for a given URL
      // D-02: permanent failure — caller (runAcquisitionJob) checks results for homepage
      log.error(`Request failed permanently: ${request.url}`);
    },
  });

  await crawler.run([{ url: homepageUrl, label: "HOMEPAGE" }]);
  return results;
}

function inferPageType(url: string, label: string): CrawledPage["pageType"] {
  if (label === "HOMEPAGE") return "homepage";
  if (/product|catalogue/i.test(url)) return "products";
  if (/about|company/i.test(url)) return "about";
  return "other";
}
