// Smoke test for the 2-level deep crawler — runs against kilpest.com only.
// Usage: node --env-file=.env.local ./node_modules/.bin/tsx scripts/smoke-kilpest.ts
// Prints which URLs were captured and what page-type each was classified as.
// No DB writes.
import { config } from "dotenv";
config({ path: ".env.local" });

import { crawlManufacturerSite } from "@/acquisition/site-crawler";

async function main() {
  const target = "http://www.kilpest.com/";
  console.log(`smoke crawl → ${target}\n`);
  const startedAt = Date.now();
  const pages = await crawlManufacturerSite(target);
  const ms = Date.now() - startedAt;

  console.log(`captured ${pages.length} pages in ${ms}ms\n`);
  for (const p of pages) {
    console.log(`  [${p.pageType.padEnd(8)}] ${p.url}`);
    console.log(`             markdown chars: ${p.markdown.length}`);
  }

  const byType = pages.reduce<Record<string, number>>((acc, p) => {
    acc[p.pageType] = (acc[p.pageType] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nby_page_type: ${JSON.stringify(byType)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
