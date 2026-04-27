import { notFound } from "next/navigation";
import { getManufacturerDetail } from "@/lib/queries/manufacturers";
import { DetailHeader } from "@/components/manufacturers/detail-header";
// We'll create this in the next task
// import { DetailSections } from "@/components/manufacturers/detail-sections";

interface ManufacturerDetailPageProps {
  params: Promise<{
    leadId: string;
  }>;
}

export default async function ManufacturerDetailPage({
  params,
}: ManufacturerDetailPageProps) {
  const { leadId: rawLeadId } = await params;
  const leadId = parseInt(rawLeadId);
  
  if (isNaN(leadId)) {
    notFound();
  }

  const manufacturer = await getManufacturerDetail(leadId);

  if (!manufacturer) {
    notFound();
  }

  const profile = manufacturer.manufacturerProfiles?.[0];

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8">
      <DetailHeader
        name={manufacturer.name}
        url={manufacturer.url}
        status={manufacturer.status}
        updatedAt={profile?.updatedAt || manufacturer.updatedAt}
        capacity={profile?.capacityMtPerYear || profile?.capacityRawText}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Main Content Area */}
        <div className="space-y-8 min-w-0">
          {!profile ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-12 text-center">
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                No extracted profile available
              </h3>
              <p className="text-zinc-600 max-w-md mx-auto">
                This lead exists in the pipeline, but no technical profile has been extracted yet.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* This will be replaced by DetailSections soon */}
              <div className="p-8 border rounded-lg bg-white">
                <p className="text-zinc-500">Technical profile sections loading...</p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Right Rail Placeholder */}
        <div className="lg:sticky lg:top-8 space-y-6">
          <div className="p-6 border rounded-lg bg-zinc-50 space-y-4">
             <p className="text-sm font-medium text-zinc-900">Snapshot</p>
             <div className="h-32 bg-zinc-200/50 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
