import Link from "next/link";
import { ChevronLeft, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/leads/status-badge";
import { formatDate } from "@/lib/format-date";
import type { LeadStatus } from "@/db/schema";

interface DetailHeaderProps {
  name: string;
  url: string;
  status: LeadStatus;
  updatedAt: Date | null;
  capacity?: string | number | null;
}

export function DetailHeader({
  name,
  url,
  status,
  updatedAt,
  capacity,
}: DetailHeaderProps) {
  const domain = new URL(url).hostname;

  return (
    <div className="space-y-4 mb-8">
      <Link
        href="/manufacturers"
        className="flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to manufacturers
      </Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
            {name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              title="Website"
            >
              <Globe className="w-4 h-4" />
              <span className="sr-only">Website:</span>
              {domain}
            </a>
            <span>•</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Status:</span>
              <StatusBadge status={status} />
            </div>
            {updatedAt && (
              <>
                <span>•</span>
                <span>Extracted {formatDate(updatedAt)}</span>
              </>
            )}
          </div>
        </div>

        {capacity && (
          <div className="flex flex-col items-start md:items-end">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Annual Capacity
            </span>
            <span className="text-xl font-semibold text-zinc-900">
              {typeof capacity === "number"
                ? `${capacity.toLocaleString()} MT/year`
                : capacity}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
