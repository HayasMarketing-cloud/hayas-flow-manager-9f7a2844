// Single source of truth for liquidation totals & grouping shared by
// the on-screen detail view and the downloaded/emailed PDF.
//
// Rule: every item's monetary value is `Number(item.total) ?? 0`.
// No silent fallbacks to `unit_price` or `cost_to_agency` — if `total`
// is missing it's a bug upstream and we surface it as 0 instead of
// fabricating a wrong number.

import {
  groupItemsByClientAndProject,
  type CommissionSourceInfo,
  type GroupedClient,
} from './liquidation-grouping';
import { splitItemsByType } from './liquidation-advances';

export interface LiquidationView {
  groups: GroupedClient[];
  /** Líneas de anticipo y regularización, fuera del árbol cliente/proyecto */
  advances: any[];
  advancesTotal: number;
  grandTotal: number;
  itemCount: number;
}

export const itemAmount = (item: any): number => {
  const n = Number(item?.total);
  return Number.isFinite(n) ? n : 0;
};

export const sumItemTotals = (items: any[]): number =>
  (items || []).reduce((sum, item) => sum + itemAmount(item), 0);

export const buildLiquidationView = (
  items: any[],
  commissionDetails?: Record<string, CommissionSourceInfo>,
): LiquidationView => {
  const safeItems = items || [];
  const { work, advances } = splitItemsByType(safeItems);
  const groups = groupItemsByClientAndProject(work, commissionDetails);
  // Derive grandTotal directly from item.total to guarantee parity with
  // the DB-stored subtotal. (Group subtotals are built from the same
  // rule inside groupItemsByClientAndProject.)
  const grandTotal = sumItemTotals(safeItems);
  return {
    groups,
    advances,
    advancesTotal: sumItemTotals(advances),
    grandTotal,
    itemCount: safeItems.length,
  };
};
