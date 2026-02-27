
Objetivo: que las comisiones sí aparezcan en la pantalla de la captura (“Editar Liquidación” modal), no solo en la vista de detalle.

Implementación (archivo: `src/components/liquidations/LiquidationFormModal.tsx`):

1) Añadir soporte de `user_id` del especialista en el modal
- Ampliar la query de especialistas (`select`) para incluir `user_id` además de `id, name`.
- Derivar `selectedSpecialistUserId` a partir de `selectedSpecialistId` (el selector ya existe en el formulario).

2) Cargar comisiones disponibles en el modal de edición
- Crear `useQuery` para `sales_commissions` con:
  - filtro por `seller_user_id = selectedSpecialistUserId`
  - filtro de estado `in ('pending','approved')`
  - orden por `created_at desc`
- Habilitar la query solo cuando haya `selectedSpecialistUserId` y el modal esté en contexto editable.

3) Estado local para selección de comisiones
- Añadir estado `selectedCommissionIds` (array de ids).
- Resetear selección al cambiar especialista/cerrar modal para evitar arrastres de selección.

4) Añadir mutación para incorporar comisiones a la liquidación (modo edit)
- Crear `addCommissionsMutation` que:
  - inserta cada comisión seleccionada en `liquidation_items` como ítem manual (`financial_request_id = null`, `quantity = 1`, `unit_price/total = commission_amount`, descripción “Comisión AM/PM/Venta - origen”).
  - actualiza esas comisiones a `status='paid'` y `paid_at=now`.
  - recalcula subtotal desde `liquidation_items` y actualiza `liquidations.subtotal` y `liquidations.total_amount`.
- Invalidar queries relevantes: `liquidation-items`, `liquidations`, y la query de comisiones del especialista.

5) Pintar sección UI en la posición correcta del modal
- Insertar bloque “Comisiones disponibles” entre:
  - “Solicitudes disponibles del especialista”
  - “Añadir conceptos manuales”
- Mostrar:
  - estado vacío (“No hay comisiones pendientes/aprobadas…”),
  - lista con checkbox + tipo + origen + porcentaje/base + importe,
  - botón “Añadir N comisión(es)” en `mode === 'edit'` e `isEditable`.
- En estados no editables, mantener mensaje informativo sin permitir alta.

6) Validación funcional (E2E)
- Abrir liquidación enero de Iolanda en “Editar”.
- Verificar que aparecen las 2 comisiones aprobadas.
- Seleccionar ambas, añadir, confirmar que:
  - aparecen en “Solicitudes incluidas” como conceptos de comisión,
  - se actualiza el total,
  - al reabrir ya no figuran como disponibles (quedan en `paid`).

Detalles técnicos (concretos):
- La causa actual está en que la implementación previa quedó en `src/pages/LiquidacionDetalle.tsx` (vista detalle), mientras la captura corresponde a `LiquidationFormModal`.
- En base de datos ya existe consistencia para ese caso:
  - especialista Iolanda con `user_id` informado,
  - liquidación enero 2026 en borrador,
  - 2 comisiones en estado `approved` para ese mismo `seller_user_id`.
