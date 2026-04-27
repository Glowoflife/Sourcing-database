---
updated_at: "2026-04-27T12:00:00Z"
---

## Architecture Overview

The Sourcing Database is a high-performance procurement intelligence system built with Next.js and Drizzle ORM. It employs a multi-stage pipeline (Discovery -> Acquisition -> Extraction) to transform raw manufacturer data into structured technical profiles.

## Key Components

| Component | Path | Responsibility |
|-----------|------|---------------|
| Database Schema | `src/db/schema.ts` | Source of truth for leads, manufacturers, products, and sourcing workflow. |
| Discovery Engine | `src/discovery/` | Scrapers for seeding the database with initial leads (e.g., Chemexcil). |
| Acquisition Pipeline | `src/acquisition/` | Crawls manufacturer websites and converts HTML to token-efficient Markdown. |
| AI Extraction | `src/extraction/` | Uses LLMs (Anthropic) to extract structured technical data from Markdown. |
| Background Workers | `src/workers/` | Orchestrates long-running acquisition and extraction jobs using BullMQ/Redis. |
| Dashboard | `src/app/(dashboard)/` | High-density search and discovery interface for procurement teams. |
| Workflow API | `src/app/api/leads/` | Manages sourcing status transitions and internal collaboration notes. |

## Data Flow

1. **Seed**: Chemexcil scraper seeds `leads` table with basic info.
2. **Crawl**: `acquisition` worker downloads site content, converts to Markdown, stores in `leads.raw_content`.
3. **Extract**: `extraction` worker sends Markdown to LLM, parses technical data into `manufacturers`, `products`, and `locations`.
4. **Review**: Users filter and search in the Dashboard, update `sourcing_status`, and add `lead_notes`.

## Conventions

- **Database**: Drizzle ORM with PostgreSQL.
- **Queueing**: BullMQ for job persistence and retry logic.
- **UI**: Shadcn UI components with Tailwind CSS.
- **State Management**: URL-driven state for search and filters in the dashboard.
- **Intelligence**: Evidence-based extraction with structured JSON outputs from LLMs.
