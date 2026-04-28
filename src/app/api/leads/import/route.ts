import {
  MAX_FILE_BYTES,
  MAX_ROWS,
  ingestRows,
  parseCsvBuffer,
  parseXlsxBuffer,
  type RawRow,
} from "@/lib/lead-import";
import { logger } from "@/lib/logger";

const ALLOWED_CSV_MIME = new Set(["text/csv", "text/plain", "application/csv", ""]);
const ALLOWED_XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "",
]);

type FileKind = "csv" | "xlsx";

function detectKind(file: File): FileKind | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}

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
  const sourceField = formData.get("source");
  const source =
    typeof sourceField === "string" && sourceField.trim().length > 0
      ? sourceField.trim().slice(0, 200)
      : "manual";

  if (!(file instanceof File)) {
    logger.warn({ stage: "import", status: "fail", message: "no file field" });
    return Response.json({ error: "No file uploaded. Use form field 'file'." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    logger.warn({ stage: "import", status: "fail", message: `file too large: ${file.size}` });
    return Response.json({ error: "File exceeds 10 MB limit." }, { status: 413 });
  }

  const kind = detectKind(file);
  if (!kind) {
    logger.warn({ stage: "import", status: "fail", message: `unsupported extension: ${file.name}` });
    return Response.json(
      { error: "File must have a .csv or .xlsx extension." },
      { status: 415 },
    );
  }

  const allowedMime = kind === "csv" ? ALLOWED_CSV_MIME : ALLOWED_XLSX_MIME;
  if (file.type && !allowedMime.has(file.type)) {
    logger.warn({ stage: "import", status: "fail", message: `invalid mime: ${file.type}` });
    return Response.json({ error: `File must be a ${kind.toUpperCase()}.` }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows: RawRow[];
  try {
    rows = kind === "csv" ? parseCsvBuffer(buffer) : await parseXlsxBuffer(buffer);
  } catch {
    logger.warn({ stage: "import", status: "fail", message: `${kind} parse failed` });
    return Response.json(
      {
        error:
          kind === "csv"
            ? "Could not read the file. Make sure it is a valid CSV with name and url columns."
            : "Could not read the spreadsheet. Make sure it has name and url columns.",
      },
      { status: 422 },
    );
  }

  if (rows.length > MAX_ROWS) {
    return Response.json(
      { error: `File exceeds the ${MAX_ROWS}-row limit.` },
      { status: 422 },
    );
  }

  const summary = await ingestRows(rows, source);
  const durationMs = Date.now() - startedAt;

  logger.info({
    stage: "import",
    status: "ok",
    durationMs,
    errorCount: summary.errors.length,
    message: `kind=${kind} source=${source} inserted=${summary.inserted} skipped=${summary.skipped} totalRows=${rows.length}`,
  });

  return Response.json(summary);
}
