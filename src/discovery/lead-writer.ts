import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { ExtractedMember } from "@/discovery/types";

export interface RunCounters {
  found: number;
  written: number;
  skipped: number;
  errored: number;
}

/**
 * Write a successfully-extracted member with a URL as a New lead.
 * Returns 'written' if the row was inserted, 'skipped' if the URL already existed.
 * Per D-03: onConflictDoNothing silently skips duplicate URLs.
 */
export async function writeLead(
  member: ExtractedMember & { url: string },
  counters: RunCounters,
): Promise<void> {
  counters.found++;
  const result = await db
    .insert(leads)
    .values({ name: member.name, url: member.url, status: "New", source: "chemexcil" })
    .onConflictDoNothing({ target: leads.url })
    .returning({ id: leads.id });

  if (result.length > 0) {
    counters.written++;
    logger.info({
      leadId: result[0].id,
      stage: "discovery",
      status: "ok",
      message: `written name=${member.name}`,
    });
  } else {
    counters.skipped++;
    logger.info({
      stage: "discovery",
      status: "skip",
      message: `duplicate url=${member.url}`,
    });
  }
}

/**
 * Count and log a member with no website URL as errored.
 * leads.url is no longer nullable in the active schema, so we cannot persist a row
 * without fabricating a placeholder URL.
 */
export async function writeErroredLead(
  name: string | null,
  pageNum: number,
  reason: string,
  counters: RunCounters,
): Promise<void> {
  counters.found++;
  counters.errored++;

  logger.warn({
    stage: "discovery",
    status: "fail",
    message: `parse failure: page=${pageNum} name=${name ?? "unknown"} reason=${reason}`,
  });
}
