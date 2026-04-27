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
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setResult({ kind: "error", message: "No file selected. Please choose a CSV file before importing." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

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
              ? "Could not read the file. Make sure it is a valid CSV with name and url columns."
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

        // Reset the file input so a re-upload retriggers onChange
        if (fileInputRef.current) fileInputRef.current.value = "";
        setFile(null);

        // Re-fetch the Server Component data so the table updates
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
      <h2 className="text-xl font-semibold leading-tight">Import Leads</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Upload a CSV with columns: <code className="rounded bg-zinc-100 px-1">name</code>,{" "}
        <code className="rounded bg-zinc-100 px-1">url</code>. Duplicate URLs are skipped.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="csv-file" className="sr-only">
          CSV file
        </label>
        <input
          ref={fileInputRef}
          id="csv-file"
          name="file"
          type="file"
          accept=".csv"
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
      </form>
      <ImportResultFeedback result={result} />
    </section>
  );
}
