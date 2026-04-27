# Requirements: Indian Chemical Sourcing Database

**Defined:** April 27, 2026
**Core Value:** Automated discovery and deep technical profiling of the Indian chemical supply chain to enable rapid, data-driven procurement.

## v1 Requirements

### Discovery (DISC)
- [ ] **DISC-01**: Automated scraper for Chemexcil membership list to seed the lead database.
- [ ] **DISC-02**: Lead lifecycle tracking (New, Processing, Crawled, Errored).
- [ ] **DISC-03**: Support for importing leads from external CSV/JSON sources or other directories.

### Deep Extraction (EXTR)
- [ ] **EXTR-01**: Pipeline to convert manufacturer website HTML to Markdown for token-efficient AI processing.
- [ ] **EXTR-02**: AI extraction of product lines and specific chemical names.
- [ ] **EXTR-03**: AI extraction of verified contact details (Primary Email, Sales Phone, WhatsApp).
- [ ] **EXTR-04**: AI extraction of manufacturing plant locations/addresses.
- [ ] **EXTR-05**: AI extraction of production capacity with normalization (e.g., standardizing to MT/year).
- [ ] **EXTR-06**: AI extraction of "Industries Served" (e.g., Pharma, Agrochemicals, Polymers).

### Internal CRM & Dashboard (CRM)
- [ ] **CRM-01**: High-density React dashboard with advanced filtering and search (TanStack Table).
- [ ] **CRM-02**: Comprehensive Manufacturer Detail view showing all extracted technical and contact data.
- [ ] **CRM-03**: Sourcing workflow to manually Approve, Reject, or Flag manufacturers for review.
- [ ] **CRM-04**: Internal notes system to track relationship history and team feedback.

### Technical Validation (TECH)
- [ ] **TECH-01**: Extraction, formatting, and indexing of CAS numbers for all products.

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
| DISC-01 | Phase 1 | Pending |
| DISC-02 | Phase 1 | Pending |
| DISC-03 | Phase 1 | Pending |
| EXTR-01 | Phase 2 | Pending |
| EXTR-02 | Phase 2 | Pending |
| EXTR-03 | Phase 2 | Pending |
| EXTR-04 | Phase 2 | Pending |
| EXTR-05 | Phase 2 | Pending |
| EXTR-06 | Phase 2 | Pending |
| CRM-01 | Phase 3 | Pending |
| CRM-02 | Phase 3 | Pending |
| CRM-03 | Phase 3 | Pending |
| CRM-04 | Phase 3 | Pending |
| TECH-01 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: April 27, 2026*
*Last updated: April 27, 2026 after initial definition*
