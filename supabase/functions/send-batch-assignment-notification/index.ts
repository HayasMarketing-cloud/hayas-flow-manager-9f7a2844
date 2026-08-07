import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGmailAccessToken, sendGmail } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BatchRequestBody {
  requestIds: string[];
  appUrl?: string;
  /** Si se indica, solo se notifica a estos especialistas (override por acto) */
  notifySpecialistIds?: string[];
  /** Reenvío: invalida el token pendiente y emite uno nuevo */
  resend?: boolean;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildHtml(opts: {
  specialistName: string;
  clientName: string;
  budgetTitle: string | null;
  requests: any[];
  totalHours: number;
  totalCost: number;
  actionUrl: string;
  appUrl: string;
}) {
  const rows = opts.requests
    .map(
      (r) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${esc(r.code)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(r.title)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(r.phase || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${r.hours ?? "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtDate(r.deadline)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:680px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);padding:28px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Nueva asignación de trabajos</h1>
  </div>
  <div style="background:#f8fafc;padding:26px;border:1px solid #e2e8f0;border-top:none;">
    <div style="background:#fff;padding:22px;border-radius:8px;">
      <p style="margin-top:0;">Hola ${esc(opts.specialistName)},</p>
      <p>Se te han asignado <strong>${opts.requests.length}</strong> trabajo(s) para
      <strong>${esc(opts.clientName)}</strong>${opts.budgetTitle ? ` · ${esc(opts.budgetTitle)}` : ""}.</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;text-align:left;">Código</th>
            <th style="padding:8px;text-align:left;">Título</th>
            <th style="padding:8px;text-align:left;">Fase</th>
            <th style="padding:8px;text-align:right;">Horas</th>
            <th style="padding:8px;text-align:right;">Deadline</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="font-weight:bold;background:#f8fafc;">
            <td style="padding:8px;" colspan="3">Total: ${opts.requests.length} request(s)</td>
            <td style="padding:8px;text-align:right;">${opts.totalHours}</td>
            <td style="padding:8px;text-align:right;">${fmtCurrency(opts.totalCost)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin:26px 0;text-align:center;">
        <a href="${opts.actionUrl}" style="display:inline-block;padding:14px 32px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Aceptar asignación
        </a>
        <div style="margin-top:12px;">
          <a href="${opts.appUrl}" style="color:#1e3a5f;font-size:13px;">Ver en FLOW</a>
        </div>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:6px;font-size:13px;">
        Si algún detalle no encaja (horas, deadline o alcance), contáctanos antes de aceptar, o acepta y déjanos
        un comentario: los detalles son ajustables después de la aceptación.
      </div>

      <p style="font-size:12px;color:#64748b;margin-top:18px;">
        Este enlace caduca en 7 días. Los trabajos que ya hayan cambiado de estado no se verán afectados al aceptar.
      </p>
    </div>
  </div>
  <div style="text-align:center;padding:16px;color:#64748b;font-size:12px;">
    <p>Mensaje automático del sistema de gestión de Hayas.</p>
  </div>
</body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BatchRequestBody = await req.json();
    const requestIds = body.requestIds || [];

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return new Response(JSON.stringify({ error: "requestIds requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const appUrl =
      body.appUrl || Deno.env.get("APP_PRODUCTION_URL") || "https://hayas-flow-manager.lovable.app";

    const { data: requests, error: reqError } = await supabase
      .from("financial_requests")
      .select(`
        id, code, title, phase, hours, deadline, status, specialist_id, budget_id,
        cost_to_agency,
        client:clients(id, name),
        budget:budgets(id, title),
        specialist:specialists(id, name, email, receives_flow_notifications)
      `)
      .in("id", requestIds);

    if (reqError) throw reqError;

    // Agrupar por especialista
    const groups = new Map<string, any[]>();
    const skippedSpecialists: any[] = [];

    for (const r of requests || []) {
      if (!r.specialist_id || !r.specialist) {
        skippedSpecialists.push({ requestCode: r.code, reason: "sin especialista" });
        continue;
      }
      if (!r.specialist.email) {
        skippedSpecialists.push({
          specialistName: r.specialist.name,
          requestCode: r.code,
          reason: "especialista sin email",
        });
        continue;
      }
      if (r.specialist.receives_flow_notifications === false) {
        skippedSpecialists.push({
          specialistName: r.specialist.name,
          requestCode: r.code,
          reason: "notificaciones desactivadas en el maestro",
        });
        continue;
      }
      if (
        Array.isArray(body.notifySpecialistIds) &&
        !body.notifySpecialistIds.includes(r.specialist_id)
      ) {
        skippedSpecialists.push({
          specialistName: r.specialist.name,
          requestCode: r.code,
          reason: "notificación desactivada para este acto",
        });
        continue;
      }
      const list = groups.get(r.specialist_id) || [];
      list.push(r);
      groups.set(r.specialist_id, list);
    }

    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const serviceAccountPrivateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
    const senderEmail = Deno.env.get("GMAIL_USER");

    let accessToken: string | null = null;
    if (serviceAccountEmail && serviceAccountPrivateKey && senderEmail && groups.size > 0) {
      try {
        accessToken = await getGmailAccessToken(
          serviceAccountEmail,
          serviceAccountPrivateKey,
          senderEmail
        );
      } catch (e) {
        console.error("Gmail auth failed:", e);
      }
    }

    const results: any[] = [];

    for (const [specialistId, items] of groups.entries()) {
      const specialist = items[0].specialist;
      const clientName = items[0].client?.name || "Cliente";
      const budgetTitle = items[0].budget?.title || null;

      // Invalidar tokens de lote pendientes previos que cubran estos requests
      const { data: previousItems } = await supabase
        .from("request_action_token_items")
        .select("token_id")
        .in("request_id", items.map((i: any) => i.id));

      const previousTokenIds = Array.from(
        new Set((previousItems || []).map((p: any) => p.token_id))
      );
      if (previousTokenIds.length > 0) {
        await supabase
          .from("request_action_tokens")
          .update({ status: "expired" })
          .in("id", previousTokenIds)
          .eq("status", "pending");
      }

      // También invalidar tokens individuales pendientes de esos requests
      await supabase
        .from("request_action_tokens")
        .update({ status: "expired" })
        .in("request_id", items.map((i: any) => i.id))
        .eq("status", "pending");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: tokenRow, error: tokenError } = await supabase
        .from("request_action_tokens")
        .insert({
          request_id: null,
          specialist_id: specialistId,
          action_type: "specialist_batch_response",
          expires_at: expiresAt.toISOString(),
        })
        .select("id, token")
        .single();

      if (tokenError || !tokenRow) {
        console.error("Error creando token de lote:", tokenError);
        results.push({ specialistId, specialistName: specialist.name, sent: false, error: tokenError?.message });
        continue;
      }

      const { error: itemsError } = await supabase
        .from("request_action_token_items")
        .insert(
          items.map((i: any) => ({ token_id: tokenRow.id, request_id: i.id }))
        );

      if (itemsError) {
        console.error("Error creando items del token:", itemsError);
        results.push({ specialistId, specialistName: specialist.name, sent: false, error: itemsError.message });
        continue;
      }

      const totalHours = items.reduce((s: number, i: any) => s + (Number(i.hours) || 0), 0);
      const totalCost = items.reduce((s: number, i: any) => s + (Number(i.cost_to_agency) || 0), 0);

      const html = buildHtml({
        specialistName: specialist.name,
        clientName,
        budgetTitle,
        requests: items,
        totalHours,
        totalCost,
        actionUrl: `${appUrl}/solicitud/accion/${tokenRow.token}`,
        appUrl,
      });

      const subject = `${items.length} nuevos trabajos asignados — ${clientName}${
        budgetTitle ? ` · ${budgetTitle}` : ""
      }`;

      let sent = false;
      let messageId: string | null = null;
      if (accessToken && senderEmail) {
        try {
          messageId = await sendGmail(
            accessToken,
            senderEmail,
            specialist.email,
            subject,
            html,
            'batch_assignment'
          );
          sent = !!messageId;
        } catch (e) {
          console.error(`Error enviando email a ${specialist.email}:`, e);
        }
      }

      results.push({
        specialistId,
        specialistName: specialist.name,
        email: specialist.email,
        requestCount: items.length,
        totalHours,
        totalCost,
        token: tokenRow.token,
        sent,
        messageId,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: results.filter((r) => r.sent).length,
        results,
        skipped: skippedSpecialists,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error en send-batch-assignment-notification:", error);
    return new Response(JSON.stringify({ error: error.message || "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
