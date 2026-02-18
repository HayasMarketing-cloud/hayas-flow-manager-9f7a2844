import { supabase } from "@/integrations/supabase/client";

const APP_URL = "https://hayas-flow-manager.lovable.app";

/**
 * Sends a Slack DM to a user identified by their email.
 * This is a fire-and-forget helper: errors are logged but never thrown,
 * so they never block the primary operation.
 */
export async function sendSlackDM(
  email: string,
  message: string,
  blocks?: object[]
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-slack-notification", {
      body: { email, message, blocks },
    });
    if (error) {
      console.warn("[Slack] DM failed:", error.message);
    }
  } catch (err: any) {
    console.warn("[Slack] DM error:", err?.message ?? err);
  }
}

// ─── Block Kit builders ────────────────────────────────────────────────────────

export function buildNewRequestBlocks(params: {
  code: string;
  title: string;
  clientName: string;
  deadline?: string | null;
  requestId: string;
}): object[] {
  const { code, title, clientName, deadline, requestId } = params;
  const url = `${APP_URL}/solicitudes/${requestId}`;
  const deadlineText = deadline
    ? new Date(deadline).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : "Sin fecha límite";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🆕 *Nueva solicitud creada*\n━━━━━━━━━━━━━━━━━`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `📋 *${code}* — ${title}` },
        { type: "mrkdwn", text: `👤 *Cliente:* ${clientName}` },
        { type: "mrkdwn", text: `📅 *Fecha límite:* ${deadlineText}` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Ver solicitud →", emoji: true },
          url,
          action_id: "view_request",
        },
      ],
    },
  ];
}

export function buildSlackDMToSpecialistBlocks(params: {
  code: string;
  title: string;
  clientName: string;
  deadline?: string | null;
  requestId: string;
  customMessage?: string;
}): object[] {
  const { code, title, clientName, deadline, requestId, customMessage } = params;
  const url = `${APP_URL}/solicitudes/${requestId}`;
  const deadlineText = deadline
    ? new Date(deadline).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : "Sin fecha límite";

  const fields: object[] = [
    { type: "mrkdwn", text: `📋 *${code}* — ${title}` },
    { type: "mrkdwn", text: `👤 *Cliente:* ${clientName}` },
    { type: "mrkdwn", text: `📅 *Fecha límite:* ${deadlineText}` },
  ];

  const blocks: object[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📩 *Mensaje de Hayas Flow Manager*\n━━━━━━━━━━━━━━━━━`,
      },
    },
    { type: "section", fields },
  ];

  if (customMessage) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `💬 _"${customMessage}"_` },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Ver solicitud →", emoji: true },
        url,
        action_id: "view_request",
      },
    ],
  });

  return blocks;
}

export function buildLiquidationBlocks(params: {
  code: string;
  specialistName: string;
  status: string;
  liquidationId: string;
}): object[] {
  const { code, specialistName, status, liquidationId } = params;
  const url = `${APP_URL}/liquidaciones/${liquidationId}`;

  const statusLabels: Record<string, string> = {
    sent: "📤 Enviada al especialista",
    signed: "✅ Firmada por el especialista",
    disputed: "⚠️ Disputada por el especialista",
    paid: "💰 Marcada como pagada",
  };
  const statusText = statusLabels[status] ?? status;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🧾 *Liquidación actualizada*\n━━━━━━━━━━━━━━━━━`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `📋 *Código:* ${code}` },
        { type: "mrkdwn", text: `👤 *Especialista:* ${specialistName}` },
        { type: "mrkdwn", text: `📊 *Estado:* ${statusText}` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Ver liquidación →", emoji: true },
          url,
          action_id: "view_liquidation",
        },
      ],
    },
  ];
}
