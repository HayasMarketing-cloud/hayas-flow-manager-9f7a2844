

## Añadir contacto del cliente en listado y exportación de presupuestos

### Cambios necesarios

**1. Actualizar queries en `Presupuestos.tsx`**
- En las 3 queries de presupuestos (especialista, AM/PM, admin), cambiar el select de `client:clients(id, name)` a incluir también el contacto:
  ```
  *, client:clients(id, name), client_contact:client_contacts(id, name, email)
  ```
- La tabla `budgets` ya tiene `client_contact_id` que referencia a `client_contacts`.

**2. Actualizar `BudgetTableView.tsx`**
- Añadir columna "Contacto" después de "Cliente" mostrando `budget.client_contact?.name || '-'`.

**3. Actualizar `budgetsExporter.ts`**
- Añadir columna "Contacto" en headers y en cada fila extraer `b.client_contact?.name || '-'`.

**4. Actualizar `BudgetCard.tsx`**
- Mostrar el nombre del contacto si está disponible (opcional, para consistencia con la tabla).

### Notas técnicas
- `budgets.client_contact_id` ya existe en la tabla, solo falta incluirlo en el select de Supabase.
- No se requieren cambios en la base de datos.

