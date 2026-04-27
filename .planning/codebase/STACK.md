# Technology Stack

**Analysis Date:** 2026-04-27
**Status:** Pre-implementation — stack is researched and decided; no source code exists yet. All entries reflect the planned stack from `.planning/research/STACK.md` and confirmed decisions in `.planning/PROJECT.md`.

---

## Languages

**Primary:**
- TypeScript 5+ — all backend services, frontend, and data pipeline code

**Secondary:**
- SQL — PostgreSQL schema, migrations, and complex queries

---

## Runtime

**Environment:**
- Node.js 20+ LTS

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (to be created at project init)

---

## Frameworks

**Core:**
- Next.js 14+ — App Framework; serves the internal dashboard UI and API routes in a single project

**Testing:**
- Not yet decided (standard Jest + Testing Library expected given the Node.js/Next.js stack)

**Build/Dev:**
- TypeScript compiler (`tsc`) — type checking
- PostCSS + Tailwind CSS — styling pipeline

---

## Key Dependencies

**Scraping & Browser Automation:**
- `crawlee` (latest) — industrial-grade scraping framework with built-in fingerprinting, proxy management, RequestQueue persistence, and retry logic. Primary tool for the Chemexcil discovery bot and manufacturer site crawler.
- `playwright` (latest) — browser automation backend for Crawlee; handles JavaScript-heavy manufacturer sites

**AI Extraction:**
- `instructor-js` (latest) — enforces Zod schemas on LLM outputs, guaranteeing structured extraction from unstructured website content. The single integration point between LLMs and the database.
- OpenAI SDK — GPT-4o-mini as the default extraction model (high throughput, lower cost)
- Anthropic SDK — Claude 3.5 Sonnet for deep technical reasoning on complex chemical data

**Job Queue & Pipeline Orchestration:**
- `bullmq` (latest) — job scheduling, parent-child pipeline flows, and per-domain rate limiting. Backs all async scraping and extraction stages.

**Data Validation:**
- `zod` (latest) — schema definition for all extraction outputs and API inputs. Critical for unit normalization (capacity in MT/year) and CAS number formatting.

**Database Client:**
- PostgreSQL 16 driver (e.g., `pg` or `drizzle-orm`) — TBD at Phase 1 implementation

**Caching:**
- `ioredis` — Redis 7 client; backs BullMQ and semantic response cache for AI calls

**Frontend — Data Grid & State:**
- `@tanstack/react-table` v8 — headless table logic for the high-density manufacturer grid
- `@tanstack/react-virtual` v3 — row virtualization for smooth scrolling over thousands of records
- `@tanstack/react-query` v5 — server-state management, background sync, and cache invalidation
- `shadcn/ui` (latest) — accessible UI component library built on Radix UI primitives

---

## Configuration

**Environment:**
- Runtime secrets and connection strings injected via `.env.local` (Next.js convention)
- Key variables required (names TBD at implementation):
  - `DATABASE_URL` — PostgreSQL connection string
  - `REDIS_URL` — Redis connection string
  - `OPENAI_API_KEY` — OpenAI API key
  - `ANTHROPIC_API_KEY` — Anthropic API key
  - Proxy provider credentials (provider TBD)

**Build:**
- `tsconfig.json` — TypeScript configuration (to be created)
- `next.config.js` — Next.js configuration (to be created)
- `tailwind.config.js` — Tailwind CSS configuration (to be created)

---

## Platform Requirements

**Development:**
- Node.js 20+ LTS
- PostgreSQL 16 instance (local Docker or managed)
- Redis 7 instance (local Docker or managed)
- Playwright browser binaries (installed via `npx playwright install`)

**Production:**
- Internal deployment — specific platform not yet decided
- Requires PostgreSQL and Redis as managed services or Docker-composed infrastructure

---

*Stack analysis: 2026-04-27*
