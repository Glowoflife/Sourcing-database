import { Suspense } from "react";
import { getManufacturers } from "@/lib/queries/manufacturers";
import { SearchToolbar } from "@/components/manufacturers/search-toolbar";
import { ResultsTable } from "@/components/manufacturers/results-table";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function ManufacturersPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const industry = Array.isArray(searchParams.industry)
    ? searchParams.industry
    : typeof searchParams.industry === "string"
    ? [searchParams.industry]
    : undefined;
  const status = Array.isArray(searchParams.status)
    ? searchParams.status
    : typeof searchParams.status === "string"
    ? [searchParams.status]
    : undefined;
  const sourcingStatus = Array.isArray(searchParams.sourcingStatus)
    ? searchParams.sourcingStatus
    : typeof searchParams.sourcingStatus === "string"
    ? [searchParams.sourcingStatus]
    : undefined;
  const location = Array.isArray(searchParams.location)
    ? searchParams.location
    : typeof searchParams.location === "string"
    ? [searchParams.location]
    : undefined;
  const capacity = Array.isArray(searchParams.capacity)
    ? searchParams.capacity
    : typeof searchParams.capacity === "string"
    ? [searchParams.capacity]
    : undefined;
  const page = typeof searchParams.page === "string" ? parseInt(searchParams.page) : 1;

  const queryParams = { q, industry, status, sourcingStatus, location, capacity, page };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Manufacturers</h1>
        <p className="text-zinc-500">
          Search extracted profiles by chemical, CAS, industry, and capacity.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <SearchToolbar>
          <Suspense fallback={<Skeleton className="h-4 w-32" />}>
            <ResultCount {...queryParams} />
          </Suspense>
        </SearchToolbar>
        
        <Suspense key={JSON.stringify(searchParams)} fallback={<ListSkeleton />}>
          <ManufacturersList {...queryParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function ResultCount(params: any) {
  const { total } = await getManufacturers(params);
  return (
    <span>{total.toLocaleString()} {total === 1 ? "manufacturer" : "manufacturers"}</span>
  );
}

async function ManufacturersList(params: any) {
  const { data, total, totalPages } = await getManufacturers(params);
  
  return (
    <div className="space-y-4">
      <ResultsTable data={data} page={params.page} totalPages={totalPages} total={total} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-hidden">
        <div className="border-b px-4 py-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-4 w-[80px]" />
          </div>
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b px-4 py-6 last:border-0">
            <div className="flex gap-4">
              <div className="space-y-2 w-[200px]">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-[150px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-8 w-[80px] ml-auto" />
              <Skeleton className="h-6 w-[80px] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
