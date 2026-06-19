import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// --- Gmail JWT helpers (same approach as send-liquidation-email) ---
function base64UrlEncode(data: Uint8Array | string): string {
  const base64 = typeof data === 'string' ? btoa(data) : btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(sa: string, pem: string, sub: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa,
    sub,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const pemContent = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  const binary = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;
}

async function getAccessToken(sa: string, key: string, impersonate: string): Promise<string> {
  const jwt = await createJWT(sa, key, impersonate);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

function createMime(from: string, to: string, subject: string, html: string): string {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(html))),
  ].join("\r\n");
}

async function sendGmail(accessToken: string, from: string, to: string, subject: string, html: string) {
  const raw = base64UrlEncode(createMime(from, to, subject, html));
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail API error: ${await res.text()}`);
  return await res.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const saEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const saKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

    // Validate caller
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData } = await supabase.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    const roleSet = new Set((roles || []).map(r => r.role));
    if (!roleSet.has('admin') && !roleSet.has('finanzas')) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { liquidation_id, app_url, sender_email } = await req.json();
    if (!liquidation_id) {
      return new Response(JSON.stringify({ error: "liquidation_id required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Get liquidation
    const { data: liq, error: liqErr } = await supabase
      .from('liquidations')
      .select('id, code, period_month, period_year, total_amount, subtotal, specialist:specialists(name, email)')
      .eq('id', liquidation_id)
      .single();
    if (liqErr || !liq) throw new Error("Liquidación no encontrada");

    // Resolve AM user ids via RPC
    const { data: amIds, error: rpcErr } = await supabase.rpc('get_liquidation_am_user_ids', { _liquidation_id: liquidation_id });
    if (rpcErr) throw rpcErr;
    const uniqueAmIds: string[] = Array.from(new Set((amIds || []).filter(Boolean)));

    if (uniqueAmIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_ams", message: "Esta liquidación no tiene AM asignado en ningún request" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch AM profiles
    const { data: amProfiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', uniqueAmIds);

    // Upsert reviews (pending) — keep existing rows untouched
    const rows = uniqueAmIds.map(am => ({
      liquidation_id,
      am_user_id: am,
      status: 'pending',
      requested_at: new Date().toISOString(),
      requested_by: caller.id,
    }));
    const { error: upsertErr } = await supabase
      .from('liquidation_am_reviews')
      .upsert(rows, { onConflict: 'liquidation_id,am_user_id', ignoreDuplicates: true });
    if (upsertErr) throw upsertErr;

    // Update requested_at + requested_by on existing rows still pending (resend)
    await supabase
      .from('liquidation_am_reviews')
      .update({ requested_at: new Date().toISOString(), requested_by: caller.id })
      .eq('liquidation_id', liquidation_id)
      .eq('status', 'pending');

    // In-app notifications
    const notiRows = uniqueAmIds.map(am => ({
      user_id: am,
      type: 'liquidation_am_review_request',
      category: 'liquidation',
      title: `Validación pendiente: liquidación ${liq.code}`,
      message: `Tienes una liquidación pendiente de validación: ${liq.specialist?.name || ''} - ${monthNames[liq.period_month - 1]} ${liq.period_year}`,
      action_url: `/liquidaciones/${liquidation_id}`,
      entity_id: liquidation_id,
      entity_type: 'liquidation',
    }));
    await supabase.from('notifications').insert(notiRows);

    // Emails (best-effort, via Gmail impersonating sender)
    const periodName = `${monthNames[liq.period_month - 1]} ${liq.period_year}`;
    const totalAmount = liq.total_amount ?? liq.subtotal ?? 0;
    const formattedAmount = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(totalAmount));
    const baseUrl = app_url || Deno.env.get("APP_PRODUCTION_URL") || "";

    let emailsSent = 0;
    if (saEmail && saKey && sender_email && sender_email.endsWith('@hayas.es')) {
      try {
        const accessToken = await getAccessToken(saEmail, saKey, sender_email);

        for (const am of (amProfiles || [])) {
          if (!am.email) continue;
          const detailUrl = `${baseUrl}/liquidaciones/${liquidation_id}`;
          const subject = `Validación pendiente: liquidación ${liq.code} - ${liq.specialist?.name || ''}`;
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">Validación de liquidación</h2>
              <p>Hola${am.full_name ? ` <strong>${am.full_name}</strong>` : ''},</p>
              <p>Como Account Manager, tienes pendiente validar la siguiente liquidación de especialista:</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%;">
                  <tr><td style="color: #666;">Código:</td><td style="font-weight: bold;">${liq.code}</td></tr>
                  <tr><td style="color: #666;">Especialista:</td><td style="font-weight: bold;">${liq.specialist?.name || ''}</td></tr>
                  <tr><td style="color: #666;">Período:</td><td style="font-weight: bold;">${periodName}</td></tr>
                  <tr><td style="color: #666;">Total:</td><td style="font-weight: bold; color: #10b981;">${formattedAmount}</td></tr>
                </table>
              </div>
              <p>Por favor, revisa los conceptos y <strong>valida</strong> o <strong>marca incidencia</strong> con tus comentarios.</p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 30px auto;">
                <tr><td align="center" bgcolor="#3b82f6" style="border-radius: 8px;">
                  <a href="${detailUrl}" target="_blank" style="display: inline-block; background-color: #3b82f6; font-size: 16px; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                    Revisar liquidación
                  </a>
                </td></tr>
              </table>
              <p style="color: #666; font-size: 0.85em; text-align: center;">
                <a href="${detailUrl}" style="color: #3b82f6;">${detailUrl}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #666; font-size: 0.9em;">Saludos,<br><strong>Hayas Flow Manager</strong></p>
            </div>
          `;
          try {
            await sendGmail(accessToken, sender_email, am.email, subject, html);
            emailsSent++;
          } catch (e) {
            console.warn(`Email a ${am.email} falló:`, e);
          }
        }
      } catch (e) {
        console.warn("Gmail send setup failed:", e);
      }
    } else {
      console.log("Gmail credentials or sender_email missing — solo notificaciones in-app");
    }

    return new Response(
      JSON.stringify({
        success: true,
        am_count: uniqueAmIds.length,
        emails_sent: emailsSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-liquidation-am-validation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
