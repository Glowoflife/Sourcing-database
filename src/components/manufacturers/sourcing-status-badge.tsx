import { Badge } from "@/components/ui/badge";
import type { SourcingStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

const SOURCING_STATUS_CLASSES: Record<SourcingStatus, string> = {
  Unqualified: "bg-zinc-100 text-zinc-700 border-zinc-200",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 border-rose-200",
  Flagged: "bg-orange-100 text-orange-700 border-orange-200",
};

export function SourcingStatusBadge({ 
  status, 
  className,
  statusOnly = false
}: { 
  status: SourcingStatus;
  className?: string;
  statusOnly?: boolean;
}) {
  if (statusOnly) {
    return (
      <div 
        className={cn(
          "w-2 h-2 rounded-full",
          SOURCING_STATUS_CLASSES[status].split(' ')[0], // Get the bg color class
          className
        )} 
      />
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(SOURCING_STATUS_CLASSES[status], "font-medium", className)}
    >
      {status}
    </Badge>
  );
}
