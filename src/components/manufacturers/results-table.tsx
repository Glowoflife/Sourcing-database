"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/leads/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ManufacturerProfile, Lead, Product, Location } from "@/db/schema";

type RowData = Lead & {
  manufacturerProfiles: (ManufacturerProfile & {
    products: Product[];
    locations: Location[];
  }) | null;
};

interface ResultsTableProps {
  data: RowData[];
  page: number;
  totalPages: number;
  total: number;
}

export function ResultsTable({ data, page, totalPages, total }: ResultsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`); // Updates ?page= parameter
  };

  const columns = React.useMemo<ColumnDef<RowData>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Manufacturer",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex flex-col gap-1 min-w-[200px]">
              <Link
                href={`/manufacturers/${lead.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {lead.name}
              </Link>
              <span className="text-xs text-zinc-500 truncate max-w-[240px]">
                {lead.url}
              </span>
            </div>
          );
        },
      },
      {
        id: "products",
        header: "Products",
        cell: ({ row }) => {
          const products = row.original.manufacturerProfiles?.products || [];
          if (products.length === 0) return <span className="text-zinc-400">—</span>;
          const display = products.slice(0, 2).map((p) => p.name);
          const remaining = products.length - 2;
          return (
            <div className="text-sm min-w-[150px]">
              {display.join(", ")}
              {remaining > 0 && <span className="text-zinc-500 text-xs"> +{remaining} more</span>}
            </div>
          );
        },
      },
      {
        id: "cas",
        header: "CAS",
        cell: ({ row }) => {
          const products = row.original.manufacturerProfiles?.products || [];
          const casNumbers = Array.from(new Set(products
            .map((p) => p.casNumber)
            .filter(Boolean))) as string[];
          if (casNumbers.length === 0) return <span className="text-zinc-400">—</span>;
          const display = casNumbers.slice(0, 2);
          const remaining = casNumbers.length - 2;
          return (
            <div className="flex flex-col gap-0.5 font-mono text-[11px] min-w-[100px]">
              {display.map((cas) => (
                <div key={cas}>{cas}</div>
              ))}
              {remaining > 0 && <div className="text-zinc-500">+{remaining} more</div>}
            </div>
          );
        },
      },
      {
        id: "industry",
        header: "Industry",
        cell: ({ row }) => {
          const industries =
            row.original.manufacturerProfiles?.industriesServed || [];
          if (industries.length === 0) return <span className="text-zinc-400">—</span>;
          const display = industries.slice(0, 2);
          const remaining = industries.length - 2;
          return (
            <div className="flex flex-wrap gap-1 min-w-[120px]">
              {display.map((ind) => (
                <Badge key={ind} variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal">
                  {ind}
                </Badge>
              ))}
              {remaining > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal">
                  +{remaining}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "location",
        header: "Location",
        cell: ({ row }) => {
          const locations = row.original.manufacturerProfiles?.locations || [];
          if (locations.length === 0) return <span className="text-zinc-400 italic text-xs">Not extracted</span>;
          const primary = locations[0];
          const remaining = locations.length - 1;
          return (
            <div className="text-sm min-w-[120px]">
              <div className="truncate">
                {primary.city ? `${primary.city}, ` : ""}
                {primary.state || ""}
              </div>
              {remaining > 0 && <div className="text-xs text-zinc-500">+{remaining} more</div>}
            </div>
          );
        },
      },
      {
        id: "capacity",
        header: () => <div className="text-right">Capacity</div>,
        cell: ({ row }) => {
          const profile = row.original.manufacturerProfiles;
          if (!profile) return <div className="text-right"><span className="text-zinc-400">—</span></div>;
          if (profile.capacityMtPerYear) {
            return (
              <div className="text-right font-mono text-xs">
                {profile.capacityMtPerYear.toLocaleString()} <span className="text-[10px] text-zinc-500">MT/y</span>
              </div>
            );
          }
          if (profile.capacityRawText) {
            return (
              <div className="text-right text-[10px] text-zinc-500 truncate max-w-[100px] italic">
                {profile.capacityRawText}
              </div>
            );
          }
          return <div className="text-right"><span className="text-zinc-400">—</span></div>;
        },
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <StatusBadge status={row.getValue("status")} />
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const startRange = (page - 1) * 50 + 1;
  const endRange = Math.min(page * 50, total);

  // Responsive strategy: wide table on desktop, stacked cards on mobile (flex-col md:table-row)
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    // Default sorting: status priority then name
                    let ariaSort: "ascending" | "descending" | "none" | undefined = undefined;
                    if (header.column.id === "name") ariaSort = "ascending";
                    if (header.column.id === "status") ariaSort = "ascending";

                    return (
                      <TableHead key={header.id} aria-sort={ariaSort}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="group"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="py-12">
                      <p className="text-sm font-medium text-zinc-500">No manufacturers match this search</p>
                      <p className="text-sm text-zinc-400">Clear one or more filters or broaden the chemical or CAS query.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
          {data.length > 0 ? (
            data.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col overflow-hidden">
                    <Link
                      href={`/manufacturers/${lead.id}`}
                      className="font-semibold text-blue-600 hover:underline truncate"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-xs text-zinc-500 truncate">{lead.url}</span>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-zinc-400 tracking-wider">Products</div>
                    <div className="truncate text-zinc-700">
                      {lead.manufacturerProfiles?.products?.[0]?.name || <span className="text-zinc-300">—</span>}
                      {(lead.manufacturerProfiles?.products?.length || 0) > 1 && (
                        <span className="text-xs text-zinc-400 ml-1">
                          +{lead.manufacturerProfiles!.products.length - 1} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-zinc-400 tracking-wider">Location</div>
                    <div className="truncate text-zinc-700">
                      {lead.manufacturerProfiles?.locations?.[0]?.state || <span className="text-zinc-300">—</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-zinc-400 tracking-wider">Capacity</div>
                    <div className="truncate text-zinc-700 font-mono text-xs">
                      {lead.manufacturerProfiles?.capacityMtPerYear
                        ? `${lead.manufacturerProfiles.capacityMtPerYear.toLocaleString()} MT/y`
                        : lead.manufacturerProfiles?.capacityRawText ? (
                          <span className="italic text-[10px]">{lead.manufacturerProfiles.capacityRawText}</span>
                        ) : <span className="text-zinc-300">—</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-zinc-400 tracking-wider">Industries</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {lead.manufacturerProfiles?.industriesServed?.slice(0, 1).map(ind => (
                        <Badge key={ind} variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                          {ind}
                        </Badge>
                      ))}
                      {(lead.manufacturerProfiles?.industriesServed?.length || 0) > 1 && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                          +{(lead.manufacturerProfiles?.industriesServed?.length || 0) - 1}
                        </Badge>
                      )}
                      {(lead.manufacturerProfiles?.industriesServed?.length || 0) === 0 && (
                         <span className="text-zinc-300">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-zinc-500">No manufacturers match this search</p>
              <p className="text-sm text-zinc-400">Clear one or more filters or broaden the query.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2">
          <div className="text-sm text-zinc-500">
            {startRange}-{endRange} of {total}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
