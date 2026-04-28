"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface SourceFilterProps {
  sources: string[];
  active: string | null;
}

export function SourceFilter({ sources, active }: SourceFilterProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (sources.length === 0) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(() => {
      if (next === "") {
        router.push("/leads");
      } else {
        router.push(`/leads?source=${encodeURIComponent(next)}`);
      }
    });
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <label htmlFor="source-filter" className="text-sm font-medium text-zinc-700">
        Filter by source:
      </label>
      <select
        id="source-filter"
        value={active ?? ""}
        onChange={onChange}
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All sources</option>
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {active && (
        <span className="text-xs text-zinc-500">
          showing only <code className="rounded bg-zinc-100 px-1">{active}</code>
        </span>
      )}
    </div>
  );
}
