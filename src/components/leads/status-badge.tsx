import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@/db/schema";

const STATUS_CLASSES: Record<LeadStatus, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Processing: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Crawled: "bg-green-100 text-green-700 border-green-200",
  Errored: "bg-red-100 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASSES[status]}>
      {status}
    </Badge>
  );
}
