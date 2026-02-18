
# Integración de Slack: Notificaciones automáticas por DM

## Objetivo

Conectar Flow Manager con Slack para que los usuarios reciban mensajes directos (DMs) cuando ocurran eventos clave: nueva solicitud creada y eventos de liquidaciones. Se usará el conector nativo de Slack (bot), sin necesidad de configurar una app propia.

---

## Paso 0 — Conectar el bot de Slack al proyecto (acción del usuario)

Antes de implementar nada, el usuario debe conectar su workspace de Slack mediante el conector nativo. Esto instala el bot "Lovable App" en el workspace y hace disponible la variable `SLACK_API_KEY` como secreto en las funciones del backend.

---

## Arquitectura de la solución

```text
Flow Manager (frontend)
        |
        | llama a
        v
Edge Function: send-slack-notification
        |
        | Busca usuario por email → users.lookupByEmail
        | Abre DM → conversations.open
        | Envía mensaje → chat.postMessage
        v
Conector Gateway de Slack
        |
        v
Bot de Slack → DM al usuario en Slack
```

El bot busca al responsable por su email @hayas.es (que coincide con el de Slack) y le envía un mensaje directo. No necesita que el usuario invite al bot a ningún canal.

---

## Eventos a notificar

### 1. Nueva solicitud creada
- **Cuándo**: Al guardar una solicitud nueva desde `RequestFormModal`
- **Receptor**: El AM asignado al cliente o presupuesto de la solicitud
- **Mensaje**: Nombre de la solicitud, cliente, código, enlace directo en la app

### 2. Eventos de liquidaciones
- **Cuándo**: Cambios de estado clave en liquidaciones (enviada al especialista, firmada, disputada, pagada)
- **Receptor**: Usuarios con rol `admin` o `finanzas` (según las reglas existentes del sistema)
- **Mensaje**: Código de liquidación, especialista, nuevo estado, enlace directo

---

## Archivos a crear/modificar

### Crear: `supabase/functions/send-slack-notification/index.ts`
Edge function nueva que:
- Recibe `{ email, message, blocks? }` como body
- Llama a `users.lookupByEmail` en Slack para obtener el user ID
- Abre una conversación DM con `conversations.open`
- Envía el mensaje con `chat.postMessage` usando el conector gateway
- Usa `SLACK_API_KEY` y `LOVABLE_API_KEY` como secrets (ya disponibles tras conectar)

### Crear: `src/lib/slack-utils.ts`
Helper de frontend para llamar a la edge function `send-slack-notification` de forma sencilla desde cualquier componente.

### Modificar: `src/components/modals/RequestFormModal.tsx`
Al completar correctamente el `onSubmit` de creación de una solicitud nueva, llamar a `slack-utils` para notificar al AM del cliente/presupuesto seleccionado.

### Modificar: `supabase/functions/send-liquidation-email/index.ts`
Añadir una llamada interna al envío de Slack cuando la liquidación cambia de estado (enviada, firmada, disputada, pagada), reutilizando la misma lógica de envío.

---

## Formato del mensaje en Slack

Los mensajes usarán **Block Kit** de Slack para tener mejor aspecto:

```
🆕 *Nueva solicitud creada*
━━━━━━━━━━━━━━━━━
📋 SOL-2026-045 — Diseño de campaña Q2
👤 Cliente: Empresa XYZ
📅 Fecha límite: 15 Mar 2026
🔗 Ver solicitud → https://hayas-flow-manager.lovable.app/solicitudes/xxx
```

---

## Consideraciones técnicas

- El conector gateway se usa para todas las llamadas a la API de Slack (no se llama directamente a `api.slack.com`). La URL base es `https://connector-gateway.lovable.dev/slack/api`.
- Si el usuario no tiene cuenta en Slack o su email no coincide, la edge function devuelve un error controlado (log, sin bloquear la operación principal).
- La notificación de Slack es **secundaria**: si falla, la operación principal (crear solicitud, cambiar estado de liquidación) NO se interrumpe.
- El conector de Slack tiene acceso a todos los canales públicos y puede enviar DMs a cualquier usuario del workspace.

---

## Flujo de implementación

1. El usuario conecta su workspace de Slack mediante el conector nativo (botón "Conectar Slack")
2. Se crea la edge function `send-slack-notification`
3. Se crea el helper `slack-utils.ts`
4. Se integra en `RequestFormModal` para nuevas solicitudes
5. Se integra en los eventos de liquidaciones
