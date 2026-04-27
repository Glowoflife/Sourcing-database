# Feature Landscape

**Domain:** Chemical Sourcing CRM & Intelligence
**Researched:** April 27, 2026

## Table Stakes

Features users expect in an internal sourcing database.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Manufacturer Directory** | Basic list of companies found in Chemexcil. | Low | Seed data source. |
| **Advanced Search** | Filter by chemical name, CAS number, or location. | Medium | Requires clean data mapping. |
| **Product Profiles** | Deep view of products manufactured by a company. | High | Requires AI extraction. |
| **Contact Management** | Extracted emails, phone numbers, and HQ addresses. | Medium | Often found on "Contact Us" pages. |
| **Scraping Status Dashboard** | Monitor which sites were successfully parsed. | Medium | Pipeline visibility. |

## Differentiators

Features that provide unique value beyond a standard directory.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Capacity Extraction** | Knowing "100 MT/month" is critical for procurement. | High | LLMs must interpret varied units. |
| **Technical Metadata** | Automated CAS number extraction from product lists. | High | Cross-referencing products with CAS. |
| **Manufacturing Locations** | Mapping specific factories, not just HQ offices. | Medium | Vital for logistics planning. |
| **AI Reliability Scores** | Confidence levels for each extracted data point. | Medium | LLM self-assessment or validator checks. |
| **Change Detection** | Alert when a manufacturer adds a new product category. | Medium | Diffing periodic scrapes. |

## Anti-Features

Features to explicitly NOT build (in early phases).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full CRM** | Too complex; competes with general tools. | Focus on "Supply Chain Intelligence" only. |
| **Direct Messaging** | Low initial ROI; hard to maintain. | Provide "Copy Email" or mailto links. |
| **Public Marketplace** | Not for this internal use case. | Keep it private and data-dense. |

## Feature Dependencies

```
Discovery (Chemexcil) → Lead Entry
Lead Entry → Deep Crawl (Manufacturer Site)
Deep Crawl → AI Extraction (Products/Capacity)
AI Extraction → Searchable Technical Database
Technical Database → Procurement Decision Support
```

## MVP Recommendation

Prioritize:
1. **Discovery Engine**: Chemexcil scraper to populate the "Lead" list.
2. **Technical Scraper**: AI extraction for "Products" and "Locations" from manufacturer sites.
3. **Dense Search Dashboard**: Basic grid view with technical filters.

Defer: **Change Detection** and **Automated Reliability Scores**.

## Sources

- [Chemical Industry Sourcing Patterns]
- [Internal Team Requirements (PROJECT.md)]
