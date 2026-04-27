---
mapped: 2026-04-27
focus: quality
---

# Coding Conventions

## File Naming

- TypeScript modules: `kebab-case.ts` (e.g., `normalize-capacity.ts`, `html-to-markdown.ts`)
- React components: `PascalCase.tsx` (e.g., `LeadTable.tsx`, `DashboardLayout.tsx`)
- BullMQ job processors: `kebab-case.processor.ts`
- Zod schemas: `kebab-case.schema.ts`
- Test files: co-located as `kebab-case.test.ts`

## Schema-First Pattern (Zod)

Zod is the single source of truth for all data shapes:

- Define schema before any function that produces or consumes that data
- Derive TypeScript types via `z.infer<>` — never write duplicate interfaces
- Never use `any` — always parse external inputs through `.safeParse()` before use
- Never use raw `JSON.parse()` on LLM responses — always parse through an `instructor-js` + Zod schema

```ts
// Correct pattern
const CapacitySchema = z.object({
  valueInMT: z.number(),
  unit: z.string(),
});
type Capacity = z.infer<typeof CapacitySchema>;

// Wrong — duplicates the schema
interface Capacity {
  valueInMT: number;
  unit: string;
}
```

## Import Order

1. Node.js built-ins (`node:path`, `node:fs`)
2. External packages (`zod`, `bullmq`, `crawlee`)
3. Internal `@/` path aliases (`@/lib/...`, `@/schemas/...`)

## Error Handling

- All BullMQ job handlers must have structured `try/catch` blocks
- Use `.safeParse()` on all external inputs (LLM responses, scraped HTML, API payloads)
- Log failures with structured fields: `leadId`, `stage`, `status`, `error`, `durationMs`
- Never swallow errors silently — always log before re-throwing or marking job as failed

## Structured Logging

Required fields on every log entry in pipeline processors:

```ts
logger.info({
  leadId: string,
  stage: 'discovery' | 'acquisition' | 'extraction' | 'enrichment',
  status: 'started' | 'completed' | 'failed' | 'skipped',
  durationMs: number,
  // optional contextual fields
});
```

## Pipeline-Specific Constraints

- **HTML → Markdown before extraction**: Always convert fetched HTML to Markdown via `html-to-markdown.ts` before passing to the LLM extractor. This reduces token cost and prevents prompt injection from raw HTML.
- **Unit normalization**: All capacity values must be normalized to MT/year in `normalize-capacity.ts`. Never store raw scraped units — always normalize at extraction time.
- **Proxy rotation**: All Crawlee/Playwright requests must go through the proxy rotation pool. Direct requests are disallowed in production scraping jobs.
- **Rate limiting**: All external HTTP calls (Chemexcil, manufacturer sites, Bhashini, Arasaac) must go through the rate limiter middleware.
