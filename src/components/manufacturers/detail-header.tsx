"use client";

import Link from "next/link";
import { ChevronLeft, Globe, Loader2, Check, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/leads/status-badge";
import { SourcingStatusBadge } from "@/components/manufacturers/sourcing-status-badge";
import { formatDate } from "@/lib/format-date";
import type { LeadStatus, SourcingStatus } from "@/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buttonVariants } from "@/components/ui/button";

interface DetailHeaderProps {
  leadId: number;
  name: string;
  url: string;
  status: LeadStatus;
  sourcingStatus: SourcingStatus;
  updatedAt: Date | null;
  capacity?: string | number | null;
}

const SOURCING_STATUSES: SourcingStatus[] = [
  "Unqualified",
  "Approved",
  "Rejected",
  "Flagged",
];

export function DetailHeader({
  leadId,
  name,
  url,
  status,
  sourcingStatus,
  updatedAt,
  capacity,
}: DetailHeaderProps) {
  const domain = new URL(url).hostname;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: SourcingStatus) => {
    if (newStatus === sourcingStatus) {
      setOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/sourcing-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourcingStatus: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      router.refresh();
      setOpen(false);
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4 mb-8">
      <Link
        href="/manufacturers"
        className="flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors w-fit"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to manufacturers
      </Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
              {name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
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
                <span className="text-zinc-400">Extracted:</span>
                <StatusBadge status={status} />
              </div>
              {updatedAt && (
                <>
                  <span>•</span>
                  <span>{formatDate(updatedAt)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
              Sourcing Status:
            </span>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-2 px-3 border-zinc-200 hover:bg-zinc-50 transition-colors")}
              >
                <SourcingStatusBadge status={sourcingStatus} className="border-0 bg-transparent p-0" />
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {SOURCING_STATUSES.map((status) => (
                        <CommandItem
                          key={status}
                          value={status}
                          onSelect={() => handleStatusChange(status)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <SourcingStatusBadge 
                              status={status} 
                              className="w-2 h-2 rounded-full p-0 border-0" 
                              status-only 
                            />
                            <span>{status}</span>
                          </div>
                          {sourcingStatus === status && (
                            <Check className="h-4 w-4 text-zinc-500" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
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
