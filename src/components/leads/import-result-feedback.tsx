"use client";

import { useEffect, useRef } from "react";

export type ImportResult =
  | { kind: "success"; inserted: number; skipped: number; errorCount: number }
  | { kind: "error"; message: string };

export function ImportResultFeedback({ result }: { result: ImportResult | null }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (result) {
      ref.current?.focus();
    }
  }, [result]);

  if (!result) return null;

  let copy: string;
  if (result.kind === "error") {
    copy = result.message;
  } else if (result.errorCount > 0) {
    copy = `${result.inserted} imported, ${result.skipped} skipped. ${result.errorCount} rows had errors — check that each row has a valid name and URL.`;
  } else {
    copy = `${result.inserted} leads imported. ${result.skipped} duplicates skipped.`;
  }

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      tabIndex={-1}
      className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {copy}
    </div>
  );
}
