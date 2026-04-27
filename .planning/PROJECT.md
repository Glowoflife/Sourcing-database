# Indian Chemical Sourcing Database

## What This Is

A comprehensive intelligence database and CRM for Indian chemical manufacturers. The system automates the discovery of suppliers by scraping directories (e.g., Chemexcil) and performs deep, AI-assisted extraction from manufacturer websites to build detailed profiles including product lines, industries served, manufacturing locations, and production capacities.

## Core Value

Automated discovery and deep technical profiling of the Indian chemical supply chain to enable rapid, data-driven procurement for internal teams.

## Requirements

### Validated

- [x] **Discovery Engine**: Automated scraper for Chemexcil to identify supplier names and URLs. *Validated in Phase 2: Automated Discovery*
- [x] **Acquisition Pipeline**: BullMQ-backed crawler that visits manufacturer websites, converts HTML to Markdown, and stores content in manufacturer_pages. *Validated in Phase 3: Technical Acquisition Pipeline*

### Active

- [ ] **Extraction Pipeline**: AI-driven crawler to visit manufacturer websites and extract technical metadata (Products, Locations, Capacity).
- [ ] **Central Database**: Structured storage for manufacturers, chemicals (with CAS numbers), and market intel.
- [ ] **Internal Dashboard**: React-based web interface for searching, filtering, and managing supplier relationships.
- [ ] **Relationship Management**: Ability for team members to add notes, reliability scores, and communication history.

### Out of Scope

- **Public Access**: The database is for internal team use only.
- **Direct Transaction Processing**: Payment/Order processing is deferred; the focus is on sourcing and vetting.

## Context

- **Source Material**: Primary seed data from [Chemexcil](https://chemexcil.in/members).
- **Extraction Challenge**: Manufacturer websites are unstructured; requires LLM-based extraction for high-fidelity data.
- **Industry Focus**: Indian Chemical Manufacturing sector.

## Constraints

- **Tech Stack**: React for frontend; likely Node.js/Python for the scraping and AI extraction layer.
- **Data Quality**: Must handle technical chemical identifiers (CAS numbers) and varied capacity units.
- **Scraping Compliance**: Must respect rate limits and robots.txt to maintain long-term access to sources.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web Dashboard (React) | User preference for internal team interaction | — Pending |
| Two-Stage Discovery | Chemexcil for leads + Deep Crawl for technical data | — Pending |

---
## Current State

Phase 3 complete — acquisition pipeline ships and smoke-tested. manufacturer_pages table live in Neon PostgreSQL. 4 code review defects (CR-01 through CR-04) logged for fix before Phase 4 runs at scale.

*Last updated: 2026-04-27 after Phase 3 completion*
