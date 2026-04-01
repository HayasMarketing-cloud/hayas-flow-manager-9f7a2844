

## Notificación al Account Manager para solicitar PO Number al aprobar presupuesto

### Contexto
Al aprobar un presupuesto, se añadirá una notificación específica dirigida al AM asignado, pidiéndole que solicite el PO Number al cliente.

### Condición de envío
La notificación **solo se envía** si se cumplen todas estas condiciones:
- El presupuesto tiene un `am_user_id` asignado.
- El campo `client_po_number` está vacío (null), es cadena vacía, o tiene el valor "Pendiente".

Si el PO Number ya está informado con un valor real, no se envía notificación.

### Cambios

**1. `src/lib/notification-utils.ts`**
- Nueva función `notifyAMRequestPONumber(amUserId, budgetCode, budgetId, clientName)` que inserta una notificación tipo `warning`, categoría `budget`, dirigida al AM con `action_url` al detalle del presupuesto.

**2. `src/hooks/useApproveBudget.tsx`**
- Añadir `client:clients(name)` al select del presupuesto.
- En `onSuccess`, evaluar la condición:
  ```
  const poMissing = !budget.client_po_number 
    || budget.client_po_number.trim() === '' 
    || budget.client_po_number.trim().toLowerCase() === 'pendiente';
  ```
- Si `budget.am_user_id` existe y `poMissing` es true, llamar a `notifyAMRequestPONumber`.

