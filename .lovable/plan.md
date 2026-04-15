

# Plan: Expenses & Subscriptions Management Module

## Overview
New page in the Finance section to register, track, and analyze recurring business expenses (SaaS subscriptions, office rent, accounting fees, etc.). Enables monthly/quarterly invoice upload verification, cost analysis, and cash-flow forecasting.

## Data Model

### New table: `expenses`
Stores each subscription/expense as a record with its metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| name | text | e.g. "Google Workspace", "Adobe" |
| category | text | e.g. "software", "office", "services" |
| is_active | boolean | Currently active subscription |
| periodicity | text | "monthly" / "annual" / "quarterly" |
| monthly_cost | numeric | Normalized monthly cost |
| renewal_month | text | Month of annual renewal (nullable) |
| account_email | text | Login/billing email |
| website_url | text | Provider URL |
| notes | text | Purpose, what it's used for |
| created_by | uuid | |
| created_at / updated_at | timestamptz | |

### New table: `expense_records`
Tracks each period's invoice upload status (monthly or quarterly verification).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| expense_id | uuid FK | Links to `expenses` |
| period_year | int | |
| period_month | int | |
| status | text | "pending" / "uploaded" / "verified" |
| invoice_url | text | Uploaded invoice file URL |
| amount | numeric | Actual amount for this period |
| notes | text | |
| uploaded_at | timestamptz | |
| created_at / updated_at | timestamptz | |

RLS: Restricted to `admin` and `finanzas` roles.

## Page Structure: `/gastos`

### 1. Summary Header (KPI cards)
- Total monthly recurring cost
- Total annual cost
- Pending invoices this month
- Pending invoices this quarter

### 2. Subscriptions Registry (main tab)
Table listing all expenses with: Name, Category, Active, Periodicity, Cost, Account, Website link, Actions (edit/deactivate). CRUD modal for adding/editing. Import initial data from the uploaded CSV.

### 3. Monthly/Quarterly Tracker (second tab)
- Period selector (month or quarter)
- Matrix view: rows = active expenses, columns = months in quarter
- Each cell shows upload status (pending/uploaded/verified) with color coding
- Click cell to upload invoice file or mark as verified
- Quarterly summary showing completeness percentage

### 4. Analysis (third tab)
- Category breakdown (pie chart)
- Monthly trend (bar chart)
- Cost comparison month-over-month
- Flagged items: inactive but still being charged, items marked for review

## Technical Steps

1. **Database migration**: Create `expenses` and `expense_records` tables with RLS for admin/finanzas
2. **Storage bucket**: Create `expense-invoices` bucket for uploaded invoice files
3. **Seed data**: Insert initial subscriptions from the uploaded CSV
4. **Page & components**: Build `/gastos` page following existing patterns (Facturas page as reference) with tabs, table view, form modal
5. **Sidebar**: Add "Gastos" entry under Finance section with `requiredRoles: ['admin', 'finanzas']`
6. **Route**: Add protected route in App.tsx
7. **Quarterly tracker**: Matrix component with file upload per cell
8. **Analysis tab**: Charts using existing Recharts patterns from dashboard

## Scope Boundaries
- Invoice files are uploaded and stored in the app (replacing the need to go to Biloop)
- No automatic invoice fetching from provider websites (manual download + upload)
- Categories are predefined with option to add custom ones

