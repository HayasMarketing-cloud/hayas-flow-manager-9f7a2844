
## Objetivo
1) Permitir seleccionar también facturas “Cobradas” (paid) desde el listado (el círculo/checkbox) para poder revertir estado y re-conciliar.
2) Hacer que, cuando una factura se asocia a un Presupuesto, esa asociación se vea correctamente en la columna “Asociación” del listado.

---

## Diagnóstico (lo que he encontrado en el código)
### A) “No puedo seleccionar las cobradas”
En `src/components/invoices/InvoiceTableView.tsx` ya está cambiado para que **todas** las facturas sean seleccionables:
- `isSelectableStatus = () => true`

Pero en `src/pages/Facturas.tsx` todavía existe una lógica paralela que define cuáles son “seleccionables” para el “Seleccionar todas” y para la selección masiva:
- `selectableInvoices = (invoices || []).filter(inv => inv.status !== 'paid')`

Esto provoca un comportamiento incoherente (especialmente con “seleccionar todas” y el estado del selector), y es muy probable que sea la causa de que percibas que las cobradas “no se pueden seleccionar”.

### B) “He asociado esta factura a un presupuesto pero no lo pone en el listado”
En el listado (`InvoiceTableView`) la columna “Asociación” actualmente solo muestra:
- Presupuesto “directo” si existe `invoice.budget_id` y `invoice.budget`
- Contrato directo si existe `invoice.contract_id` y `invoice.contract`

Pero en `InvoiceFormModal` se ve claramente que, para presupuestos, el sistema está usando el modelo N:M mediante `invoice_budget_allocations` y además **está dejando `budget_id: null` a propósito** (legacy):
- Inserta/actualiza la factura con `budget_id: null`
- Guarda la asociación real en `invoice_budget_allocations`

Resultado: aunque la factura esté asociada vía asignaciones, el listado no la muestra porque no está leyendo `invoice_budget_allocations`.

---

## Implementación propuesta (cambios concretos)

### 1) Arreglar selección de facturas cobradas en el listado
**Archivo:** `src/pages/Facturas.tsx`

- Cambiar `selectableInvoices` para que incluya todas las facturas (no excluir `paid`) o, mejor aún, crear una única función de “seleccionabilidad” compartida con la tabla.
- Ajustar `handleSelectAll()` para que seleccione realmente las mismas filas que la tabla considera seleccionables.

**Resultado esperado:**
- El checkbox/círculo de una factura “Cobrada” se puede activar.
- “Seleccionar todas” también incluye cobradas (si lo deseamos).

### 2) Añadir acción masiva para “Revertir a Pendiente”
Ahora mismo, la barra inferior masiva solo tiene “Marcar como Cobradas” (registrar cobro).
Para tu caso (volver atrás para conciliar bien 3 facturas), la experiencia más directa es:

**En la barra masiva (cuando hay selección):**
- Botón nuevo: **“Revertir a Pendiente”**
  - Solo habilitado si hay facturas seleccionadas con estado `paid`.
  - Al confirmar:
    - Actualiza `invoices.status` a `sent`
    - Pone `paid_at = null`
    - Elimina vínculos en `invoice_payments` (igual que ya hacemos en el cambio individual)

**Archivos:**
- `src/pages/Facturas.tsx` (añadir botón + mutation masiva + confirmación)
- Reutilizar la misma lógica que ya existe en `src/components/invoices/InvoiceStatusActions.tsx` para asegurar consistencia.

**Resultado esperado:**
- Seleccionas 3 facturas cobradas
- “Revertir a Pendiente”
- Luego seleccionas esas 3 y haces “Registrar cobro” para asociarlas a un único pago correctamente

### 3) Mostrar asociación a Presupuestos en el listado usando `invoice_budget_allocations`
**Archivos:**
- `src/pages/Facturas.tsx` (query de facturas)
- `src/components/invoices/InvoiceTableView.tsx` (renderAssociation)

**Cambios:**
1) En la query de `Facturas.tsx`, incluir el join anidado a `invoice_budget_allocations` con el presupuesto:
   - `invoice_budget_allocations( budget_id, allocated_amount, budget:budgets(id, code, title) )`
2) En `InvoiceTableView`, actualizar `renderAssociation(invoice)`:
   - Si `invoice.contract_id`: mantener lógica actual (Contrato + periodo).
   - Si hay `invoice.invoice_budget_allocations?.length > 0`:
     - Mostrar el primer presupuesto (código) y un “+N” si hay más
     - Reutilizar `InvoiceOriginCell` (ya existe y soporta múltiples items) para que tenga tooltip y navegación.
   - Si no hay asignaciones pero hay `invoice.budget_id` (legacy): fallback a lo actual.

**Resultado esperado:**
- Al asociar una factura a un presupuesto (vía asignaciones), el listado deja de mostrar “Sin asociar”.
- Si hay múltiples presupuestos, se ve “PRE-XXX +2” con tooltip.

### 4) Refresco de datos tras guardar asignaciones
Para que el listado se actualice inmediatamente después de asociar una factura a un presupuesto:

**Archivo:** `src/hooks/useInvoiceBudgetAllocations.tsx`
- En `useSaveInvoiceAllocations().onSuccess`, además de invalidar queries de allocations/budgets, invalidar también:
  - `['invoices']`

**Resultado esperado:**
- Guardas la asociación en el modal de factura y al cerrar, el listado refleja la asociación sin recargar la página.

---

## Consideraciones / Casos borde
- Selección mixta (paid + no paid): la barra masiva debería:
  - “Registrar cobro” deshabilitado si hay alguna ya cobrada (para evitar errores)
  - “Revertir a Pendiente” habilitado solo para las cobradas seleccionadas (y opcionalmente actuar solo sobre esas).
- Revertir debe mantener trazabilidad coherente:
  - Siempre eliminar `invoice_payments` al revertir (ya está definido así).
- Si una factura está “Cobrada” pero no tiene `invoice_payments`, la reversión debe seguir funcionando (borrado sin error crítico).

---

## Validación (pruebas que haremos)
1) En listado de Facturas:
   - Seleccionar una factura “Cobrada” (checkbox/círculo) y confirmar que entra en selección.
   - Probar “Seleccionar todas” y que incluye cobradas (si se define así).
2) Seleccionar 3 cobradas:
   - Ejecutar “Revertir a Pendiente”
   - Confirmar que cambian a “Enviada” y se eliminan sus vínculos de pago
3) Seleccionar esas 3 y registrar un cobro único:
   - Confirmar que se crea un `payment` y 3 registros en `invoice_payments`
4) Asociar una factura a Presupuesto desde edición:
   - Confirmar que, al volver al listado, “Asociación” muestra el presupuesto correctamente.

---

## Entregables (lista de archivos a tocar)
- `src/pages/Facturas.tsx`
  - Unificar selección (incluyendo cobradas)
  - Añadir acción masiva “Revertir a Pendiente”
  - Ajustar query para incluir `invoice_budget_allocations -> budgets`
- `src/components/invoices/InvoiceTableView.tsx`
  - Mostrar asociación desde `invoice_budget_allocations` (y fallback legacy)
  - Reutilizar `InvoiceOriginCell` para múltiples presupuestos
- `src/hooks/useInvoiceBudgetAllocations.tsx`
  - Invalidate de `['invoices']` tras guardar asignaciones
