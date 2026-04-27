import { db } from "@/db";
import { leads } from "@/db/schema";
import { desc } from "drizzle-orm";
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
import { formatLeadDate } from "@/lib/format-date";

export const dynamic = "force-dynamic"; // always read live DB on each request

export default async function LeadsPage() {
  let rows: (typeof leads.$inferSelect)[] = [];
  try {
    rows = await db.select().from(leads).orderBy(desc(leads.createdAt));
  } catch (err) {
    // Log and show empty state — do not rethrow
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
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-[120px] text-center">Status</TableHead>
            <TableHead className="w-[160px]">Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-zinc-500">No leads yet</p>
                  <p className="text-sm text-zinc-400">
                    Import a CSV above to add manufacturers.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>{lead.name}</TableCell>
                <TableCell className="text-zinc-600">{lead.url}</TableCell>
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
