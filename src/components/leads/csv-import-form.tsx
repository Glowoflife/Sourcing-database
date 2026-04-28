"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImportResultFeedback, type ImportResult } from "./import-result-feedback";

interface ApiResponse {
  inserted?: number;
  skipped?: number;
  errors?: Array<{ row: number; error: string }>;
  error?: string;
}

export function CsvImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setResult({ kind: "error", message: "No file selected. Please choose a CSV or XLSX file before importing." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (source.trim().length > 0) formData.append("source", source.trim());

    startTransition(async () => {
      try {
        const res = await fetch("/api/leads/import", {
          method: "POST",
          body: formData,
        });
        const data: ApiResponse = await res.json();

        if (!res.ok) {
          const message =
            res.status === 422
              ? "Could not read the file. Make sure it has name and url columns."
              : data.error ?? "Import failed. Please try again or contact support if the problem persists.";
          setResult({ kind: "error", message });
          return;
        }

        setResult({
          kind: "success",
          inserted: data.inserted ?? 0,
          skipped: data.skipped ?? 0,
          errorCount: data.errors?.length ?? 0,
        });

        if (fileInputRef.current) fileInputRef.current.value = "";
        setFile(null);
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
    <section aria-label="Import leads" className="mb-8 rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="text-xl font-semibold leading-tight">Import Leads (CSV or XLSX)</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Upload a file with columns: <code className="rounded bg-zinc-100 px-1">name</code>,{" "}
        <code className="rounded bg-zinc-100 px-1">url</code>. Duplicate URLs are skipped.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="csv-source" className="text-sm font-medium text-zinc-700">
            Source label <span className="font-normal text-zinc-500">(optional — defaults to &quot;manual&quot;)</span>
          </label>
          <input
            id="csv-source"
            type="text"
            placeholder="e.g. Pharmexcil 2026 export"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="csv-file" className="sr-only">
            CSV or XLSX file
          </label>
          <input
            ref={fileInputRef}
            id="csv-file"
            name="file"
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-200"
          />
          <Button
            type="submit"
            disabled={!file || pending}
            className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {pending ? "Importing…" : "Import Leads"}
          </Button>
        </div>
      </form>
      <ImportResultFeedback result={result} />
    </section>
  );
}
