

## Problem

The "Mes trabajo" filter queries `work_month` and `work_year` columns directly, but these columns are `NULL` for all existing requests. January 2026 has 10+ requests (confirmed in the database), but they all have `work_month: NULL, work_year: NULL`.

## Fix

**File: `src/pages/Solicitudes.tsx`** — Replace the work period filter (lines 107-113) with an `.or()` that falls back to `created_at` when `work_month`/`work_year` are NULL:

```typescript
if (filters.workYear && filters.workMonth) {
  const startDate = new Date(filters.workYear, filters.workMonth - 1, 1).toISOString();
  const endDate = new Date(filters.workYear, filters.workMonth, 0, 23, 59, 59, 999).toISOString();
  query = query.or(
    `and(work_year.eq.${filters.workYear},work_month.eq.${filters.workMonth}),and(work_year.is.null,work_month.is.null,created_at.gte.${startDate},created_at.lte.${endDate})`
  );
} else if (filters.workYear) {
  const startDate = new Date(filters.workYear, 0, 1).toISOString();
  const endDate = new Date(filters.workYear, 11, 31, 23, 59, 59, 999).toISOString();
  query = query.or(
    `work_year.eq.${filters.workYear},and(work_year.is.null,created_at.gte.${startDate},created_at.lte.${endDate})`
  );
}
```

Single file, ~10 lines changed.

