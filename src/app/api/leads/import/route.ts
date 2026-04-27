import { parse } from "csv-parse/sync";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { ImportRowSchema } from "@/schemas/import.schema";
import { logger } from "@/lib/logger";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const startedAt = Date.now();
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    logger.warn({ stage: "import", status: "fail", message: "invalid multipart body" });
    return Response.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    logger.warn({ stage: "import", status: "fail", message: "no file field" });
    return Response.json({ error: "No file uploaded. Use form field 'file'." }, { status: 400 });
  }

  // T-02-02: reject oversized uploads before parsing
  if (file.size > MAX_FILE_BYTES) {
    logger.warn({ stage: "import", status: "fail", message: `file too large: ${file.size}` });
    return Response.json(
      { error: "File exceeds 10 MB limit." },
      { status: 413 },
    );
  }

  // T-02-03: extension check (defense in depth — parsing also rejects non-CSV)
  if (!file.name.toLowerCase().endsWith(".csv")) {
    logger.warn({ stage: "import", status: "fail", message: `non-csv extension: ${file.name}` });
    return Response.json(
      { error: "File must have .csv extension." },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows: unknown[];

  try {
    rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // RESEARCH.md Pitfall 2 — strip UTF-8 BOM from Excel exports
    });
  } catch {
    // T-02-04: do NOT echo raw error or buffer
    logger.warn({ stage: "import", status: "fail", message: "csv parse failed" });
    return Response.json(
      { error: "Could not read the file. Make sure it is a valid CSV with name and url columns." },
      { status: 422 },
    );
  }

  const validRows: { name: string; url: string }[] = [];
  const errors: { row: number; error: string }[] = [];

  rows.forEach((row, i) => {
    const result = ImportRowSchema.safeParse(row);
    if (result.success) {
      validRows.push(result.data);
    } else {
      // +2 because: 1-indexed display + 1 header line
      errors.push({ row: i + 2, error: result.error.issues.map((iss) => iss.message).join("; ") });
    }
  });

  let inserted = 0;
  if (validRows.length > 0) {
    const result = await db
      .insert(leads)
      .values(validRows)
      .onConflictDoNothing({ target: leads.url })
      .returning({ id: leads.id });
    inserted = result.length;
  }

  const skipped = validRows.length - inserted;
  const durationMs = Date.now() - startedAt;

  logger.info({
    stage: "import",
    status: "ok",
    durationMs,
    errorCount: errors.length,
    message: `inserted=${inserted} skipped=${skipped} totalRows=${rows.length}`,
  });

  return Response.json({ inserted, skipped, errors });
}
