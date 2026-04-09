/**
 * Template: Asendia Activity Report
 * 
 * Generates a professional PDF report for Asendia contacts showing
 * budget/contract activity for a given period.
 * 
 * Usage: This template is designed to be run as a standalone Python script
 * (see /tmp or generated on-demand) querying Supabase for Asendia data.
 * 
 * TEMPLATE STRUCTURE:
 * ─────────────────────────────────────────────────────
 * HAYAS MARKETING (brand header)
 * ───────────────────────────── (accent line)
 * 
 * Asendia HQ — Activity Report
 * [Period: e.g. March & April 2026]
 * 
 * Prepared for [Contact Name]
 * [Contact Title], Asendia HQ
 * [Date]
 * ───────────────────────────── (separator)
 * 
 * Executive Summary
 * Dear [First Name],
 * [Brief intro paragraph]
 * 
 * For each Budget/Contract:
 * ─────────────────────────────
 * N. [CODE] — [Title]
 * Budget: €X,XXX.XX | PO: [PO Number] | Status: [Status]
 * 
 * | Ref | Task Description | Service | Specialist | Status |
 * |-----|-----------------|---------|------------|--------|
 * | ... | ...             | ...     | ...        | ...    |
 * 
 * Notes: [contextual notes about the budget/requests]
 * 
 * ───────────────────────────── (separator)
 * Action Required
 * • [Pending items requiring client action]
 * 
 * ───────────────────────────── (separator)
 * [Closing paragraph]
 * Best regards,
 * Hayas Marketing Team
 * ─────────────────────────────────────────────────────
 * 
 * DESIGN TOKENS:
 * - Brand:   #1a365d (dark navy)
 * - Accent:  #2b6cb0 (blue)
 * - Green:   #38a169 (completed/invoiced)
 * - Orange:  #dd6b20 (pending)
 * - Blue:    #3182ce (in progress/approved)
 * - Grey:    #a0aec0 (draft)
 * - Light BG:#f7fafc (table rows)
 * - Border:  #e2e8f0 (separators)
 * 
 * PAGE: A4, margins 1.5cm all sides
 * FONT: Helvetica (reportlab default)
 * TABLE: 5 columns (Ref, Task, Service, Specialist, Status) — NO Amount column
 * STATUS COLORS: Green=Completed/Invoiced, Blue=In Progress/Approved, Orange=Pending, Grey=Draft
 * 
 * DATA SOURCE: Supabase tables
 * - budgets (code, title, total_amount, client_po_number, status, client_contact_id)
 * - financial_requests (code, title, status, service_id, specialist_id, client_contact_id)
 * - contracts (code, title)
 * - client_contacts (name, id) — filter by contact
 * - services (name)
 * - specialists (name)
 * 
 * FILTER LOGIC:
 * 1. Identify contact by name in client_contacts for Asendia clients
 * 2. Find budgets where client_contact_id = contact.id
 * 3. Find requests where budget_id in those budgets OR client_contact_id = contact.id
 * 4. Filter by work_month/work_year or created_at for the desired period
 * 5. Optionally include contract requests where contact is involved
 */

export const ASENDIA_REPORT_TEMPLATE_INFO = {
  name: 'Asendia Activity Report',
  description: 'Professional activity report for Asendia contacts, grouped by budget/contract with PO numbers',
  format: 'PDF (reportlab, Python)',
  lastUsed: '2026-04-09',
  columns: ['Ref', 'Task Description', 'Service', 'Specialist', 'Status'],
  designColors: {
    brand: '#1a365d',
    accent: '#2b6cb0',
    completed: '#38a169',
    pending: '#dd6b20',
    inProgress: '#3182ce',
    draft: '#a0aec0',
  },
} as const;
