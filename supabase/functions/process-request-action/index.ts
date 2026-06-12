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
    const now = new Date().toISOString();
    // Per project rule: accepting from email jumps straight to 'in_progress'
    const newStatus = action === 'accept' ? 'in_progress' : 'draft';
    const tokenStatus = action === 'accept' ? 'accepted' : 'rejected';

    console.log(`Processing action: ${action} for request ${tokenData.request_id}`);
    console.log(`New status: ${newStatus}, Token status: ${tokenStatus}`);

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

    // Verify request update was successful
    const { data: verifiedRequest, error: verifyError } = await supabase
      .from('financial_requests')
      .select('status')
      .eq('id', tokenData.request_id)
      .single();

    if (verifyError || verifiedRequest?.status !== newStatus) {
      console.error("CRITICAL: Request update verification failed:", { 
        expected: newStatus, 
        actual: verifiedRequest?.status,
        error: verifyError 
      });
      return new Response(
        JSON.stringify({ error: "Error al verificar la actualización de la solicitud" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Request ${tokenData.request_id} updated successfully to ${newStatus}`);

    // Mark token as used
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
      // Rollback the request status update
      await supabase
        .from('financial_requests')
        .update({ status: 'pending_specialist', specialist_acceptance: false })
        .eq('id', tokenData.request_id);
      
      return new Response(
        JSON.stringify({ error: "Error al registrar la acción. Por favor, intente nuevamente." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify token update was successful
    const { data: verifiedToken, error: tokenVerifyError } = await supabase
      .from('request_action_tokens')
      .select('status')
      .eq('id', tokenData.id)
      .single();

    if (tokenVerifyError || verifiedToken?.status !== tokenStatus) {
      console.error("CRITICAL: Token update verification failed:", {
        expected: tokenStatus,
        actual: verifiedToken?.status,
        error: tokenVerifyError
      });
      // Rollback
      await supabase
        .from('financial_requests')
        .update({ status: 'pending_specialist', specialist_acceptance: false })
        .eq('id', tokenData.request_id);
      
      return new Response(
        JSON.stringify({ error: "Error al verificar el registro de la acción" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Token ${tokenData.id} updated successfully to ${tokenStatus}`);

    // Log activity for the specialist action
    try {
      // We need to find a user_id to log the activity, but the specialist may not have a user account
      // For now, we'll log without a user_id by using a service account approach
      // Actually, we can use the specialist's linked user_id if available
      const { data: specialist } = await supabase
        .from('specialists')
        .select('user_id')
        .eq('id', request.specialist?.id)
        .single();

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
      // Don't fail the action if logging fails
    }

    // Create in-app notifications — admin/finanzas get all, AM/PM only if assigned to client
    const clientId = request.client_id;
    const specialistName = request.specialist?.name || 'Especialista';
    const requestCode = request.code;

    // 1. Get all admin + finanzas users
    const { data: elevatedUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'finanzas']);

    // 2. Get AM/PM assigned to this client via contracts or budgets
    const [{ data: contracts }, { data: budgets }] = await Promise.all([
      supabase.from('contracts').select('am_user_id, pm_user_id').eq('client_id', clientId),
      supabase.from('budgets').select('am_user_id, pm_user_id').eq('client_id', clientId),
    ]);

    const assignedManagerIds = [...new Set([
      ...(contracts?.flatMap(c => [c.am_user_id, c.pm_user_id]) || []),
      ...(budgets?.flatMap(b => [b.am_user_id, b.pm_user_id]) || []),
    ].filter(Boolean))];

    const uniqueUserIds = [...new Set([
      ...(elevatedUsers?.map(u => u.user_id) || []),
      ...assignedManagerIds,
    ])];

    if (uniqueUserIds.length > 0) {
      try {
        const notifications = uniqueUserIds.map(userId => ({
          user_id: userId,
          title: action === 'accept' ? 'Especialista aceptó solicitud' : 'Especialista rechazó solicitud',
          message: `${specialistName} ${action === 'accept' ? 'aceptó' : 'rechazó'} ${requestCode}${comments ? `: ${comments}` : ''}`,
          type: action === 'accept' ? 'success' : 'warning',
          category: 'request',
          entity_id: tokenData.request_id,
          entity_type: 'financial_request',
          action_url: `/solicitudes/${tokenData.request_id}`,
        }));

        await supabase.from('notifications').insert(notifications);
        console.log(`Created ${notifications.length} in-app notifications`);
      } catch (notifError) {
        console.error("Error creating in-app notifications:", notifError);
      }
    }

    // Get emails of users with admin/account_manager roles to send email notifications
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', uniqueUserIds);

    const recipientEmails = profiles
      ?.map(p => p.email)
      .filter((email): email is string => !!email && email.endsWith('@hayas.es')) || [];

    console.log('Attempting to send notification emails to:', recipientEmails);
    // Send notification emails to management
    if (recipientEmails.length > 0) {
      try {
        const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
        const serviceAccountPrivateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
        const senderEmail = Deno.env.get("GMAIL_USER");
        
        if (serviceAccountEmail && serviceAccountPrivateKey && senderEmail) {
          const clientName = request.client?.name || 'Cliente';
          const requestTitle = request.title;
          
          const subject = action === 'accept' 
            ? `✅ Especialista aceptó: ${requestCode}`
            : `❌ Especialista rechazó: ${requestCode}`;
          
          const statusColor = action === 'accept' ? '#22c55e' : '#ef4444';
          const statusText = action === 'accept' ? 'ACEPTADO' : 'RECHAZADO';
          const appUrl = Deno.env.get("APP_PRODUCTION_URL") || "https://hayas-flow-manager.lovable.app";
          
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Respuesta de Especialista</h1>
              </div>
              
              <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
                <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <span style="display: inline-block; padding: 8px 20px; background: ${statusColor}; color: white; border-radius: 20px; font-weight: bold; font-size: 14px;">
                      ${statusText}
                    </span>
                  </div>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 140px;">Solicitud:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${requestCode}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Especialista:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${specialistName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Cliente:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${clientName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Concepto:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${requestTitle}</td>
                    </tr>
                    ${comments ? `
                    <tr>
                      <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Comentarios:</td>
                      <td style="padding: 10px 0;">${comments}</td>
                    </tr>
                    ` : ''}
                  </table>
                  
                  <div style="background: #f0f9ff; padding: 12px; border-radius: 6px; margin-top: 20px;">
                    <p style="margin: 0; font-size: 12px; color: #0369a1;">
                      <strong>Evidencia digital:</strong> IP ${ipAddress} - ${new Date().toLocaleString('es-ES')}
                    </p>
                  </div>
                  
                  <div style="margin-top: 25px; text-align: center;">
                    <a href="${appUrl}/solicitudes/${tokenData.request_id}" 
                       style="display: inline-block; padding: 12px 30px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                      Ver Solicitud
                    </a>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
                <p>Este es un mensaje automático del sistema de gestión.</p>
              </div>
            </body>
            </html>
          `;
          
          const accessToken = await getAccessToken(serviceAccountEmail, serviceAccountPrivateKey, senderEmail);
          
          // Send email to each recipient
          for (const recipientEmail of recipientEmails) {
            try {
              await sendNotificationEmail(accessToken, senderEmail, recipientEmail, subject, htmlContent);
              console.log(`Email sent successfully to ${recipientEmail}`);
            } catch (emailError) {
              console.error(`Failed to send email to ${recipientEmail}:`, emailError);
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send email notifications:', emailError);
        // Don't fail the whole request if email fails
      }
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
