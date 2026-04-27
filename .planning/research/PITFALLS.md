# Domain Pitfalls

**Domain:** Web Scraping & AI Extraction
**Researched:** April 27, 2026

## Critical Pitfalls

### Pitfall 1: Unbounded AI Costs
**What goes wrong:** A recursive crawler visits 1,000 pages of a large manufacturer site, sending each page to GPT-4o.
**Consequences:** A single company crawl could cost $50-$100 in tokens.
**Prevention:**
- Use **Stagehand** to identify high-value pages ("Products", "About") before extraction.
- Implement **Semantic Caching** to avoid redundant extractions.
- Convert HTML to Markdown to reduce input token count.

### Pitfall 2: Anti-Bot Blocking
**What goes wrong:** Large directories (like Chemexcil) or modern manufacturer sites detect headless browsers and block IPs.
**Consequences:** Scraping stops entirely; IP reputation is burned.
**Prevention:**
- Use **Crawlee's Fingerprinting** and proxy rotation.
- Implement human-like delays and avoid hitting the same domain too fast (Queue rate limiting).

## Moderate Pitfalls

### Pitfall 3: Inconsistent Technical Units
**What goes wrong:** LLM extracts "100 MT", "10,000 kg", and "100 tonnes" for different manufacturers.
**Prevention:** Use Zod schemas with strict unit enums or a secondary normalization step (e.g., "Always convert to Metric Tonnes").

### Pitfall 4: Stale Data
**What goes wrong:** A manufacturer updates their product list, but the database reflects a crawl from 6 months ago.
**Prevention:** Store `last_scraped_at` and implement periodic re-crawl jobs in BullMQ.

## Minor Pitfalls

### Pitfall 5: Broken Links
**What goes wrong:** Manufacturers move their "Products" page to a new URL.
**Prevention:** The crawler should be designed to re-discover the "Products" link from the homepage on every run rather than hardcoding sub-URLs.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Discovery** | IP Blocking | Proxies & Rate Limiting. |
| **Extraction** | Hallucinations | Structured output (Instructor) + Confidence checks. |
| **Dashboard** | Laggy UI | TanStack Virtualization. |

## Sources

- [Scraping Best Practices 2026]
- [Context7 Library Insights: Playwright & Crawlee]
