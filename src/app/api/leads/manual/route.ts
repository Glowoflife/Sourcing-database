import { z } from "zod";
import { MAX_ROWS, ingestRows, type RawRow } from "@/lib/lead-import";
import { logger } from "@/lib/logger";

const ManualImportPayloadSchema = z.object({
  source: z.string().trim().max(200).optional(),
  rows: z.array(z.unknown()).max(MAX_ROWS),
});

export async function POST(request: Request) {
  const startedAt = Date.now();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    logger.warn({ stage: "manual-import", status: "fail", message: "invalid json body" });
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedPayload = ManualImportPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return Response.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          `Payload must be { rows: [{name, url}, ...] } with at most ${MAX_ROWS} rows.`,
      },
      { status: 422 },
    );
  }

  const { source, rows } = parsedPayload.data;
  const sourceLabel = source && source.length > 0 ? source : "manual";
  const summary = await ingestRows(rows as RawRow[], sourceLabel);
  const durationMs = Date.now() - startedAt;

  logger.info({
    stage: "manual-import",
    status: "ok",
    durationMs,
    errorCount: summary.errors.length,
    message: `source=${sourceLabel} inserted=${summary.inserted} skipped=${summary.skipped} totalRows=${rows.length}`,
  });

  return Response.json(summary);
}
