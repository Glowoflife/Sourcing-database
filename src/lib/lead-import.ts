import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { ImportRowSchema } from "@/schemas/import.schema";

export const MAX_ROWS = 5_000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const BATCH_SIZE = 500;

export interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

export type RawRow = { name?: unknown; url?: unknown };

export function parseCsvBuffer(buffer: Buffer): RawRow[] {
  return parse(buffer, {
    columns: ["name", "url"],
    from_line: 2, // skip header row
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as RawRow[];
}

export async function parseXlsxBuffer(buffer: Buffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs declares its own `Buffer extends ArrayBuffer` — coerce through unknown
  const ab = new Uint8Array(buffer).buffer as ArrayBuffer;
  await workbook.xlsx.load(ab as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  // Detect header row: prefer "name" / "url" headers, else assume cols 1+2 are name/url.
  const headerRow = sheet.getRow(1);
  const headers = (headerRow.values as unknown[]).map((v) =>
    typeof v === "string" ? v.trim().toLowerCase() : "",
  );
  let nameCol = headers.indexOf("name");
  let urlCol = headers.indexOf("url");
  let startRow = 2;
  if (nameCol === -1 || urlCol === -1) {
    nameCol = 1;
    urlCol = 2;
    startRow = 1;
  }

  const out: RawRow[] = [];
  for (let r = startRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nameCell = row.getCell(nameCol).value;
    const urlCell = row.getCell(urlCol).value;
    const name = typeof nameCell === "string" ? nameCell.trim() : nameCell != null ? String(nameCell).trim() : "";
    const url = extractUrl(urlCell);
    if (!name && !url) continue;
    out.push({ name, url });
  }
  return out;
}

function extractUrl(cell: ExcelJS.CellValue): string {
  if (cell == null) return "";
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "object" && "text" in cell && "hyperlink" in cell) {
    // Hyperlink cells: prefer the underlying URL over the visible text
    return String(cell.hyperlink ?? cell.text ?? "").trim();
  }
  return String(cell).trim();
}

export async function ingestRows(
  rawRows: RawRow[],
  source: string,
): Promise<ImportSummary> {
  const validRows: { name: string; url: string; source: string }[] = [];
  const errors: { row: number; error: string }[] = [];
  const seenUrls = new Set<string>();
  let dupesInPayload = 0;

  rawRows.forEach((row, i) => {
    const result = ImportRowSchema.safeParse(row);
    if (!result.success) {
      errors.push({
        row: i + 2, // user-facing row number — assumes header at row 1
        error: result.error.issues.map((iss) => iss.message).join("; "),
      });
      return;
    }
    if (seenUrls.has(result.data.url)) {
      dupesInPayload += 1;
      return;
    }
    seenUrls.add(result.data.url);
    validRows.push({ ...result.data, source });
  });

  let inserted = 0;
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    const batchResult = await db
      .insert(leads)
      .values(batch)
      .onConflictDoNothing({ target: leads.url })
      .returning({ id: leads.id });
    inserted += batchResult.length;
  }

  const skipped = validRows.length - inserted + dupesInPayload;
  return { inserted, skipped, errors };
}
