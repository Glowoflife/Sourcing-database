# Technology Stack

**Project:** Indian Chemical Sourcing Database
**Researched:** April 27, 2026

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Node.js** | 20+ LTS | Backend Runtime | Mature ecosystem for scraping, queues, and AI orchestration. |
| **TypeScript** | 5+ | Typing | Critical for managing complex Zod schemas and pipeline data flow. |
| **Next.js** | 14+ | App Framework | Excellent DX for internal tools, SSR for speed, and API routes. |

### Scraper & AI
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Crawlee** | Latest | Scraping Framework | Built-in finger-printing, proxy management, and retry logic. |
| **Playwright** | Latest | Browser Automation | Best-in-class for handling JS-heavy manufacturer sites. |
| **Instructor** | Latest | AI Extraction | Enforces Zod schemas on LLM outputs (OpenAI/Anthropic). |
| **OpenAI/Anthropic** | Latest | LLM Models | GPT-4o-mini for scale; Claude 3.5 Sonnet for deep technical reasoning. |

### Data & Queue
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 16 | Main Database | Structured relational data for suppliers; JSONB for flexible technical profiles. |
| **Redis** | 7 | Job Queue & Cache | Backend for BullMQ and semantic cache for AI responses. |
| **BullMQ** | Latest | Pipeline Engine | Robust job scheduling, parent-child flows, and rate limiting. |

### Frontend
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **TanStack Table** | 8 | Table Logic | Headless UI for data-dense grids with complex filtering. |
| **TanStack Virtual** | 3 | Performance | Virtualization for smooth scrolling with thousands of rows. |
| **TanStack Query** | 5 | State Management | Handles server-side state, caching, and background syncing. |
| **Shadcn/UI** | Latest | UI Components | Accessible, themed components built on Radix UI. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Scraper | Crawlee | Scrapy (Python) | Node.js aligns better with the React/Next.js frontend for a unified stack. |
| AI Schema | Instructor | LangChain | Instructor is lighter and more focused on structured data extraction. |
| Queue | BullMQ | SQS/Celery | BullMQ/Redis is faster for high-throughput scraping and easier to deploy locally. |

## Installation

```bash
# Core Dependencies
npm install next react react-dom lucide-react bullmq crawlee playwright zod instructor-js @tanstack/react-table @tanstack/react-virtual @tanstack/react-query

# Dev Dependencies
npm install -D typescript @types/node @types/react @types/react-dom postcss tailwindcss
```

## Sources

- [BullMQ Docs](https://docs.bullmq.io/)
- [Crawlee Docs](https://crawlee.dev/)
- [TanStack Docs](https://tanstack.com/)
- [Instructor JS](https://github.com/instructor-ai/instructor-js)
