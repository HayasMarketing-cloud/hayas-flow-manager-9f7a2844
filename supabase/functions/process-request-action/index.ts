import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessActionRequest {
  token: string;
  action: 'accept' | 'reject';
  comments?: string;
}

// Helper functions for JWT and Gmail API (same as send-request-notification)
function base64UrlEncode(data: Uint8Array | string): string {
  const base64 = typeof data === 'string' 
    ? btoa(data)
    : btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createServiceAccountJWT(
  serviceAccountEmail: string, 
  privateKeyPem: string, 
  userToImpersonate: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    sub: userToImpersonate,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  const pemContent = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getAccessToken(serviceAccountEmail: string, privateKey: string, userEmail: string): Promise<string> {
  const jwt = await createServiceAccountJWT(serviceAccountEmail, privateKey, userEmail);
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

async function sendNotificationEmail(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(htmlContent))),
  ];
  
  const encodedMessage = base64UrlEncode(messageParts.join("\r\n"));
  
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });
  
  return response.ok;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP and user agent
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip') 
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Fetch and validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('request_action_tokens')
      .select(`
        *,
        request:financial_requests(
          id,
          code,
          title,
          client:clients(id, name),
          specialist:specialists(id, name, email)
        )
      `)
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Token no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already used
    if (tokenData.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: "Este enlace ya ha sido utilizado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const request = tokenData.request;
    const newStatus = action === 'accept' ? 'pending_approval' : 'draft';
    const tokenStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Update request status
    const updateData: any = { 
      status: newStatus,
      specialist_acceptance: action === 'accept'
    };

    const { error: updateError } = await supabase
      .from('financial_requests')
      .update(updateData)
      .eq('id', tokenData.request_id);

    if (updateError) {
      console.error("Error updating request:", updateError);
      return new Response(
        JSON.stringify({ error: "Error al actualizar la solicitud" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark token as used
    const { error: tokenUpdateError } = await supabase
      .from('request_action_tokens')
      .update({
        status: tokenStatus,
        acted_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        comments: comments || null
      })
      .eq('id', tokenData.id);

    if (tokenUpdateError) {
      console.error("Error updating token:", tokenUpdateError);
    }

    // Send notification to management
    try {
      const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
      const serviceAccountPrivateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
      const senderEmail = 'info@hayas.es';
      const managementEmail = 'info@hayas.es';
      
      if (serviceAccountEmail && serviceAccountPrivateKey) {
        const specialistName = request.specialist?.name || 'Especialista';
        const clientName = request.client?.name || 'Cliente';
        const requestCode = request.code;
        const requestTitle = request.title;
        
        const subject = action === 'accept' 
          ? `✅ Trabajo aceptado: ${requestCode}`
          : `❌ Trabajo rechazado: ${requestCode}`;
        
        const actionIcon = action === 'accept' ? '✅' : '❌';
        const actionText = action === 'accept' ? 'ha aceptado' : 'ha rechazado';
        const statusBg = action === 'accept' ? '#10b981' : '#ef4444';
        
        const appUrl = Deno.env.get("APP_PRODUCTION_URL") || "https://hayas-flow-manager.lovable.app";
        const requestUrl = `${appUrl}/solicitudes?search=${requestCode}`;
        
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #1a1a2e; padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hayas Marketing</h1>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #1a1a2e; margin-top: 0;">${actionIcon} Especialista ${actionText} el trabajo</h2>
              
              <p><strong>${specialistName}</strong> ${actionText} el trabajo desde el email.</p>
              
              ${comments ? `<p style="background-color: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;"><strong>Comentario:</strong> ${comments}</p>` : ''}
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #666; padding: 8px 0;">Código:</td>
                    <td style="font-weight: bold; text-align: right;">${requestCode}</td>
                  </tr>
                  <tr>
                    <td style="color: #666; padding: 8px 0;">Concepto:</td>
                    <td style="font-weight: bold; text-align: right;">${requestTitle}</td>
                  </tr>
                  <tr>
                    <td style="color: #666; padding: 8px 0;">Cliente:</td>
                    <td style="font-weight: bold; text-align: right;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="color: #666; padding: 8px 0;">Nuevo estado:</td>
                    <td style="font-weight: bold; text-align: right; color: ${statusBg};">
                      ${action === 'accept' ? 'Pendiente Aprobación' : 'Borrador (Reasignar)'}
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #f0f9ff; padding: 12px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 12px; color: #0369a1;">
                  <strong>Evidencia digital:</strong><br>
                  IP: ${ipAddress}<br>
                  Fecha: ${new Date().toLocaleString('es-ES')}
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${requestUrl}" 
                   style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Ver Solicitud
                </a>
              </div>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
              <p style="color: #666; font-size: 0.9em; margin: 0;">
                Saludos cordiales,<br>
                <strong>Sistema de Notificaciones Hayas</strong>
              </p>
            </div>
          </div>
        `;
        
        const accessToken = await getAccessToken(serviceAccountEmail, serviceAccountPrivateKey, senderEmail);
        await sendNotificationEmail(accessToken, senderEmail, managementEmail, subject, htmlContent);
        console.log("Notification sent to management");
      }
    } catch (notifyError) {
      console.error("Error sending notification:", notifyError);
      // Don't fail the action if notification fails
    }

    const actionedAt = new Date().toISOString();
    
    return new Response(
      JSON.stringify({
        success: true,
        message: action === 'accept' 
          ? 'Has aceptado el trabajo correctamente' 
          : 'Has rechazado el trabajo correctamente',
        action,
        digitalEvidence: {
          actionedAt,
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
