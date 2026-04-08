

## Plan: Contacto solicitante condicional en presupuestos

### Problema actual
El campo "Contacto Solicitante" es obligatorio para todos los presupuestos, incluso para clientes que no tienen contactos registrados. Esto bloquea la creación de presupuestos para esos clientes.

### Solución
Hacer el campo obligatorio **solo cuando el cliente tiene 2+ contactos activos**, y opcional en caso contrario. Si el cliente tiene 0 contactos, ocultar el selector.

### Cambios en `BudgetFormModal.tsx`

1. **Derivar `hasMultipleContacts`** a partir del array `contacts` ya cargado:
   - `contacts?.length >= 2` → campo obligatorio (asterisco rojo, validación al guardar)
   - `contacts?.length === 1` → campo visible pero opcional (sin asterisco, sin validación)
   - `contacts?.length === 0` o sin cliente → ocultar el campo

2. **Eliminar validación fija** (líneas 198-201): reemplazar por validación condicional que solo bloquea si `hasMultipleContacts && !formData.client_contact_id`.

3. **Auto-seleccionar** cuando hay exactamente 1 contacto: pre-llenar `client_contact_id` automáticamente.

4. **UI condicional** en el label y helper text:
   - Con múltiples contactos: mostrar asterisco `*` y texto "obligatorio"
   - Con un contacto: sin asterisco, texto "opcional"
   - Sin contactos: no renderizar el bloque

### Archivos a modificar
- `src/components/budgets/BudgetFormModal.tsx` — único archivo afectado

### Sin cambios de base de datos
La columna `client_contact_id` en `budgets` ya es nullable. No se requiere migración.

