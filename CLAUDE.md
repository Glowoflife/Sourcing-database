# Indian Chemical Sourcing Database

## Project Context
A comprehensive intelligence database and CRM for Indian chemical manufacturers, automating discovery from Chemexcil and technical extraction from manufacturer websites.

## Development Workflows
This project uses the **Get Shit Done (GSD)** framework.

- **Phase Management**: `/gsd-discuss-phase [N]`, `/gsd-plan-phase [N]`, `/gsd-execute-phase [N]`
- **Current Goal**: Initializing Phase 1 (Lead Foundation & Import).
- **Core Value**: Automated discovery and deep technical profiling for data-driven procurement.

## Guiding Principles
1. **Technical Integrity**: All extraction must be schema-validated (Zod) and unit-normalized.
2. **Efficiency**: Use Markdown conversion for websites before AI extraction to minimize token costs.
3. **Resilience**: Implement proxy rotation and rate limiting for all scraping operations.

## Project Reference
- **Requirements**: .planning/REQUIREMENTS.md
- **Roadmap**: .planning/ROADMAP.md
- **Current State**: .planning/STATE.md
