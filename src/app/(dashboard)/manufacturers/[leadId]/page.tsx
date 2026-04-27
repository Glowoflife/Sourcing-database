import { notFound } from "next/navigation";
import { getManufacturerDetail } from "@/lib/queries/manufacturers";
import { DetailHeader } from "@/components/manufacturers/detail-header";
import { DetailSections } from "@/components/manufacturers/detail-sections";

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
        leadId={leadId}
        name={manufacturer.name}
        url={manufacturer.url}
        status={manufacturer.status}
        sourcingStatus={manufacturer.sourcingStatus}
        updatedAt={profile?.extractedAt || manufacturer.updatedAt}
        capacity={profile?.capacityMtPerYear || profile?.capacityRawText}
      />

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
          <DetailSections
            leadId={leadId}
            profile={profile as any}
            pages={manufacturer.manufacturerPages || []}
            notes={manufacturer.notes || []}
            leadUrl={manufacturer.url}
          />
        )}
      </div>
    </div>
  );
}
