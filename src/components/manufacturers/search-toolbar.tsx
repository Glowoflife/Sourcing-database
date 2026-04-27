"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, Filter, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const INDUSTRY_OPTIONS = [
  "Pharma", "Agro", "Specialty", "Basic", "Polymers", "Dyes", "Pigments", "Intermediates"
];

const LOCATION_OPTIONS = [
  "Gujarat", "Maharashtra", "Telangana", "Andhra Pradesh", "Tamil Nadu", 
  "Karnataka", "West Bengal", "Uttar Pradesh", "Madhya Pradesh", "Rajasthan"
];

const STATUS_OPTIONS = [
  "New", "Processing", "Crawled", "Extracted", "Errored"
];

const CAPACITY_OPTIONS = [
  { label: "Unknown", value: "Unknown" },
  { label: "<100 MT/year", value: "<100" },
  { label: "100-999 MT/year", value: "100-999" },
  { label: "1,000-9,999 MT/year", value: "1000-9999" },
  { label: "10,000+ MT/year", value: "10000+" },
];

export function SearchToolbar({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = React.useState(searchParams.get("q") || "");
  
  // Debounce search
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchValue) {
        params.set("q", searchValue);
      } else {
        params.delete("q");
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchValue, pathname, router]); // searchParams omitted to avoid infinite loop when URL updates

  const toggleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentValues = params.getAll(key);
    
    if (currentValues.includes(value)) {
      const newValues = currentValues.filter((v) => v !== value);
      params.delete(key);
      newValues.forEach((v) => params.append(key, v));
    } else {
      params.append(key, value);
    }
    
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    router.push(`${pathname}?${params.toString()}`);
  };

  const activeFiltersCount = 
    (searchParams.getAll("industry").length) +
    (searchParams.getAll("location").length) +
    (searchParams.getAll("status").length) +
    (searchParams.getAll("capacity").length);

  return (
    <div className="sticky top-0 z-10 space-y-4 bg-background pb-4 pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search manufacturer, chemical, or CAS"
            className="pl-10"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <FacetedFilter
            title="Industry"
            options={INDUSTRY_OPTIONS.map(o => ({ label: o, value: o }))}
            selectedValues={new Set(searchParams.getAll("industry"))}
            onSelect={(value) => toggleFilter("industry", value)}
          />
          <FacetedFilter
            title="Location"
            options={LOCATION_OPTIONS.map(o => ({ label: o, value: o }))}
            selectedValues={new Set(searchParams.getAll("location"))}
            onSelect={(value) => toggleFilter("location", value)}
          />
          <FacetedFilter
            title="Status"
            options={STATUS_OPTIONS.map(o => ({ label: o, value: o }))}
            selectedValues={new Set(searchParams.getAll("status"))}
            onSelect={(value) => toggleFilter("status", value)}
          />
          <FacetedFilter
            title="Capacity"
            options={CAPACITY_OPTIONS}
            selectedValues={new Set(searchParams.getAll("capacity"))}
            onSelect={(value) => toggleFilter("capacity", value)}
          />

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-8 px-2 lg:px-3"
            >
              Clear filters
              <X className="ml-2 size-4" />
            </Button>
          )}
        </div>
      </div>

      <div 
        className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider" aria-live="polite"
      >
        {children}
        {activeFiltersCount > 0 && (
          <>
            <span className="size-1 rounded-full bg-zinc-300" />
            <span className="text-blue-600">{activeFiltersCount} {activeFiltersCount === 1 ? "filter" : "filters"} applied</span>
          </>
        )}
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchParams.getAll("industry").map((val) => (
            <Badge key={`industry-${val}`} variant="secondary" className="rounded-sm px-1 font-normal">
              Industry: {val}
              <button
                className="ml-1 rounded-full outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => toggleFilter("industry", val)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {searchParams.getAll("location").map((val) => (
            <Badge key={`location-${val}`} variant="secondary" className="rounded-sm px-1 font-normal">
              Location: {val}
              <button
                className="ml-1 rounded-full outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => toggleFilter("location", val)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {searchParams.getAll("status").map((val) => (
            <Badge key={`status-${val}`} variant="secondary" className="rounded-sm px-1 font-normal">
              Status: {val}
              <button
                className="ml-1 rounded-full outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => toggleFilter("status", val)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {searchParams.getAll("capacity").map((val) => (
            <Badge key={`capacity-${val}`} variant="secondary" className="rounded-sm px-1 font-normal">
              Capacity: {CAPACITY_OPTIONS.find(o => o.value === val)?.label || val}
              <button
                className="ml-1 rounded-full outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => toggleFilter("capacity", val)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface FacetedFilterProps {
  title: string;
  options: { label: string; value: string }[];
  selectedValues: Set<string>;
  onSelect: (value: string) => void;
}

function FacetedFilter({ title, options, selectedValues, onSelect }: FacetedFilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <Filter className="mr-2 size-4" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onSelect(option.value)}
                    data-checked={isSelected}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("size-4")} />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      options.forEach(o => {
                        if (selectedValues.has(o.value)) onSelect(o.value);
                      });
                    }}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
