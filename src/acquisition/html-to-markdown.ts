import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// Create once at module level — TurndownService is stateless between conversions
const turndown = new TurndownService({ headingStyle: "atx" });
turndown.use(gfm); // D-04: enables <table> → Markdown table output

/**
 * Convert a raw HTML string to clean Markdown.
 *
 * @param html  Raw HTML content from page.content() (Playwright)
 * @param url   The page's URL — required by jsdom for correct relative-URL resolution
 * @returns     Markdown string; falls back to raw-HTML Turndown if Readability cannot parse
 */
export function htmlToMarkdown(html: string, url: string): string {
  // jsdom provides the DOM environment that Readability requires in Node.js
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.content) {
    // Readability could not extract readable content (SPA, thin page, pure JS shell),
    // or extracted an article with no content. Fall back to converting raw HTML —
    // still better than storing raw HTML for Phase 4.
    return turndown.turndown(html);
  }

  // MUST use article.content (cleaned HTML with structure intact).
  // DO NOT use article.textContent — that is plain text with all tags stripped,
  // which would flatten all tables to whitespace, violating D-04.
  return turndown.turndown(article.content);
}
