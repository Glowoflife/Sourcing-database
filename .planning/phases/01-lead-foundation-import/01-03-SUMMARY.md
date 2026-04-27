---
plan: "01-03"
phase: "01"
status: complete
completed: 2026-04-27
---

# Plan 01-03 Summary: Leads Dashboard Shell, Status Table, and CSV Import UI

## What Was Built

Full user-facing surface for Phase 1 — DISC-02 (lifecycle status visibility) and DISC-03 (CSV import UI):

1. **`src/components/ui/table.tsx`** — shadcn Table primitives (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)
2. **`src/components/ui/badge.tsx`** — shadcn Badge primitive
3. **`src/lib/format-date.ts`** — `formatLeadDate(Date)` → `DD MMM YYYY` using `Intl.DateTimeFormat("en-GB")`
4. **`src/components/leads/status-badge.tsx`** — `StatusBadge` with explicit color contract (New=blue, Processing=yellow, Crawled=green, Errored=red), typed via `Record<LeadStatus, string>` for compile-time exhaustiveness
5. **`src/app/(dashboard)/layout.tsx`** — Dashboard shell: sidebar (w-56, border-r) with active "Leads" link (`aria-current="page"`) + main content area
6. **`src/components/leads/import-result-feedback.tsx`** — `"use client"` component: `role="status"`, `aria-live="polite"`, focus-on-update, verbatim UI-SPEC copy strings
7. **`src/components/leads/csv-import-form.tsx`** — `"use client"` form: file input + Import Leads button (min-h-44px), `useTransition` for loading state, `router.refresh()` post-import
8. **`src/app/(dashboard)/leads/page.tsx`** — React Server Component: SSR leads table ordered by `createdAt DESC`, `export const dynamic = "force-dynamic"`, empty-state copy verbatim from UI-SPEC

## Verified UI States

- **Empty state**: "No leads yet" / "Import a CSV above to add manufacturers." renders with colSpan=4
- **Populated state**: SSR table with Name/URL/Status/Added columns renders correctly after CSV import
- **Partial-success import**: `3 imported, 1 skipped. 1 rows had errors — check that each row has a valid name and URL.`
- **Build**: `npx next build` passes — all 5 routes (/, /_not-found, /api/leads, /api/leads/import, /leads) compile

## Security Mitigations Verified
- T-03-01 (XSS): JSX auto-escapes `{lead.name}` and `{lead.url}`; URL rendered as plain text, not `<a href>`
- T-03-02: `grep -r "@/db" src/components/` returns no matches — db never imported in client components

## Deviations from UI-SPEC
None — all color contracts, copy strings, ARIA attributes, and spacing values implemented verbatim.

## Self-Check: PASSED
- `npx tsc --noEmit` exits 0
- `npm run build` exits 0
- All 3 tasks committed atomically
