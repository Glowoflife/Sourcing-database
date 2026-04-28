import { db } from "@/db";
import { leads } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/leads/status-badge";
import { CsvImportForm } from "@/components/leads/csv-import-form";
import { ManualImportForm } from "@/components/leads/manual-import-form";
import { SourceFilter } from "@/components/leads/source-filter";
import { formatLeadDate } from "@/lib/format-date";

export const dynamic = "force-dynamic"; // always read live DB on each request

interface LeadsPageProps {
  searchParams: Promise<{ source?: string }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const { source } = await searchParams;
  const activeSource = source && source.trim().length > 0 ? source.trim() : null;

  let rows: (typeof leads.$inferSelect)[] = [];
  let availableSources: string[] = [];
  try {
    const baseQuery = db.select().from(leads).orderBy(desc(leads.createdAt));
    rows = await (activeSource
      ? baseQuery.where(eq(leads.source, activeSource))
      : baseQuery);

    const distinct = await db
      .selectDistinct({ source: leads.source })
      .from(leads)
      .orderBy(sql`${leads.source} asc`);
    availableSources = distinct.map((r) => r.source);
  } catch (err) {
    console.error("[leads-page] DB error:", err);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold leading-tight">Leads</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Manufacturer leads currently tracked in the sourcing pipeline.
      </p>

      <div className="mt-8">
        <CsvImportForm />
        <ManualImportForm />
      </div>

      <SourceFilter sources={availableSources} active={activeSource} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-[140px]">Source</TableHead>
            <TableHead className="w-[120px] text-center">Status</TableHead>
            <TableHead className="w-[160px]">Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-zinc-500">
                    {activeSource ? `No leads from "${activeSource}"` : "No leads yet"}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {activeSource
                      ? "Try clearing the filter or importing more leads."
                      : "Import a CSV/XLSX or paste rows above to add manufacturers."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>{lead.name}</TableCell>
                <TableCell className="text-zinc-600">{lead.url}</TableCell>
                <TableCell className="w-[140px] text-zinc-600">{lead.source}</TableCell>
                <TableCell className="w-[120px] text-center">
                  <StatusBadge status={lead.status} />
                </TableCell>
                <TableCell className="w-[160px]">
                  {formatLeadDate(lead.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
