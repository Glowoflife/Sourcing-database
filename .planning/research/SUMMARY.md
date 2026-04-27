# Research Summary: Indian Chemical Sourcing Database

**Date:** April 27, 2026
**Status:** Research Complete

## Executive Summary

The Indian Chemical Sourcing Database is an internal supply chain intelligence platform designed to automate the discovery and technical profiling of chemical manufacturers. The project addresses the fragmentation of supplier data by transforming unstructured information from the Chemexcil directory and individual manufacturer websites into a high-fidelity, searchable database.

The recommended approach follows a multi-stage asynchronous pipeline: **Discovery** (scraping initial leads from Chemexcil), **Deep Crawl** (extracting raw site content), and **Structured AI Extraction** (using LLMs to normalize technical products, capacities, and locations). This architecture ensures scalability and data integrity. Key risks include unpredictable AI token costs and anti-bot measures, both of which are mitigated through intelligent page selection, Markdown conversion, and robust proxy management.

## Key Findings

### Technology Stack (from STACK.md)
- **Core:** Node.js 20+ LTS with TypeScript 5+ for type-safe data pipelines.
- **Scraping:** Crawlee and Playwright for industrial-grade browser automation and proxy management.
- **AI Extraction:** Instructor (JS) to enforce Zod schemas on LLM outputs (GPT-4o-mini for scale, Claude 3.5 Sonnet for technical reasoning).
- **Backend:** PostgreSQL 16 (Relational/JSONB) and Redis 7 (BullMQ) for robust job orchestration.
- **Frontend:** Next.js 14+ with TanStack (Table, Virtual, Query) for a performant, data-dense internal dashboard.

### Feature Landscape (from FEATURES.md)
- **Table Stakes:** Manufacturer directory, advanced technical search (CAS, Chemical Name), and contact management.
- **Differentiators:** Capacity extraction (e.g., "100 MT/month"), automated technical metadata, and AI-generated reliability scores for each data point.
- **MVP Focus:** Prioritizes the Discovery Engine (Chemexcil) and the Technical Scraper (AI extraction) to populate the core database.
- **Deferred:** Change detection and automated reliability scores are moved to V2.

### Architecture Patterns (from ARCHITECTURE.md)
- **Multi-Stage Pipeline:** Decouples discovery, acquisition (Markdown conversion), and extraction to allow for independent scaling and error handling.
- **Schema-First Extraction:** Uses Pydantic/Zod models *before* LLM calls to guarantee structured, valid data.
- **Headless UI:** Recommends decoupling UI from data fetching (e.g., Refine pattern) to maintain flexibility in the data layer.
- **Anti-Pattern Warning:** Avoid feeding raw HTML to LLMs; always convert to Markdown to minimize token costs and noise.

### Critical Pitfalls (from PITFALLS.md)
- **Unbounded AI Costs:** Large crawls can lead to expensive token usage. Mitigation: Use "Stagehand" logic to identify high-value pages first.
- **Anti-Bot Blocking:** Chemexcil and manufacturer sites may block IPs. Mitigation: Crawlee fingerprinting and proxy rotation.
- **Unit Normalization:** Extracted capacity units (MT, kg, tonnes) must be normalized via strict Zod enums or secondary AI steps.

## Implications for Roadmap

### Suggested Phase Structure

1. **Phase 1: Discovery Engine & Data Foundation**
   - **Rationale:** Establishes the lead list needed for all subsequent steps.
   - **Delivers:** Chemexcil scraper, Lead management UI, and core Postgres schema.
   - **Pitfall Avoidance:** Implement proxy rotation early to avoid IP burning.

2. **Phase 2: Technical Scraper & AI Extraction**
   - **Rationale:** The most complex part of the project; turns "leads" into "intelligence."
   - **Delivers:** Firecrawl-based acquisition, LLM extraction pipeline, and technical data mapping.
   - **Pitfall Avoidance:** Implement Markdown conversion and token-usage monitoring immediately.

3. **Phase 3: Intelligence Dashboard**
   - **Rationale:** Focuses on the consumption of the high-quality data generated in Phases 1 & 2.
   - **Delivers:** Advanced search, TanStack Table views, and procurement decision support tools.
   - **Pitfall Avoidance:** Use virtualization for large manufacturer lists to ensure UI responsiveness.

### Research Flags
- **Needs Research:** Phase 2 (AI Extraction) requires a `/gsd-research-phase` to benchmark different LLM prompts for specific chemical technical data and unit normalization.
- **Standard Patterns:** Phase 1 (Discovery) and Phase 3 (Dashboard) follow well-documented patterns (Crawlee/Next.js) and can likely skip deep research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Mature ecosystem with specific libraries (Crawlee/Instructor) designed for this use case. |
| Features | HIGH | Clear alignment between business needs and technological capabilities. |
| Architecture | HIGH | Asynchronous pipeline is a proven pattern for web-to-data projects. |
| Pitfalls | MEDIUM | AI costs and site-specific scraping blockers are inherently unpredictable and require ongoing tuning. |

**Gaps to Address:**
- Specific proxy provider selection (dependent on Chemexcil's difficulty).
- Selection of primary LLM model based on cost/performance benchmarks for chemical terminology.

## Sources
- BullMQ, Crawlee, TanStack, and Instructor official documentation.
- Scraping Best Practices 2026.
- Refine Architecture Guide.
- Project Requirements (PROJECT.md).
