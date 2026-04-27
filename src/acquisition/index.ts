import { crawlManufacturerSite } from "@/acquisition/site-crawler";
import { writePage, updateLeadStatus } from "@/acquisition/page-writer";
import { logger } from "@/lib/logger";

export async function runAcquisitionJob({
  leadId,
  url,
}: {
  leadId: number;
  url: string;
}): Promise<void> {
  const startedAt = Date.now();

  // Step 1: Mark lead as Processing before crawl starts (D-05 status machine)
  await updateLeadStatus(leadId, "Processing");

  logger.info({
    stage: "acquire",
    status: "start",
    leadId,
    message: `Crawling ${url}`,
  });

  try {
    // Step 2: Crawl manufacturer site — may return empty array if homepage fails all retries
    const pages = await crawlManufacturerSite(url);

    // Step 3: If homepage was not crawled, treat as permanent failure
    // (Crawlee exhausted retries on the homepage URL itself)
    const homepageCrawled = pages.some((p) => p.pageType === "homepage");
    if (!homepageCrawled) {
      throw new Error(`Homepage not crawled for leadId=${leadId} url=${url}`);
    }

    // Step 4: Write one manufacturer_pages row per crawled page (D-08)
    for (const p of pages) {
      await writePage(leadId, p);
    }

    // Step 5: Mark lead as Crawled on success
    await updateLeadStatus(leadId, "Crawled");

    const durationMs = Date.now() - startedAt;
    logger.info({
      stage: "acquire",
      status: "ok",
      leadId,
      durationMs,
      message: `Crawled ${pages.length} pages`,
    });
  } catch (err) {
    // Step 6: Mark lead as Errored on permanent failure (D-02)
    // Wrap in its own try/catch — if the DB is unavailable, we still re-throw the
    // original error so BullMQ records the correct failure reason.
    try {
      await updateLeadStatus(leadId, "Errored");
    } catch (statusErr) {
      logger.error({
        stage: "acquire",
        status: "fail",
        leadId,
        message: `Failed to mark lead as Errored: ${String(statusErr)}`,
      });
    }

    logger.error({
      stage: "acquire",
      status: "fail",
      leadId,
      message: `Errored: ${String(err)}`,
    });

    // MUST re-throw so BullMQ records the job as failed and does NOT mark it completed
    throw err;
  }
}
