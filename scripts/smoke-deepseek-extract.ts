// Smoke test for DeepSeek extraction. Loads pages already in DB for one lead and runs extractProfile.
// Usage: node --env-file=.env.local ./node_modules/.bin/tsx scripts/smoke-deepseek-extract.ts <leadId>
// Defaults to the kilpest lead if no arg given. No DB writes — just prints the extraction result.
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db/index";
import { leads, manufacturerPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractProfile } from "@/extraction/extract-profile";

async function main() {
  const argId = process.argv[2] ? Number(process.argv[2]) : null;

  let leadId: number;
  if (argId !== null && !Number.isNaN(argId)) {
    leadId = argId;
  } else {
    const row = await db.select({ id: leads.id }).from(leads).where(eq(leads.url, "http://www.kilpest.com/")).limit(1);
    if (row.length === 0) {
      console.error("kilpest lead not found in DB");
      process.exit(1);
    }
    leadId = row[0].id;
  }

  const lead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (lead.length === 0) {
    console.error(`lead id=${leadId} not found`);
    process.exit(1);
  }

  const pages = await db.select().from(manufacturerPages).where(eq(manufacturerPages.leadId, leadId));
  if (pages.length === 0) {
    console.error(`no manufacturer_pages for leadId=${leadId} — run acquisition first`);
    process.exit(1);
  }

  console.log(`Lead: ${lead[0].name} (id=${leadId}) url=${lead[0].url}`);
  console.log(`Pages in DB: ${pages.length}`);
  for (const p of pages) console.log(`  [${p.pageType}] ${p.url} (${p.markdownContent?.length ?? 0} chars)`);

  const startedAt = Date.now();
  console.log("\nCalling extractProfile()...");
  const result = await extractProfile(leadId, pages);
  const ms = Date.now() - startedAt;
  console.log(`\nExtraction completed in ${ms}ms`);

  console.log(`\nIndustries served: ${JSON.stringify(result.industries_served)}`);
  console.log(`Capacity: ${result.capacity?.value_mt_per_year ?? "-"} MT/yr (raw: ${result.capacity?.raw_text ?? "-"})`);
  console.log(`\nProducts (${result.products.length}):`);
  for (const p of result.products) console.log(`  - ${p.name}${p.cas_number ? ` [${p.cas_number}]` : ""}`);
  console.log(`\nContacts (${result.contacts.length}):`);
  for (const c of result.contacts) console.log(`  - [${c.type}] ${c.value}`);
  console.log(`\nLocations (${result.locations.length}):`);
  for (const l of result.locations) console.log(`  - ${l.address}, ${l.city ?? ""} ${l.state ?? ""} ${l.country ?? ""}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
