# Checkbox "Notificar al especialista" en el alta de request

## Objetivo
Al crear un request nuevo en estado `pending_specialist` con especialista asignado, poder decidir por acto si se envía o no el email de asignación. Caso de uso: registro retroactivo de trabajo ya realizado.

## Comportamiento
- Aparece un checkbox **"Notificar al especialista"** justo debajo del selector de Especialista, visible solo al **crear** (no en edición ni en vista) y solo cuando hay especialista seleccionado y el estado es `pending_specialist`.
- Se precarga desde el flag `receives_flow_notifications` del maestro de especialistas (marcado por defecto si el especialista lo tiene activo; desmarcado si lo tiene desactivado). Al cambiar de especialista, se recalcula.
- **Marcado** → comportamiento actual: notificación in-app + email de asignación (que es quien genera el token de acción).
- **Desmarcado** → no se invoca `send-request-notification`, por lo que no se crea token ni se envía email. Tampoco se lanza la notificación in-app, y el aviso de feedback en pantalla refleja que no se ha notificado.
- Mismo patrón visual y de precarga que el toggle del modal de generación desde presupuesto (F3).

## Detalle técnico
Fichero único: `src/components/modals/RequestFormModal.tsx`.

1. Añadir al query de especialistas el campo `receives_flow_notifications` (línea ~260, `select('id, name, hourly_rate, user_id, email')`).
2. Añadir estado local `notifySpecialist` (no forma parte del esquema Zod ni de los datos persistidos) con `useEffect` que lo sincroniza al cambiar `specialist_id`: `spec?.receives_flow_notifications !== false`.
3. Renderizar el `Checkbox` + `Label` bajo el `FormField` de `specialist_id` (bloque ~925-978), condicionado a `!initialData && !isViewMode && selectedSpecialistId && status === 'pending_specialist'`, con texto de ayuda: "Desmárcalo para registrar trabajo ya realizado sin enviar email de asignación".
4. Propagar la decisión en el retorno de la mutación (`notify: notifySpecialist`) y, en `onSuccess` (línea ~552), envolver el bloque de notificación con esa condición: si es `false`, se omiten `notifySpecialistAssigned` y `supabase.functions.invoke('send-request-notification', ...)`, y se llama a `notificationFeedback.specialistAssigned(nombre, false, false)`.
5. Resetear `notifySpecialist` a `true` al cerrar/reabrir el modal, junto con el reset del formulario.

Sin cambios de base de datos ni de edge functions.

## Verificación
- Crear request en `pending_specialist` con especialista con notificaciones activas y el check marcado → llega email y se crea token.
- Mismo alta con el check desmarcado → no hay llamada a `send-request-notification` (comprobable en la pestaña de red) y no se crea registro en `request_action_tokens`.
- Especialista con `receives_flow_notifications = false` → el check aparece desmarcado por defecto.
- En edición de un request existente el checkbox no aparece.
