---
mapped: 2026-04-27
focus: quality
---

# Testing Strategy

## Framework

- **Unit + Integration**: Jest + ts-jest (standard for Next.js/Node.js stack)
- **E2E / scraping**: Playwright (already a runtime dependency — reuse for test fixtures)
- **Status**: Framework not yet installed (pre-implementation). Confirm at Phase 1 setup.

## Test File Location

Co-located with source:

```
src/
  lib/
    normalize-capacity.ts
    normalize-capacity.test.ts       ← unit test alongside source
    html-to-markdown.ts
    html-to-markdown.test.ts
  jobs/
    discovery.processor.ts
    discovery.processor.test.ts      ← integration test alongside processor
```

## Unit Test Priorities

| File | Why Critical |
|------|-------------|
| `normalize-capacity.ts` | Core correctness requirement — all capacity must be MT/year |
| `html-to-markdown.ts` | Gates every extraction — broken conversion = broken pipeline |
| Zod schemas | Validate that schemas reject invalid shapes (not just accept valid ones) |
| API route handlers | Validate request parsing, auth checks, response shapes |

## Integration Test Priorities

| Component | Strategy |
|-----------|----------|
| BullMQ job processors | Real Redis instance (use `ioredis-mock` for unit, real Redis for integration) |
| PostgreSQL DAOs | Real Postgres via Docker in CI; test DB seeded with fixtures |
| Chemexcil scraper | Record/replay HTTP fixtures — never hit live site in CI |
| LLM extraction pipeline | Mock `instructor-js` calls with fixture Markdown → expected Zod output |

## Mocking Strategy

**Mock these:**
- `instructor-js` LLM calls — use fixture Markdown inputs and expected parsed outputs
- Crawlee/Playwright HTTP requests — record/replay with fixture HTML files
- External APIs (Chemexcil, manufacturer sites) — fixture responses only

**Never mock these:**
- Zod schemas — always test real `.parse()` / `.safeParse()` behavior
- `normalize-capacity.ts` — pure function, test the real implementation
- `html-to-markdown.ts` — pure function, test with real HTML fixtures

## Coverage Targets

| Layer | Target |
|-------|--------|
| Pure utility functions (`normalize-capacity`, `html-to-markdown`) | 100% |
| Zod schema validation (valid + invalid inputs) | 100% |
| BullMQ job processors (happy path + failure path) | ≥80% |
| API routes | ≥70% |
| Discovery/acquisition scrapers | Integration fixtures only |

## CI Behavior

- Unit tests: run on every push (no external services)
- Integration tests: run on PRs and main branch (requires Docker for Redis + Postgres)
- Scraping tests: fixture-based only — never hit live sites in CI
