
## Integración Slack: Botón manual de DM al especialista

### Qué se cambia y por qué

En la implementación anterior se añadió una llamada automática a Slack cada vez que se crea una solicitud. El usuario quiere desactivar eso y sustituirlo por un **botón explícito** que permita enviar un mensaje directo (DM) al especialista asignado desde la propia solicitud, cuando el equipo lo considere oportuno.

---

### Cambios por archivo

#### 1. `src/components/modals/RequestFormModal.tsx`
- Eliminar el import de `sendSlackDM` y `buildNewRequestBlocks`.
- Eliminar la llamada automática a `sendSlackDM` dentro del `onSubmit`.

#### 2. `src/lib/slack-utils.ts`
- Añadir un nuevo builder `buildSlackDMToSpecialistBlocks` para el mensaje manual, con campos: título de solicitud, código, cliente, fecha límite, enlace y un campo de mensaje libre.

#### 3. `src/components/requests/RequestFlowActions.tsx`
- Añadir estado local `slackDialogOpen` y `slackMessage`.
- Añadir un botón "DM Slack" (icono de Slack) visible para gestión (`isManagement()`) cuando haya un especialista con email asignado, independientemente del estado de la solicitud (excepto `completed` y `cancelled`).
- Al pulsar abre un pequeño diálogo de confirmación con campo de mensaje libre (opcional) antes de enviar.
- Al confirmar, llama a `sendSlackDM` con el email del especialista y el bloque enriquecido.
- Si el especialista no tiene email, el botón aparece desactivado con tooltip explicativo.

#### 4. `src/pages/SolicitudDetalle.tsx`
- No es necesario añadir un botón extra aquí porque `RequestFlowActions` ya se renderiza en el header de la página de detalle con el botón integrado.

---

### Comportamiento del botón

| Condición | Comportamiento |
|---|---|
| Hay especialista con email | Botón activo, abre diálogo de confirmación |
| No hay especialista asignado | Botón no se muestra |
| Especialista sin email | Botón desactivado con tooltip |
| Status `completed` o `cancelled` | Botón no se muestra |
| Usuario sin rol de gestión | Botón no se muestra |

---

### Formato del DM en Slack

```text
📩 *Mensaje de Hayas Flow Manager*
━━━━━━━━━━━━━━━━━
📋 REQ-2026-012 — Diseño de campaña
👤 Cliente: Empresa XYZ
📅 Fecha límite: 15 Mar 2026
💬 "Por favor, confirma disponibilidad antes del viernes"
🔗 Ver solicitud →
```

---

### Consideraciones técnicas

- El envío es **fire-and-forget**: si falla, no interrumpe nada y solo se muestra un `toast.error`.
- Se añade feedback visual con `toast.success("DM enviado a [nombre]")` al confirmar.
- El botón usa el icono de Slack de Lucide (`MessageSquare`) con label "DM Slack" en modo compacto para no ocupar demasiado espacio.
- No se necesitan nuevas tablas ni cambios en la base de datos.
