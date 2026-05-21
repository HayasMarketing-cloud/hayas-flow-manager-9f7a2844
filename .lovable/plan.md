# Plan: fallback coste 30€ + arreglo campo Horas

## 1. Fallback coste 30€ (Opción C)

Archivo: `src/hooks/useDefaultRates.tsx`

- Cambiar `FALLBACK_COST_RATE = 70` → `30`.
- Nada más en la jerarquía: cost rate sigue siendo `specialists.hourly_rate` → `30€`.
- Venta no se toca.

## 2. Bug "Horas del especialista" muestra 0 al editar

Encontré dos causas que explican lo que viste en REQ-2026-352:

### Causa A — Decimal con coma se pierde al guardar

En `RequestFormModal.tsx` el `onChange` del input hace `parseFloat(val)`. JavaScript `parseFloat("3,5")` devuelve `3` (corta en la coma). Por eso tu "3,5 horas" se guardó como `3` en BBDD (verificado: la fila tiene `hours = 3`, no `3.5`).

Fix: normalizar la coma a punto antes de parsear en los inputs decimales:

```ts
const normalized = val.replace(',', '.');
field.onChange(normalized === '' ? null : parseFloat(normalized));
```

Aplicar en los 4 inputs decimales del modal: `hours` (línea 1086), `sale_hours` (~877), `cost_rate` (~1110+), `sale_rate`, y `quantity` si también admite decimales.

### Causa B — Valor numeric llega como string desde Supabase

Postgres `numeric` se devuelve como **string** por la librería supabase-js (`"3"` en vez de `3`). En el `form.reset` (línea 465) hacemos `hours: initialData.hours ?? null`, así que el formulario guarda `"3"`. El esquema Zod usa `z.coerce.number()` para el submit, pero `useWatch` y el render del `<Input type="number">` reciben el string. En la mayoría de casos React lo muestra, pero combinado con el ciclo de `field.value !== null && field.value !== undefined ? field.value : ''` puede acabar enseñando el placeholder cuando hay re-render por el `invalidateQueries` que añadimos hace un rato.

Fix defensivo en el `form.reset` del bloque edición: castear a número explícitamente los numéricos que vienen de la BBDD.

```ts
const toNum = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
form.reset({
  ...,
  quantity: toNum(initialData.quantity) ?? 1,
  sale_hours: toNum(initialData.sale_hours),
  unit_price: toNum(initialData.unit_price),
  sale_rate: toNum(initialData.sale_rate),
  hours: toNum(initialData.hours),
  cost_rate: toNum(initialData.cost_rate),
  fixed_cost: toNum(initialData.fixed_cost),
  ...
});
```

Esto asegura que el campo se rellena con `3` (número) y el input lo muestra.

## Verificación tras el cambio

1. Editar REQ-2026-352: el campo "Horas" debe mostrar `3` (no `0`).
2. Crear request nuevo escribiendo `3,5` en horas: debe guardarse `3.5` y al editar mostrarse `3.5`.
3. Crear request con especialista sin `hourly_rate`: el coste estimado debe usar fallback `30€` en vez de `70€`.

## Fuera de alcance

- No se toca la jerarquía de venta.
- No se añade campo de coste en `contract_services` (descartada Opción A).
- No se toca la UI más allá del normalizado de coma en los inputs decimales.
