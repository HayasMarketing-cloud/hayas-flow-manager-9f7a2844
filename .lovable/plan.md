

## Problem

The request list has 4 date filter dropdowns that are confusing:
1. **Año** (creation year) + **Mes** (creation month, appears after selecting year)
2. **Año trabajo** (work year) + **Mes trabajo** (work month, appears after selecting work year)

The two year selectors look almost identical, and the user sees "Todos" and "Año trabajo" side by side which is confusing.

## Plan

**Consolidate into 2 combined period selectors** instead of 4 separate year/month dropdowns:

1. **Replace the year+month pair** (lines 633-683) with a single "Período creación" selector showing options like "Enero 2026", "Febrero 2026", etc. (last 18 months + "Todos"), which sets both `year` and `month` at once.

2. **Replace the workYear+workMonth pair** (lines 685-735) with a single "Mes trabajo" selector showing the same month-year format, which sets both `workYear` and `workMonth` at once.

**Changes:**

- **`src/pages/Solicitudes.tsx`**: Remove the 4 separate Select components (year, month, workYear, workMonth) and replace with 2 combined Select components that use a `"YYYY-MM"` value format (or `"YYYY"` for year-only). Parse the value to set both year+month filters simultaneously.

- **`src/hooks/useRequestFilters.tsx`**: No changes needed — we keep the same filter fields internally, just set them together from the combined selector value.

The combined selectors will show options like:
- "Todos los períodos"
- "Febrero 2026"
- "Enero 2026"
- "Diciembre 2025"
- ... (last 18 months)

This eliminates the confusing duplicate year selectors and makes filtering more intuitive with a single click.

