# Architecture Patterns

**Domain:** Chemical Sourcing Engine
**Researched:** April 2026

## Recommended Architecture

A multi-stage asynchronous pipeline to handle the transition from "Unstructured Web" to "Structured Database".

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Discovery Bot (Crawlee)** | Scrapes Chemexcil; populates Lead table. | Database (Postgres), Proxy Pool. |
| **Acquisition Service (Firecrawl)** | Crawls manufacturer URLs; converts to Markdown. | Discovery Bot, LLM Pipeline. |
| **Extraction Pipeline (Instructor)** | Extracts structured data from Markdown using LLMs. | Acquisition Service, Database. |
| **Internal Dashboard (Refine)** | UI for searching, filtering, and manual editing. | Database, AI Pipeline (for re-triggering). |

### Data Flow

1. **Discovery:** `Chemexcil -> [Discovery Bot] -> [Postgres: Leads]`
2. **Deep Crawl:** `[Postgres: Leads] -> [Firecrawl] -> [Markdown Assets]`
3. **Extraction:** `[Markdown Assets] -> [LLM + Pydantic Schema] -> [Postgres: Manufacturer Profiles]`
4. **Validation:** `[Postgres: Manufacturer Profiles] -> [PubChem API] -> [Verification Status]`

## Patterns to Follow

### Pattern 1: Schema-First Extraction
**What:** Define a Pydantic model *before* calling the LLM.
**When:** All extraction tasks.
**Example:**
```python
class ManufacturerProfile(BaseModel):
    name: str
    products: List[str]
    locations: List[str]
    capacity_metrics: Optional[Dict[str, str]]

# Instructor enforces this schema automatically
profile = client.chat.completions.create(
    response_model=ManufacturerProfile,
    messages=[...]
)
```

### Pattern 2: Headless Data Provider (Refine)
**What:** Decoupling the UI components from the data fetching logic.
**When:** Building the Dashboard.
**Why:** Allows switching from REST to GraphQL or Supabase later without touching the UI.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Raw HTML Extraction
**What:** Feeding raw HTML to an LLM.
**Why bad:** High token cost, noise (JS/CSS), and worse performance.
**Instead:** Convert to clean Markdown first.

### Anti-Pattern 2: Global State for Scrapers
**What:** Keeping state in memory during long crawls.
**Why bad:** Crashes lose all progress.
**Instead:** Use a queue-based system (Crawlee's built-in RequestQueue or Redis).

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Database** | Single Postgres RDS | Read Replicas | Sharding by Region |
| **Scraping** | Single Instance | Distributed Workers | Managed Browser Service |
| **AI Cost** | Direct API calls | Token Batching | Local LLM for pre-filtering |

## Sources

- [Instructor Patterns](https://jxnl.github.io/instructor/)
- [Refine Architecture Guide](https://refine.dev/docs/architecture/)
