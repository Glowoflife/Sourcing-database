# Requirements: Indian Chemical Sourcing Database

**Defined:** April 27, 2026
**Core Value:** Automated discovery and deep technical profiling of the Indian chemical supply chain to enable rapid, data-driven procurement.

## v1 Requirements

### Discovery (DISC)
- [x] **DISC-01**: Automated scraper for Chemexcil membership list to seed the lead database. *(Validated Phase 2)*
- [x] **DISC-02**: Lead lifecycle tracking (New, Processing, Crawled, Errored). *(Validated Phase 1)*
- [x] **DISC-03**: Support for importing leads from external CSV/JSON sources or other directories. *(Validated Phase 1)*

### Deep Extraction (EXTR)
- [x] **EXTR-01**: Pipeline to convert manufacturer website HTML to Markdown for token-efficient AI processing. *(Validated Phase 3)*
- [x] **EXTR-02**: AI extraction of product lines and specific chemical names. *(Validated Phase 4)*
- [x] **EXTR-03**: AI extraction of verified contact details (Primary Email, Sales Phone, WhatsApp). *(Validated Phase 4)*
- [x] **EXTR-04**: AI extraction of manufacturing plant locations/addresses. *(Validated Phase 4)*
- [x] **EXTR-05**: AI extraction of production capacity with normalization (e.g., standardizing to MT/year). *(Validated Phase 4)*
- [x] **EXTR-06**: AI extraction of "Industries Served" (e.g., Pharma, Agrochemicals, Polymers). *(Validated Phase 4)*

### Internal CRM & Dashboard (CRM)
- [x] **CRM-01**: High-density React dashboard with advanced filtering and search (TanStack Table). *(Validated Phase 5)*
- [x] **CRM-02**: Comprehensive Manufacturer Detail view showing all extracted technical and contact data. *(Validated Phase 5)*
- [x] **CRM-03**: Sourcing workflow to manually Approve, Reject, or Flag manufacturers for review. *(Validated Phase 6)*
- [x] **CRM-04**: Internal notes system to track relationship history and team feedback. *(Validated Phase 6)*

### Technical Validation (TECH)
- [x] **TECH-01**: Extraction, formatting, and indexing of CAS numbers for all products. *(Validated Phase 4)*

## v2 Requirements

### Enhancement & Monitoring
- **CRM-05**: Change detection to highlight updates to manufacturer profiles between scrapes.
- **TECH-02**: Automated verification of extracted chemicals against the PubChem API.
- **TECH-03**: GSTIN validation (checksum and status check) for Indian manufacturers.
- **TECH-04**: Reliability scoring for AI-extracted data points.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Public Search Portal | Database is strictly for internal procurement intelligence. |
| Transaction Processing | Payments and ordering remain outside the system; focus is on sourcing. |
| Real-time Price Tracking | Chemical pricing is too volatile and opaque for automated scraping in v1. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 2 | Complete |
| DISC-02 | Phase 1 | Complete |
| DISC-03 | Phase 1 | Complete |
| EXTR-01 | Phase 3 | Complete |
| EXTR-02 | Phase 4 | Complete |
| EXTR-03 | Phase 4 | Complete |
| EXTR-04 | Phase 4 | Complete |
| EXTR-05 | Phase 4 | Complete |
| EXTR-06 | Phase 4 | Complete |
| CRM-01 | Phase 5 | Complete |
| CRM-02 | Phase 5 | Complete |
| CRM-03 | Phase 6 | Complete |
| CRM-04 | Phase 6 | Complete |
| TECH-01 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: April 27, 2026*
*Last updated: April 27, 2026 after Phase 6 completion*
