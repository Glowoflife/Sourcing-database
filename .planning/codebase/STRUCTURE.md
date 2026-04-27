# Codebase Structure

**Analysis Date:** 2026-04-27
**Status:** Pre-implementation — no source code exists yet. This document defines the canonical structure to be built. All Phase plans must conform to this layout. The only files currently on disk are in `.planning/`.

---

## Directory Layout

```
sourcing-database/                  # Project root
├── .planning/                      # GSD framework planning docs (NOT app code)
│   ├── codebase/                   # Codebase map docs (this directory)
│   ├── research/                   # Pre-project research outputs
│   ├── PROJECT.md                  # Product requirements and constraints
│   ├── REQUIREMENTS.md             # Detailed v1/v2 requirements with traceability
│   ├── ROADMAP.md                  # Phase breakdown
│   ├── STATE.md                    # Current execution state
│   └── config.json                 # GSD workflow configuration
├── src/
│   ├── app/                        # Next.js App Router root
│   │   ├── (dashboard)/            # Route group for internal dashboard pages
│   │   │   ├── page.tsx            # Manufacturer list / main dashboard
│   │   │   ├── [id]/               # Manufacturer detail view
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx          # Dashboard shell layout
│   │   └── api/                    # Next.js API routes
│   │       ├── manufacturers/      # CRUD + sourcing status endpoints
│   │       │   ├── route.ts        # GET (list), POST
│   │       │   └── [id]/
│   │       │       ├── route.ts    # GET, PATCH
│   │       │       ├── notes/
│   │       │       │   └── route.ts
│   │       │       └── status/
│   │       │           └── route.ts
│   │       └── leads/              # Lead management endpoints
│   │           └── route.ts        # GET (list), POST (CSV import)
│   ├── db/                         # Database layer
│   │   ├── schema.ts               # Table definitions (PostgreSQL via drizzle or raw SQL)
│   │   ├── migrations/             # Numbered SQL migration files
│   │   └── index.ts                # DB client singleton export
│   ├── schemas/                    # Zod schemas (shared between extraction and API)
│   │   ├── manufacturer.ts         # ManufacturerProfile Zod schema + TypeScript types
│   │   ├── extraction.ts           # ExtractionSchema passed to Instructor for LLM calls
│   │   ├── lead.ts                 # Lead Zod schema + status enum
│   │   └── import.ts               # CSV/JSON import validation schema (Phase 1)
│   ├── discovery/                  # Phase 2: Chemexcil discovery bot
│   │   ├── chemexcil-crawler.ts    # Crawlee crawler config for Chemexcil pagination
│   │   └── index.ts                # Discovery entry point / CLI runner
│   ├── acquisition/                # Phase 3: Manufacturer website crawler
│   │   ├── site-crawler.ts         # Crawlee crawler for manufacturer sites
│   │   ├── html-to-markdown.ts     # HTML → Markdown conversion utility
│   │   └── index.ts                # Acquisition job handler
│   ├── extraction/                 # Phase 4: AI extraction pipeline
│   │   ├── instructor-client.ts    # Instructor setup (OpenAI + Anthropic)
│   │   ├── extract-profile.ts      # Main extraction function (Markdown → ManufacturerProfile)
│   │   ├── normalize-capacity.ts   # Unit normalization to MT/year
│   │   └── index.ts                # Extraction job handler
│   ├── workers/                    # BullMQ worker definitions
│   │   ├── acquisition.worker.ts   # Processes acquisition jobs
│   │   ├── extraction.worker.ts    # Processes extraction jobs
│   │   ├── queues.ts               # Queue and FlowProducer definitions
│   │   └── index.ts                # Worker process entry point
│   ├── components/                 # React UI components
│   │   ├── manufacturer-table/     # TanStack Table + Virtual grid
│   │   ├── manufacturer-detail/    # Full profile view
│   │   ├── sourcing-actions/       # Approve/Reject/Flag UI
│   │   └── ui/                     # shadcn/ui component re-exports
│   └── lib/                        # Shared utilities
│       ├── redis.ts                # Redis client singleton (ioredis)
│       └── logger.ts               # Structured logger
├── CLAUDE.md                       # Claude Code project guidance
├── package.json                    # (to be created at Phase 1)
├── tsconfig.json                   # (to be created at Phase 1)
├── next.config.js                  # (to be created at Phase 1)
└── .env.local                      # Local secrets (git-ignored)
```

---

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Dashboard pages (React Server Components + Client Components), REST API route handlers
- Key files: `src/app/(dashboard)/page.tsx` (main list view), `src/app/api/manufacturers/route.ts`

**`src/db/`:**
- Purpose: All database interaction code
- Contains: Schema definitions, migration files, and the typed DB client export
- Key files: `src/db/schema.ts`, `src/db/index.ts`

**`src/schemas/`:**
- Purpose: Zod schemas that are the single source of truth for all data shapes
- Contains: Extraction schemas (passed to Instructor), API request/response schemas, import validation
- Key files: `src/schemas/extraction.ts` (critical — defines what the LLM must produce), `src/schemas/manufacturer.ts`

**`src/discovery/`:**
- Purpose: Phase 2 Chemexcil scraper
- Contains: Crawlee crawler configuration, pagination logic, lead writer
- Activated: Phase 2

**`src/acquisition/`:**
- Purpose: Phase 3 manufacturer website crawler and HTML-to-Markdown converter
- Contains: Site crawler, Markdown conversion utility
- Activated: Phase 3

**`src/extraction/`:**
- Purpose: Phase 4 AI extraction pipeline
- Contains: Instructor client, extraction functions, unit normalization
- Activated: Phase 4

**`src/workers/`:**
- Purpose: BullMQ worker process (runs separately from the Next.js server)
- Contains: Worker definitions, queue configs, process entry point
- Activated: Phase 3 (when async jobs first appear)

**`src/components/`:**
- Purpose: React components for the dashboard
- Contains: TanStack Table-based grid, detail views, CRM action components
- Activated: Phase 5

**`src/lib/`:**
- Purpose: Shared singletons and utility functions used across layers
- Contains: Redis client, logger
- Key files: `src/lib/redis.ts`, `src/lib/logger.ts`

**`.planning/`:**
- Purpose: GSD framework planning documents — not application code
- Generated: No (human/AI authored)
- Committed: Yes

---

## Key File Locations

**Entry Points:**
- `src/app/` — Next.js app (dashboard + API)
- `src/workers/index.ts` — BullMQ worker process entry point
- `src/discovery/index.ts` — Discovery bot entry point (CLI or scheduled)

**Configuration:**
- `package.json` — dependencies and scripts
- `tsconfig.json` — TypeScript configuration
- `.env.local` — runtime secrets (git-ignored)

**Core Logic:**
- `src/schemas/extraction.ts` — Zod schema defining the LLM extraction contract
- `src/extraction/extract-profile.ts` — the primary extraction function
- `src/db/schema.ts` — database table definitions

**Testing:**
- `src/**/*.test.ts` or `src/**/*.spec.ts` — co-located unit tests (convention TBD at Phase 1)

---

## Naming Conventions

**Files:**
- `kebab-case.ts` for all TypeScript source files (e.g., `html-to-markdown.ts`, `extract-profile.ts`)
- `PascalCase.tsx` for React component files (e.g., `ManufacturerTable.tsx`)
- `kebab-case/` for directories

**Directories:**
- Feature directories use `kebab-case` (e.g., `src/acquisition/`, `src/extraction/`)
- Next.js route groups use parentheses convention: `src/app/(dashboard)/`

---

## Where to Add New Code

**New pipeline stage:**
- Create a new directory under `src/` (e.g., `src/validation/`)
- Add a corresponding BullMQ worker in `src/workers/`
- Add any new Zod schemas to `src/schemas/`

**New database table:**
- Add table definition to `src/db/schema.ts`
- Add a new numbered migration file to `src/db/migrations/`

**New API endpoint:**
- Add route handler under `src/app/api/[resource]/route.ts`
- Validate request body with a Zod schema from `src/schemas/`

**New dashboard page:**
- Add page under `src/app/(dashboard)/[page-name]/page.tsx`
- Fetch server state via TanStack Query calling the relevant API route

**New UI component:**
- Add to `src/components/[feature-name]/` directory
- Use shadcn/ui primitives from `src/components/ui/`

**New shared utility:**
- Add to `src/lib/` as a singleton (e.g., a new API client)

**New Zod schema:**
- Add to `src/schemas/` — schemas are shared between extraction, API validation, and import validation

---

## Special Directories

**`.planning/`:**
- Purpose: GSD framework planning docs, research outputs, roadmap, and state tracking
- Generated: No
- Committed: Yes — these are the project specification

**`src/db/migrations/`:**
- Purpose: Numbered SQL migration files executed in sequence to evolve the schema
- Generated: No (hand-authored or generated by drizzle-kit)
- Committed: Yes

---

*Structure analysis: 2026-04-27*
