import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGmailAccessToken, sendGmail } from "../_shared/gmail.ts";
import { resolveManagementRecipients } from "../_shared/management-recipients.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessActionRequest {
  token: string;
  action: 'accept' | 'reject';
  comments?: string;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

async function sendToManagement(
  supabase: any,
  emails: string[],
  subject: string,
  html: string
) {
  if (emails.length === 0) return 0;
  const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const serviceAccountPrivateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  const senderEmail = Deno.env.get("GMAIL_USER");
  if (!serviceAccountEmail || !serviceAccountPrivateKey || !senderEmail) return 0;

  let sent = 0;
  try {
    const accessToken = await getGmailAccessToken(
      serviceAccountEmail,
      serviceAccountPrivateKey,
      senderEmail
    );
    for (const to of emails) {
      try {
        if (await sendGmail(accessToken, senderEmail, to, subject, html, 'management_batch_response')) sent++;
      } catch (e) {
        console.error(`Failed to send to ${to}:`, e);
      }
    }
  } catch (e) {
    console.error("Gmail auth failed:", e);
  }
  return sent;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, comments }: ProcessActionRequest = await req.json();

    if (!token || !action) {
      return new Response(
        JSON.stringify({ error: "Token y acción requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action !== 'accept' && action !== 'reject') {
      return new Response(
        JSON.stringify({ error: "Acción inválida. Debe ser 'accept' o 'reject'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const appUrl = Deno.env.get("APP_PRODUCTION_URL") || "https://hayas-flow-manager.lovable.app";

    const { data: tokenData, error: tokenError } = await supabase
      .from('request_action_tokens')
      .select(`
        *,
        request:financial_requests(
          id,
          code,
          title,
          client_id,
          budget_id,
          contract_id,
          client:clients(id, name),
          specialist:specialists(id, name, email)
        ),
        specialist:specialists(id, name, email, user_id)
      `)
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Token no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (tokenData.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: "Este enlace ya ha sido utilizado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const now = new Date().toISOString();
    const newStatus = action === 'accept' ? 'in_progress' : 'draft';
    const tokenStatus = action === 'accept' ? 'accepted' : 'rejected';

    // ==========================================================
    // RAMA DE LOTE
    // ==========================================================
    if (tokenData.action_type === 'specialist_batch_response') {
      const { data: items } = await supabase
        .from('request_action_token_items')
        .select(`
          id, request_id,
          request:financial_requests(
            id, code, title, status, hours, specialist_id, client_id, budget_id, contract_id,
            cost_to_agency, client:clients(id, name)
          )
        `)
        .eq('token_id', tokenData.id);

      const accepted: any[] = [];
      const skipped: any[] = [];

      for (const item of items || []) {
        const r: any = item.request;
        if (!r) {
          skipped.push({ code: '—', status: 'eliminado', reason: 'El trabajo ya no existe' });
          await supabase.from('request_action_token_items')
            .update({ status: 'skipped', skip_reason: 'request eliminado', processed_at: now })
            .eq('id', item.id);
          continue;
        }

        // Verificación anti-reasignación con el specialist_id persistido en el token
        if (r.specialist_id !== tokenData.specialist_id) {
          skipped.push({ code: r.code, title: r.title, status: r.status, reason: 'Reasignado a otro especialista' });
          await supabase.from('request_action_token_items')
            .update({ status: 'skipped', skip_reason: 'reasignado', processed_at: now })
            .eq('id', item.id);
          continue;
        }

        if (r.status !== 'pending_specialist') {
          skipped.push({ code: r.code, title: r.title, status: r.status, reason: 'Ya no estaba pendiente de aceptación' });
          await supabase.from('request_action_token_items')
            .update({ status: 'skipped', skip_reason: `estado ${r.status}`, processed_at: now })
            .eq('id', item.id);
          continue;
        }

        const { error: updErr } = await supabase
          .from('financial_requests')
          .update({ status: newStatus, specialist_acceptance: action === 'accept' })
          .eq('id', r.id);

        if (updErr) {
          console.error('Error actualizando request de lote:', updErr);
          skipped.push({ code: r.code, title: r.title, status: r.status, reason: 'Error al actualizar' });
          await supabase.from('request_action_token_items')
            .update({ status: 'skipped', skip_reason: 'error de actualización', processed_at: now })
            .eq('id', item.id);
          continue;
        }

        accepted.push(r);
        await supabase.from('request_action_token_items')
          .update({ status: 'accepted', processed_at: now })
          .eq('id', item.id);

        // Registro de auditoría del lote (sin usuario autenticado)
        await supabase.from('activity_log').insert({
          user_id: null,
          source: 'token',
          entity_type: 'financial_request',
          entity_id: r.id,
          action: action === 'accept' ? 'batch_accepted' : 'batch_rejected',
          changes: { from: r.status, to: newStatus, token_id: tokenRow.id, comments: comments || null },
        });
      }


      // Marcar el token como usado
      await supabase
        .from('request_action_tokens')
        .update({
          status: tokenStatus,
          acted_at: now,
          ip_address: ipAddress,
          user_agent: userAgent,
          comments: comments || null,
        })
        .eq('id', tokenData.id);

      const specialistName = tokenData.specialist?.name || 'Especialista';
      const clientName = accepted[0]?.client?.name
        || (items || []).map((i: any) => i.request?.client?.name).find(Boolean)
        || 'Cliente';
      const clientId = accepted[0]?.client_id
        || (items || []).map((i: any) => i.request?.client_id).find(Boolean)
        || null;
      const budgetId = accepted[0]?.budget_id
        || (items || []).map((i: any) => i.request?.budget_id).find(Boolean)
        || null;

      // Log de actividad
      try {
        if (tokenData.specialist?.user_id) {
          await supabase.from('activity_log').insert(
            accepted.map((r) => ({
              user_id: tokenData.specialist.user_id,
              entity_type: 'financial_request',
              entity_id: r.id,
              action: action === 'accept' ? 'specialist_accepted' : 'specialist_rejected',
              changes: { ip_address: ipAddress, batch: true, comments: comments || null },
            }))
          );
        }
      } catch (e) {
        console.error('Error logging batch activity:', e);
      }

      // Destinatarios de gestión (dinámicos)
      const { userIds, emails } = await resolveManagementRecipients(supabase, {
        clientId,
        budgetId,
      });

      // Notificación in-app: una por usuario para todo el lote
      if (userIds.length > 0) {
        try {
          await supabase.from('notifications').insert(
            userIds.map((uid) => ({
              user_id: uid,
              title: action === 'accept'
                ? `${specialistName} aceptó ${accepted.length} trabajo(s)`
                : `${specialistName} rechazó ${accepted.length} trabajo(s)`,
              message: `${clientName} — ${accepted.length} aceptado(s), ${skipped.length} omitido(s)${comments ? `: ${comments}` : ''}`,
              type: action === 'accept' ? 'success' : 'warning',
              category: 'request',
              entity_id: budgetId,
              entity_type: 'budget',
              action_url: budgetId ? `/presupuestos/${budgetId}` : '/solicitudes',
            }))
          );
        } catch (e) {
          console.error('Error creating batch in-app notifications:', e);
        }
      }

      // UN solo email agregado a gestión
      const acceptedRows = accepted.map((r) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${esc(r.code)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(r.title)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${r.hours ?? '—'}</td>
        </tr>`).join('');

      const skippedRows = skipped.map((s) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${esc(s.code)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(s.status)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(s.reason)}</td>
        </tr>`).join('');

      const totalHours = accepted.reduce((s, r) => s + (Number(r.hours) || 0), 0);
      const totalCost = accepted.reduce((s, r) => s + (Number(r.cost_to_agency) || 0), 0);
      const verb = action === 'accept' ? 'aceptó' : 'rechazó';

      const subject = `${specialistName} ${verb} ${accepted.length} trabajo(s) — ${clientName}`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:680px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);padding:26px;border-radius:10px 10px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:21px;">Respuesta de especialista (lote)</h1>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;">
          <div style="background:#fff;padding:22px;border-radius:8px;">
            <p style="margin-top:0;"><strong>${esc(specialistName)}</strong> ${verb} un lote de trabajos de <strong>${esc(clientName)}</strong>.</p>
            <h3 style="font-size:15px;margin-bottom:6px;">Procesados (${accepted.length})</h3>
            ${accepted.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead><tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;">Código</th><th style="padding:8px;text-align:left;">Título</th><th style="padding:8px;text-align:right;">Horas</th></tr></thead>
              <tbody>${acceptedRows}</tbody>
              <tfoot><tr style="font-weight:bold;"><td style="padding:8px;" colspan="2">Total (${accepted.length}) · ${fmtCurrency(totalCost)}</td><td style="padding:8px;text-align:right;">${totalHours}</td></tr></tfoot>
            </table>` : '<p style="color:#64748b;">Ninguno.</p>'}
            ${skipped.length ? `<h3 style="font-size:15px;margin:18px 0 6px;">Omitidos (${skipped.length})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead><tr style="background:#fef3c7;"><th style="padding:8px;text-align:left;">Código</th><th style="padding:8px;text-align:left;">Estado</th><th style="padding:8px;text-align:left;">Motivo</th></tr></thead>
              <tbody>${skippedRows}</tbody>
            </table>` : ''}
            ${comments ? `<div style="margin-top:16px;background:#f0f9ff;padding:12px;border-radius:6px;"><strong>Comentarios:</strong> ${esc(comments)}</div>` : ''}
            <div style="background:#f0f9ff;padding:12px;border-radius:6px;margin-top:16px;font-size:12px;color:#0369a1;">
              <strong>Evidencia digital:</strong> IP ${esc(ipAddress)} — ${new Date().toLocaleString('es-ES')}
            </div>
            <div style="margin-top:22px;text-align:center;">
              <a href="${appUrl}${budgetId ? `/presupuestos/${budgetId}` : '/solicitudes'}" style="display:inline-block;padding:12px 28px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">Ver en FLOW</a>
            </div>
          </div>
        </div>
      </body></html>`;

      const emailsSent = await sendToManagement(supabase, emails, subject, html);
      console.log(`Batch action processed: ${accepted.length} accepted, ${skipped.length} skipped, ${emailsSent} management emails (1 per recipient)`);

      return new Response(
        JSON.stringify({
          success: true,
          is_batch: true,
          message: accepted.length > 0
            ? `Has ${action === 'accept' ? 'aceptado' : 'rechazado'} ${accepted.length} trabajo(s)`
            : 'No quedaba ningún trabajo pendiente en este lote',
          action,
          accepted: accepted.map((r) => ({ code: r.code, title: r.title, hours: r.hours })),
          skipped,
          digitalEvidence: {
            actionedAt: now,
            ipAddress,
            requestCode: `${accepted.length} request(s)`,
            status: tokenStatus,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ==========================================================
    // RAMA INDIVIDUAL (comportamiento existente)
    // ==========================================================
    const request = tokenData.request;

    console.log(`Processing action: ${action} for request ${tokenData.request_id}`);

    const { error: updateError } = await supabase
      .from('financial_requests')
      .update({ status: newStatus, specialist_acceptance: action === 'accept' })
      .eq('id', tokenData.request_id);

    if (updateError) {
      console.error("Error updating request:", updateError);
      return new Response(
        JSON.stringify({ error: "Error al actualizar la solicitud" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: verifiedRequest } = await supabase
      .from('financial_requests')
      .select('status')
      .eq('id', tokenData.request_id)
      .single();

    if (verifiedRequest?.status !== newStatus) {
      return new Response(
        JSON.stringify({ error: "Error al verificar la actualización de la solicitud" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { error: tokenUpdateError } = await supabase
      .from('request_action_tokens')
      .update({
        status: tokenStatus,
        acted_at: now,
        ip_address: ipAddress,
        user_agent: userAgent,
        comments: comments || null
      })
      .eq('id', tokenData.id);

    if (tokenUpdateError) {
      console.error("CRITICAL: Token update failed:", tokenUpdateError);
      await supabase
        .from('financial_requests')
        .update({ status: 'pending_specialist', specialist_acceptance: false })
        .eq('id', tokenData.request_id);

      return new Response(
        JSON.stringify({ error: "Error al registrar la acción. Por favor, intente nuevamente." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log activity
    try {
      const { data: specialist } = await supabase
        .from('specialists')
        .select('user_id')
        .eq('id', request.specialist?.id)
        .maybeSingle();

      if (specialist?.user_id) {
        await supabase.from('activity_log').insert({
          user_id: specialist.user_id,
          entity_type: 'financial_request',
          entity_id: tokenData.request_id,
          action: action === 'accept' ? 'specialist_accepted' : 'specialist_rejected',
          changes: { ip_address: ipAddress, comments: comments || null }
        });
      }
    } catch (logError) {
      console.error("Error logging activity:", logError);
    }

    const specialistName = request.specialist?.name || 'Especialista';
    const requestCode = request.code;

    const { userIds, emails: recipientEmails } = await resolveManagementRecipients(supabase, {
      clientId: request.client_id,
      budgetId: request.budget_id,
      contractId: request.contract_id,
    });

    if (userIds.length > 0) {
      try {
        await supabase.from('notifications').insert(
          userIds.map((userId) => ({
            user_id: userId,
            title: action === 'accept' ? 'Especialista aceptó solicitud' : 'Especialista rechazó solicitud',
            message: `${specialistName} ${action === 'accept' ? 'aceptó' : 'rechazó'} ${requestCode}${comments ? `: ${comments}` : ''}`,
            type: action === 'accept' ? 'success' : 'warning',
            category: 'request',
            entity_id: tokenData.request_id,
            entity_type: 'financial_request',
            action_url: `/solicitudes/${tokenData.request_id}`,
          }))
        );
      } catch (notifError) {
        console.error("Error creating in-app notifications:", notifError);
      }
    }

    console.log('Attempting to send notification emails to:', recipientEmails);

    const clientName = request.client?.name || 'Cliente';
    const statusColor = action === 'accept' ? '#22c55e' : '#ef4444';
    const statusText = action === 'accept' ? 'ACEPTADO' : 'RECHAZADO';
    const subject = action === 'accept'
      ? `✅ Especialista aceptó: ${requestCode}`
      : `❌ Especialista rechazó: ${requestCode}`;

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">Respuesta de Especialista</h1>
        </div>
        <div style="background:#f8fafc;padding:30px;border:1px solid #e2e8f0;border-top:none;">
          <div style="background:white;padding:25px;border-radius:8px;">
            <div style="text-align:center;margin-bottom:20px;">
              <span style="display:inline-block;padding:8px 20px;background:${statusColor};color:white;border-radius:20px;font-weight:bold;font-size:14px;">${statusText}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;width:140px;">Solicitud:</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:500;">${esc(requestCode)}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Especialista:</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">${esc(specialistName)}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Cliente:</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">${esc(clientName)}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Concepto:</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">${esc(request.title)}</td></tr>
              ${comments ? `<tr><td style="padding:10px 0;color:#64748b;vertical-align:top;">Comentarios:</td><td style="padding:10px 0;">${esc(comments)}</td></tr>` : ''}
            </table>
            <div style="background:#f0f9ff;padding:12px;border-radius:6px;margin-top:20px;">
              <p style="margin:0;font-size:12px;color:#0369a1;"><strong>Evidencia digital:</strong> IP ${esc(ipAddress)} - ${new Date().toLocaleString('es-ES')}</p>
            </div>
            <div style="margin-top:25px;text-align:center;">
              <a href="${appUrl}/solicitudes/${tokenData.request_id}" style="display:inline-block;padding:12px 30px;background:#1e3a5f;color:white;text-decoration:none;border-radius:6px;font-weight:500;">Ver Solicitud</a>
            </div>
          </div>
        </div>
      </body></html>`;

    await sendToManagement(supabase, recipientEmails, subject, htmlContent);

    return new Response(
      JSON.stringify({
        success: true,
        is_batch: false,
        message: action === 'accept'
          ? 'Has aceptado el trabajo correctamente'
          : 'Has rechazado el trabajo correctamente',
        action,
        digitalEvidence: {
          actionedAt: now,
          ipAddress,
          requestCode: request.code,
          status: tokenStatus
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error processing action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
