import { db } from "@/db/index";
import {
  contacts,
  leads,
  locations,
  manufacturerPages,
  manufacturerProfiles,
  products,
} from "@/db/schema";
import { extractProfile } from "@/extraction/extract-profile";
import { logger } from "@/lib/logger";
import type { ExtractionJob } from "@/schemas/extraction";
import { eq } from "drizzle-orm";

export async function runExtractionJob({ leadId }: ExtractionJob): Promise<void> {
  const startedAt = Date.now();

  try {
    // Step 1: Read all manufacturer_pages for this lead (Phase 3 output)
    const pages = await db
      .select()
      .from(manufacturerPages)
      .where(eq(manufacturerPages.leadId, leadId));

    if (pages.length === 0) {
      throw new Error(`No manufacturer_pages found for leadId=${leadId} - cannot extract`);
    }

    // Step 2: Call LLM extraction (builds prompt, calls GPT-4o-mini via instructor, returns validated data)
    const extracted = await extractProfile(leadId, pages);

    // Step 3: Write all profile tables atomically
    await db.transaction(async (tx) => {
      // Upsert manufacturer_profiles - idempotent on re-run (unique constraint on lead_id)
      // onConflictDoUpdate updates extractedAt so the row reflects the latest extraction timestamp.
      const [profile] = await tx
        .insert(manufacturerProfiles)
        .values({
          leadId,
          industriesServed: extracted.industries_served,
          capacityMtPerYear: extracted.capacity.value_mt_per_year ?? null,
          capacityRawText: extracted.capacity.raw_text ?? null,
        })
        .onConflictDoUpdate({
          target: manufacturerProfiles.leadId,
          set: {
            industriesServed: extracted.industries_served,
            capacityMtPerYear: extracted.capacity.value_mt_per_year ?? null,
            capacityRawText: extracted.capacity.raw_text ?? null,
            extractedAt: new Date(),
          },
        })
        .returning({ id: manufacturerProfiles.id });

      // Delete existing child rows before re-inserting - makes re-runs idempotent
      await tx.delete(products).where(eq(products.profileId, profile.id));
      await tx.delete(contacts).where(eq(contacts.profileId, profile.id));
      await tx.delete(locations).where(eq(locations.profileId, profile.id));

      // Insert child rows (skip inserts for empty arrays to avoid vacuous DB calls)
      if (extracted.products.length > 0) {
        await tx.insert(products).values(
          extracted.products.map((p) => ({
            profileId: profile.id,
            name: p.name,
            casNumber: p.cas_number ?? null,
            grade: p.grade ?? null,
          })),
        );
      }

      if (extracted.contacts.length > 0) {
        await tx.insert(contacts).values(
          extracted.contacts.map((c) => ({
            profileId: profile.id,
            type: c.type,
            value: c.value,
          })),
        );
      }

      if (extracted.locations.length > 0) {
        await tx.insert(locations).values(
          extracted.locations.map((l) => ({
            profileId: profile.id,
            address: l.address ?? null,
            city: l.city ?? null,
            state: l.state ?? null,
            country: l.country,
          })),
        );
      }

      // Step 4: Transition lead status Crawled -> Extracted
      await tx.update(leads).set({ status: "Extracted" }).where(eq(leads.id, leadId));
    });

    logger.info({
      stage: "extract",
      status: "ok",
      leadId,
      durationMs: Date.now() - startedAt,
      message: `Extracted ${extracted.products.length} products, ${extracted.contacts.length} contacts, ${extracted.locations.length} locations`,
    });
  } catch (err) {
    // Mirror exact error handling pattern from src/acquisition/index.ts
    // Step 5: Mark lead as Errored - wrap in its own try/catch so DB failure doesn't mask original error
    try {
      await db.update(leads).set({ status: "Errored" }).where(eq(leads.id, leadId));
    } catch (statusErr) {
      logger.error({
        stage: "extract",
        status: "fail",
        leadId,
        message: `Failed to mark lead as Errored: ${String(statusErr)}`,
      });
    }

    logger.error({
      stage: "extract",
      status: "fail",
      leadId,
      message: `Errored: ${String(err)}`,
    });

    // MUST re-throw so BullMQ records the job as failed and does NOT mark it completed
    throw err;
  }
}
