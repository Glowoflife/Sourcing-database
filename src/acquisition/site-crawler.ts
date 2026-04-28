import { PlaywrightCrawler, RequestQueue } from "crawlee";
import { randomUUID } from "node:crypto";
import { htmlToMarkdown } from "@/acquisition/html-to-markdown";
import type { CrawledPage } from "@/acquisition/types";

// Level 0 → 1: which links to follow from the homepage.
const HOMEPAGE_KEYWORD_PATTERN = /product|about|company|catalogue|our[-.]products/i;

// Level 1 → 2: from a product/catalogue category page, which links lead to product detail pages.
// Examples that match: /prod-insecti.html, /products/widget-x, /product/123, /product-catalog/
const DETAIL_PATTERN = /\/(prod[-_]|products?\/|product[-/])/i;

// Cap on detail-page enqueues per category page to bound crawl size.
const MAX_DETAILS_PER_CATEGORY = 8;

/**
 * Crawl a manufacturer's site two levels deep:
 *   level 0  homepage
 *   level 1  category pages matched from the homepage (product/about/company/catalogue)
 *   level 2  detail pages matched from category pages whose URL is product/catalogue
 *
 * Each call creates a fresh PlaywrightCrawler — never reuse across concurrent jobs.
 *
 * @param homepageUrl  The manufacturer's website homepage URL (from leads.url)
 * @returns            Array of CrawledPage objects (homepage first, then categories, then details)
 */
export async function crawlManufacturerSite(homepageUrl: string): Promise<CrawledPage[]> {
  const results: CrawledPage[] = [];

  // Each job gets its own RequestQueue so concurrent crawls in the same process
  // don't trample each other's request_queues/default state on disk.
  const queueName = `acquire-${randomUUID()}`;
  const requestQueue = await RequestQueue.open(queueName);

  const crawler = new PlaywrightCrawler({
    requestQueue,
    maxRequestsPerCrawl: 15,        // 1 homepage + up to 4 categories + up to ~10 details
    maxRequestRetries: 3,           // D-02: 3 retries per page before failedRequestHandler
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

      if (label === "HOMEPAGE") {
        await enqueueLinks({
          selector: "a[href]",
          label: "CATEGORY",
          transformRequestFunction(req) {
            if (HOMEPAGE_KEYWORD_PATTERN.test(req.url)) return req;
            return false;
          },
        });
      } else if (label === "CATEGORY" && /product|catalogue/i.test(url)) {
        // Only cascade from product/catalogue category pages — not from /about etc.
        let enqueued = 0;
        await enqueueLinks({
          selector: "a[href]",
          label: "DETAIL",
          transformRequestFunction(req) {
            if (enqueued >= MAX_DETAILS_PER_CATEGORY) return false;
            if (req.url === url) return false; // skip self-link
            if (DETAIL_PATTERN.test(req.url)) {
              enqueued++;
              return req;
            }
            return false;
          },
        });
      }
      // DETAIL pages do not cascade further.
    },

    failedRequestHandler({ request, log }) {
      // Crawlee calls this after maxRequestRetries exhausted for a given URL
      // D-02: permanent failure — caller (runAcquisitionJob) checks results for homepage
      log.error(`Request failed permanently: ${request.url}`);
    },
  });

  try {
    await crawler.run([{ url: homepageUrl, label: "HOMEPAGE" }]);
  } finally {
    // Clean up the per-job queue (drops both Redis/file storage entries)
    await requestQueue.drop().catch(() => {});
  }
  return results;
}

function inferPageType(url: string, label: string): CrawledPage["pageType"] {
  if (label === "HOMEPAGE") return "homepage";
  if (label === "DETAIL") return "products";
  if (/product|catalogue/i.test(url)) return "products";
  if (/about|company/i.test(url)) return "about";
  return "other";
}
