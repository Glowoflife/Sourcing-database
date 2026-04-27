import type { ManufacturerPage } from "@/db/schema";

// Priority ordering for page types — lower number = higher priority (kept in prompt if truncation needed)
// D-03: products > about > homepage > other
const PAGE_PRIORITY: Record<string, number> = {
  products: 0, // highest — most likely to contain CAS numbers and product lists
  about: 1,
  homepage: 2,
  other: 3, // lowest — truncated first when over cap
};

// D-03: 350,000 chars ≈ 87,500 tokens at 4 chars/token.
// GPT-4o-mini context: 128,000 tokens; max output: 16,384 tokens.
// Safe input budget: ~109,000 tokens. 350,000 chars provides a 20% safety buffer.
export const CHAR_CAP = 350_000;

export interface BuildPromptResult {
  content: string;
  droppedChars: number; // total chars dropped due to truncation (0 if no truncation)
}

// buildPrompt implements D-01 (single prompt), D-02 (page ordering + section headers), D-03 (truncation)
export function buildPrompt(pages: ManufacturerPage[]): BuildPromptResult {
  if (pages.length === 0) {
    throw new Error("buildPrompt called with empty pages array — no content to extract from");
  }

  // D-02: Sort by priority (products first, other last). Use stable sort by preserving original
  // crawl order within the same priority tier (Array.sort is stable in Node.js 11+).
  const sorted = [...pages].sort(
    (a, b) => (PAGE_PRIORITY[a.pageType] ?? 3) - (PAGE_PRIORITY[b.pageType] ?? 3),
  );

  let combined = "";
  let droppedChars = 0;

  for (const page of sorted) {
    // D-02: Section header format exactly as specified — lowercase pageType value from DB enum
    const section = `## [Page Type: ${page.pageType}] ##\n\n${page.markdownContent}\n\n`;

    // D-03: Check total length before appending — never truncate mid-page
    if (combined.length + section.length > CHAR_CAP) {
      droppedChars += section.length;
      continue; // skip this page; log warning in the caller (index.ts)
    }

    combined += section;
  }

  return { content: combined, droppedChars };
}
