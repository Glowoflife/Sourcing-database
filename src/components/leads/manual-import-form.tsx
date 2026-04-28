"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImportResultFeedback, type ImportResult } from "./import-result-feedback";

interface ApiResponse {
  inserted?: number;
  skipped?: number;
  errors?: Array<{ row: number; error: string }>;
  error?: string;
}

interface ParsedRow {
  name: string;
  url: string;
}

// Accepts lines like:
//   Acme Chem, https://acme.example.com
//   Acme Chem<TAB>https://acme.example.com
//   https://acme.example.com   (name defaults to hostname)
function parsePastedRows(raw: string): ParsedRow[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const tabSplit = line.split("\t");
      if (tabSplit.length >= 2) {
        return { name: tabSplit[0].trim(), url: tabSplit.slice(1).join("\t").trim() };
      }
      const commaIdx = line.indexOf(",");
      if (commaIdx > 0) {
        return { name: line.slice(0, commaIdx).trim(), url: line.slice(commaIdx + 1).trim() };
      }
      let host = line;
      try {
        host = new URL(line).hostname.replace(/^www\./, "");
      } catch {
        // leave host as-is; backend Zod will reject if URL is invalid
      }
      return { name: host, url: line };
    });
}

export function ManualImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rows = parsePastedRows(text);
    if (rows.length === 0) {
      setResult({ kind: "error", message: "Paste at least one row in the form 'Name, https://example.com'." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/leads/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: source.trim() || undefined, rows }),
        });
        const data: ApiResponse = await res.json();

        if (!res.ok) {
          setResult({
            kind: "error",
            message: data.error ?? "Import failed. Please try again.",
          });
          return;
        }

        setResult({
          kind: "success",
          inserted: data.inserted ?? 0,
          skipped: data.skipped ?? 0,
          errorCount: data.errors?.length ?? 0,
        });
        setText("");
        router.refresh();
      } catch {
        setResult({
          kind: "error",
          message: "Import failed. Please try again or contact support if the problem persists.",
        });
      }
    });
  }

  return (
    <section
      aria-label="Manual lead entry"
      className="mb-8 rounded-lg border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-xl font-semibold leading-tight">Add Leads From Any Source</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Paste rows from any directory or list — one per line as{" "}
        <code className="rounded bg-zinc-100 px-1">Name, https://example.com</code> (comma or tab
        separated). Duplicate URLs are skipped automatically.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label htmlFor="manual-source" className="text-sm font-medium text-zinc-700">
          Source label <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="manual-source"
          type="text"
          placeholder="e.g. Pharmexcil directory 2026"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label htmlFor="manual-rows" className="text-sm font-medium text-zinc-700">
          Rows
        </label>
        <textarea
          id="manual-rows"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={"Acme Chem, https://acme.example.com\nBeta Industries, https://beta.example.com"}
          className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {text.trim().length === 0 ? "0" : parsePastedRows(text).length} row
            {parsePastedRows(text).length === 1 ? "" : "s"} ready
          </span>
          <Button
            type="submit"
            disabled={pending || text.trim().length === 0}
            className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {pending ? "Importing…" : "Add Leads"}
          </Button>
        </div>
      </form>
      <ImportResultFeedback result={result} />
    </section>
  );
}
