import { db } from "@/db/index";
import { leads, manufacturerPages } from "@/db/schema";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import type { CrawledPage } from "@/acquisition/types";

export async function writePage(leadId: number, page: CrawledPage): Promise<void> {
  await db.insert(manufacturerPages).values({
    leadId,
    url: page.url,
    pageType: page.pageType,
    markdownContent: page.markdown,
    crawledAt: new Date(),
  }).onConflictDoUpdate({
    target: [manufacturerPages.leadId, manufacturerPages.url],
    set: {
      pageType: page.pageType,
      markdownContent: page.markdown,
      crawledAt: new Date(),
    },
  });

  logger.info({
    leadId,
    stage: "acquire",
    status: "ok",
    message: `written page url=${page.url} type=${page.pageType}`,
  });
}

export async function updateLeadStatus(
  leadId: number,
  status: "Processing" | "Crawled" | "Errored",
): Promise<void> {
  await db
    .update(leads)
    .set({ status })
    .where(eq(leads.id, leadId));
}
