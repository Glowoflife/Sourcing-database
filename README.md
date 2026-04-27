# Indian Chemical Sourcing Database

A comprehensive intelligence platform and CRM designed for the automated discovery and deep profiling of Indian chemical manufacturers. This system transforms unstructured web data into a high-fidelity database of supplier capabilities, technical products, and manufacturing capacity.

## 🚀 Overview

The **Sourcing Database** automates the end-to-end process of supplier intelligence:
1.  **Lead Discovery**: Aggregating initial manufacturer names and URLs from primary sources (e.g., Chemexcil).
2.  **Web Acquisition**: Crawling manufacturer websites and converting technical content into clean Markdown format.
3.  **AI Extraction**: Utilizing Large Language Models (LLMs) to extract structured technical data like CAS numbers, production capacities, and manufacturing locations.
4.  **Sourcing Dashboard**: An internal interface for procurement teams to search, filter, and manage supplier relationships.

## ✨ Key Features

-   **Multi-Stage Pipeline**: 
    -   `Discovery`: Chemexcil scraper for seed leads.
    -   `Acquisition`: Distributed crawler (BullMQ + Playwright) for website content harvesting.
    -   `Extraction`: AI-driven profiling for structured technical metadata.
-   **Technical Profiling**: Automated extraction of:
    -   Product lines with **CAS Number** validation.
    -   Manufacturing capacities (Metric Tons per Year).
    -   Global locations (Plants, R&D centers, Offices).
    -   Contact intelligence (Email, Phone, WhatsApp).
-   **Modern Stack**: Built with Next.js 15+, Drizzle ORM, and PostgreSQL.
-   **Internal CRM**: Note-taking and sourcing status management (Unqualified, Approved, Rejected, Flagged).

## 🛠 Tech Stack

-   **Frontend**: Next.js (App Router), React 19, Tailwind CSS, Shadcn/UI.
-   **Database**: PostgreSQL (Neon), Drizzle ORM.
-   **Pipeline & Workers**: BullMQ, Redis, Crawlee, Playwright.
-   **AI/LLM**: Instructor (Structured extraction), Anthropic Claude, OpenAI.
-   **Runtime**: Node.js (>=20.0.0).

## 📁 Project Structure

```text
src/
├── app/             # Next.js Application (Dashboard & API)
├── components/      # React UI Components (Shadcn + Custom)
├── db/              # Database Schema (Drizzle) and Migrations
├── discovery/       # Lead discovery scrapers (Chemexcil)
├── acquisition/     # Web crawling and Markdown conversion
├── extraction/      # AI extraction logic using LLMs
├── workers/         # BullMQ worker implementations
├── schemas/         # Zod validation schemas
└── lib/             # Shared utilities, queries, and logging
```

## 🚦 Getting Started

### Prerequisites

-   Node.js >= 20.0.0
-   Redis (for BullMQ)
-   PostgreSQL (Neon recommended)
-   LLM API Keys (Anthropic/OpenAI)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd sourcing-database
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Copy `.env.example` to `.env.local` and fill in your credentials.
    ```bash
    cp .env.example .env.local
    ```

4.  **Database Migration**:
    ```bash
    npm run db:push
    ```

### Running the Application

-   **Development Dashboard**: `npm run dev`
-   **Run Discovery**: `npm run discover`
-   **Run Acquisition Pipeline**: `npm run acquire`
-   **Run Extraction Pipeline**: `npm run extract`
-   **Start Workers**: `npm run worker`

## 📊 Pipeline Status

The project is currently in active development.
-   [x] Discovery Engine (Phase 2)
-   [x] Acquisition Pipeline (Phase 3)
-   [ ] AI Extraction Profiling (Phase 4 - Active)
-   [ ] Search & Discovery Dashboard (Phase 5)
-   [ ] Sourcing Workflow & Notes (Phase 6)

## 📄 License

Internal Tool. All Rights Reserved.
