

## Plan: Asendia Activity Report PDF (March-April 2026)

### What will be generated

A professional PDF report in **English**, with Hayas Marketing branding, addressed to **Fiona Sicre, Head of MarCom & Branding** at Asendia. Written from the perspective of her Account Manager.

### Report structure

1. **Cover / Header**: Hayas Marketing logo + "Asendia — Activity Report: March & April 2026" + "Prepared for Fiona Sicre, Head of MarCom & Branding"

2. **Section 1: ASENDIA HQ — Project Budgets** (13 budgets with their requests)
   - PRE-2025-204: Benchmark Competitors Analysis Report (2 reqs, completed)
   - PRE-2026-014: Rebranding Website Home Part II (1 req, pending approval)
   - PRE-2026-015: Strategic Priorities 2026 Video (1 req, completed/invoiced)
   - PRE-2026-016: Infographic Barometer (1 req, completed/invoiced)
   - PRE-2026-017: Localization epaq Brochure (6 reqs, 4 completed + 2 pending specialist)
   - PRE-2026-018: GEO Strategy & Optimization Plan (6 reqs, 1 in progress + 5 draft)
   - PRE-2026-019: Flex Product Digital Analysis (1 req, completed/invoiced)
   - PRE-2026-021: Smart Design Translation (3 reqs, completed/invoiced)
   - PRE-2026-022: Global HotSpot USA Notice (sent, pending approval, no reqs yet)
   - PRE-2026-023: Translation Newsletter USA (1 req, completed/invoiced)
   - PRE-2026-024: Adjustments Homepage Part II (1 req, completed/invoiced)
   - PRE-2026-025: EPAQ GO LPs Adjustments (6 reqs, all pending specialist)
   - PRE-2026-027: New HubDB Table USA (sent, pending approval)

3. **Section 2: ASENDIA HQ — HubSpot Contract (CON-2025-001)** — 11 completed requests in March

4. **Section 3: ASENDIA SPAIN — Marketing Contract (CON-2025-004)** — 15 requests (March recurring + backlog + April recurring)

5. **Financial Summary**: Total billed, in progress, and pending amounts across all sections

### Technical approach

- Python script using `reportlab` for PDF generation
- Color-coded status badges (green=completed, blue=in progress, orange=pending, grey=draft)
- Tables with columns: Ref, Task Description, Service, Specialist, Amount (€), Status, Date
- Subtotals per budget/contract
- Output: `/mnt/documents/Asendia_Activity_Report_Mar_Apr_2026.pdf`
- Mandatory visual QA via `pdftoppm` inspection

### Files impacted
- No codebase changes — standalone script execution only

