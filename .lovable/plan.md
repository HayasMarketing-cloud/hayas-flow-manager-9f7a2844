# Sincronizar PDF y pantalla de liquidación

## Problema

Pantalla y PDF calculan totales por su cuenta. Cualquier cambio en una lógica (ej. fallback de `unit_price` vs `item.total`) genera divergencias como la de LIQ-2026-042 (pantalla 1.660,02 € · PDF 1.380,02 €).

## Principio

**Una sola fuente de verdad** para: lista de items, agrupación jerárquica, subtotales por grupo y total final. Pantalla y PDF la consumen sin recalcular nada.

## Cambios

### 1. Módulo compartido `src/lib/liquidation-totals.ts` (nuevo)

Función pura `buildLiquidationView(items, commissionDetails)` que devuelve:

```ts
{
  groups: GroupedClient[],        // ya existente, reutilizado de liquidation-grouping
  grandTotal: number,             // = suma de groups[].subtotal
  itemCount: number,
}
```

Regla única de importe por item: **`Number(item.total) ?? 0`** (sin fallbacks a `unit_price` ni `cost_to_agency`). El item en BD ya tiene `total` correcto — si falta, es un bug aguas arriba, no se enmascara.

### 2. `liquidation-grouping.ts`

- Cambiar `Number(item.total) || 0` por `Number(item.total) ?? 0` para no perder negativos legítimos (ajustes manuales).
- Eliminar `calculateItemsTotal` duplicado: que pase a vivir solo en `liquidation-totals.ts`.

### 3. `LiquidacionDetalle.tsx`

- Sustituir el `reduce` ad-hoc (`calculated_total`) por `buildLiquidationView(...)`.
- La pantalla muestra `view.grandTotal` y los subtotales por cliente/proyecto vienen directos de `view.groups`.

### 4. `utils/pdf/liquidationPDFGenerator.ts`

- Borrar la función local `calculateItemsTotal` (la que causó el bug).
- Borrar el cálculo local de `costToAgency` en `buildHierarchicalTableData`; usar `view.groups[].items[].total` directamente.
- `TOTAL A PAGAR` = `view.grandTotal`.
- Mismo cambio en `generateLiquidationPDFBase64` y en el modo equipo (suma de `view.grandTotal` de líder + miembros).

### 5. Test de regresión

`src/lib/__tests__/liquidation-totals.test.ts` con fixtures (items horarios, fijos, comisiones, ajustes negativos) verificando que `grandTotal === sum(items.total)` y que coincide con `subtotal` de BD.

## Diagrama

```text
                 liquidation_items (BD)
                          │
                          ▼
              buildLiquidationView()        ← única fuente
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   LiquidacionDetalle.tsx     liquidationPDFGenerator.ts
   (pantalla)                  (PDF descarga + email)
```

## Fuera de alcance

- No se tocan cálculos de IVA / `total_amount`: la pantalla ya muestra subtotal sin IVA y el PDF también; ese ya está alineado.
- No se modifica `get-liquidation-items` edge function (vista del especialista) — se podrá adaptar en una iteración posterior si se quiere reutilizar el mismo módulo en el portal del especialista.

## Resultado

A partir de este cambio, **es imposible** que el total del PDF difiera del de pantalla: ambos leen el mismo número de la misma función.
