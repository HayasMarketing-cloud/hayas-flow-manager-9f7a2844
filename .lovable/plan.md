

## Fix: Show commissions section on all liquidations, not just editable ones

### Problem
The commissions query (line 356) and UI section (line 1191) are both gated by `isEditable` (which is `draft` or `validated` only). Existing liquidations in other statuses (`sent`, `signed`, `paid`, etc.) never show the commissions section.

### Changes in `src/pages/LiquidacionDetalle.tsx`

**1. Query enable condition (line 356):** Remove the status restriction — enable whenever the specialist has a `user_id`:
```typescript
enabled: !!liquidation?.specialist?.user_id,
```

**2. UI section guard (line 1191):** Change from `isEditable && canAccessFinance()` to `canAccessFinance()` so the section always renders for finance users. The "Añadir" button inside will still check `isEditable` to prevent modifications on non-editable liquidations.

**3. Disable the "Añadir seleccionadas" button** when `!isEditable` — add `disabled={!isEditable || selectedCommissionIds.length === 0}` and show a helper text like "Solo se pueden añadir en liquidaciones en borrador" when not editable.

This way:
- All liquidations show the commissions section (visibility of what's available/pending)
- Only draft/validated liquidations allow actually adding commissions
- Already-created liquidations display the section even if they're in `sent`, `signed`, or `paid` status

### Files changed
- `src/pages/LiquidacionDetalle.tsx` — 3 small edits (query enable, section guard, button disabled state)

