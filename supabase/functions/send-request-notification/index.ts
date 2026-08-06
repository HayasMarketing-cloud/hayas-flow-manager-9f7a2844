import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType = 
  | 'specialist_assigned'    // Request enviado a especialista para aceptar
  | 'specialist_accepted'    // Especialista aceptó el trabajo
  | 'specialist_rejected'    // Especialista rechazó el trabajo
  | 'work_started'           // Trabajo iniciado
  | 'work_completed'         // Trabajo terminado, pendiente revisión
  | 'request_approved'       // Request aprobado y completado
  | 'request_rejected';      // Request rechazado en revisión

interface NotificationRequest {
  requestId: string;
  notificationType: NotificationType;
  recipientEmail?: string;
  recipientName: string;
  senderEmail: string;
  appUrl: string;
  additionalMessage?: string;
  /** 'management' resuelve destinatarios en servidor (AM/PM + admin/finanzas) */
  recipientScope?: 'management' | 'direct';
}

// Base64URL encode (for JWT)
function base64UrlEncode(data: Uint8Array | string): string {
  const base64 = typeof data === 'string' 
    ? btoa(data)
    : btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create JWT for Google Service Account
async function createServiceAccountJWT(
  serviceAccountEmail: string, 
  privateKeyPem: string, 
  userToImpersonate: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  
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
  
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  
  return `${unsignedToken}.${signatureB64}`;
}

async function getAccessToken(serviceAccountEmail: string, privateKey: string, userEmail: string): Promise<string> {
  console.log(`Getting access token for impersonating: ${userEmail}`);
  
  const jwt = await createServiceAccountJWT(serviceAccountEmail, privateKey, userEmail);
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token exchange failed:", errorText);
    throw new Error(`Failed to get access token: ${errorText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

function createMimeMessage(
  from: string,
  to: string,
  subject: string,
  htmlContent: string
): string {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(htmlContent))),
  ];
  
  return messageParts.join("\r\n");
}

async function sendViaGmailAPI(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const mimeMessage = createMimeMessage(from, to, subject, htmlContent);
    const encodedMessage = base64UrlEncode(mimeMessage);
    
    console.log(`Sending email via Gmail API from ${from} to ${to}`);
    
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gmail API error:", errorData);
      return { success: false, error: `Gmail API error: ${errorData}` };
    }
    
    const result = await response.json();
    console.log("Gmail API response:", result);
    
    return { success: true, messageId: result.id };
  } catch (error: any) {
    console.error("Error sending via Gmail API:", error);
    return { success: false, error: error.message };
  }
}

function getNotificationContent(
  type: NotificationType, 
  request: any, 
  recipientName: string, 
  appUrl: string,
  additionalMessage?: string,
  actionToken?: string
): { subject: string; html: string } {
  const requestUrl = `${appUrl}/solicitudes?search=${request.code}`;
  const clientName = request.client?.name || 'Cliente';
  const requestCode = request.code;
  const requestTitle = request.title;
  const deadline = request.deadline 
    ? new Date(request.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  
  const costAmount = request.cost_to_agency
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(request.cost_to_agency)
    : null;

  let subject = '';
  let title = '';
  let message = '';
  let actionText = '';
  let buttonColor = '#3b82f6';
  let actionButtons = '';

  switch (type) {
    case 'specialist_assigned':
      subject = `Nuevo trabajo asignado: ${requestCode}`;
      title = '🎯 Tienes un nuevo trabajo asignado';
      message = `Se te ha asignado un nuevo trabajo. Por favor, revisa los detalles y confirma si puedes aceptarlo.`;
      actionText = 'Ver Detalles en la App';
      buttonColor = '#3b82f6';
      
      // If we have an action token, add accept/reject buttons
      if (actionToken) {
        const actionPageUrl = `${appUrl}/solicitud/accion/${actionToken}`;
        actionButtons = `
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin-bottom: 16px; color: #374151; font-weight: 500;">Responde directamente desde aquí:</p>
            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td style="padding: 0 8px;">
                  <a href="${actionPageUrl}?action=accept" 
                     style="display: inline-block; background-color: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    ✓ Aceptar Trabajo
                  </a>
                </td>
                <td style="padding: 0 8px;">
                  <a href="${actionPageUrl}?action=reject" 
                     style="display: inline-block; background-color: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    ✗ Rechazar
                  </a>
                </td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px; margin-top: 16px; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.5;">
              Si no estás de acuerdo con el importe o no hay un importe previsto, dinos en notas adicionales tus comentarios, tiempo previsto de ejecución o presupuesto adhoc para el mismo.
            </p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-bottom: 20px;">
            Este enlace expira en 7 días
          </p>
        `;
      }
      break;
    case 'specialist_accepted':
      subject = `Trabajo aceptado: ${requestCode}`;
      title = '✅ Especialista ha aceptado el trabajo';
      message = `El especialista ha confirmado que puede realizar el trabajo. Pendiente de tu aprobación para comenzar.`;
      actionText = 'Aprobar Inicio';
      buttonColor = '#3b82f6';
      break;
    case 'specialist_rejected':
      subject = `Trabajo rechazado: ${requestCode}`;
      title = '❌ Especialista no puede realizar el trabajo';
      message = `El especialista ha indicado que no puede aceptar este trabajo. Por favor, asigna a otro especialista.`;
      actionText = 'Reasignar Trabajo';
      buttonColor = '#ef4444';
      break;
    case 'work_started':
      subject = `Trabajo iniciado: ${requestCode}`;
      title = '🚀 El trabajo ha comenzado';
      message = `El especialista ha comenzado a trabajar en esta solicitud.`;
      actionText = 'Ver Progreso';
      buttonColor = '#3b82f6';
      break;
    case 'work_completed':
      subject = `Trabajo completado, pendiente revisión: ${requestCode}`;
      title = '📋 Trabajo completado - Pendiente de tu revisión';
      message = `El especialista ha terminado el trabajo. Por favor, revisa y aprueba o solicita correcciones.`;
      actionText = 'Revisar Trabajo';
      buttonColor = '#f59e0b';
      break;
    case 'request_approved':
      subject = `Trabajo aprobado: ${requestCode}`;
      title = '🎉 Tu trabajo ha sido aprobado';
      message = `El trabajo ha sido revisado y aprobado. ¡Gracias por tu excelente trabajo!`;
      actionText = 'Ver Detalles';
      buttonColor = '#10b981';
      break;
    case 'request_rejected':
      subject = `Trabajo requiere correcciones: ${requestCode}`;
      title = '🔄 Se requieren correcciones';
      message = `El trabajo necesita algunas correcciones antes de ser aprobado.`;
      actionText = 'Ver Comentarios';
      buttonColor = '#ef4444';
      break;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #1a1a2e; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hayas Marketing</h1>
      </div>
      
      <div style="padding: 30px;">
        <h2 style="color: #1a1a2e; margin-top: 0;">${title}</h2>
        
        <p>Hola <strong>${recipientName}</strong>,</p>
        
        <p>${message}</p>
        
        ${additionalMessage ? `<p style="background-color: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;"><strong>Nota:</strong> ${additionalMessage}</p>` : ''}
        
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
            ${deadline ? `
            <tr>
              <td style="color: #666; padding: 8px 0;">Fecha límite:</td>
              <td style="font-weight: bold; text-align: right;">${deadline}</td>
            </tr>
            ` : ''}
            ${costAmount && type === 'specialist_assigned' ? `
            <tr>
              <td style="color: #666; padding: 8px 0;">Importe:</td>
              <td style="font-weight: bold; color: #10b981; text-align: right;">${costAmount}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        ${actionButtons}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${requestUrl}" 
             style="display: inline-block; background-color: ${buttonColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            ${actionText}
          </a>
        </div>
        
        <p style="color: #666; font-size: 0.9em; text-align: center;">
          Si tienes problemas con el botón, copia y pega esta URL en tu navegador:<br>
          <a href="${requestUrl}" style="color: #3b82f6;">${requestUrl}</a>
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
        <p style="color: #666; font-size: 0.9em; margin: 0;">
          Saludos cordiales,<br>
          <strong>El equipo de Hayas</strong>
        </p>
      </div>
    </div>
  `;

  return { subject, html };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const serviceAccountPrivateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!serviceAccountEmail || !serviceAccountPrivateKey) {
      console.error("Google Service Account credentials not configured");
      throw new Error("Google Service Account credentials not configured");
    }

    const {
      requestId,
      notificationType,
      recipientEmail,
      recipientName,
      senderEmail,
      appUrl,
      additionalMessage,
      recipientScope,
    }: NotificationRequest = await req.json();

    // Validate sender email is from hayas.es domain
    if (!senderEmail || !senderEmail.endsWith('@hayas.es')) {
      throw new Error("El remitente debe tener un email @hayas.es");
    }

    console.log(`Sending ${notificationType} notification for request ${requestId} to ${recipientEmail}`);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch request details
    const { data: request, error: requestError } = await supabase
      .from('financial_requests')
      .select(`
        *,
        client:clients(id, name),
        service:services(id, name),
        specialist:specialists(id, name, email)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      throw new Error(`Request not found: ${requestError?.message || 'Unknown error'}`);
    }

    // Create action token for specialist_assigned notification
    let actionToken: string | undefined;
    if (notificationType === 'specialist_assigned') {
      // Invalidate any existing pending tokens for this request
      await supabase
        .from('request_action_tokens')
        .update({ status: 'expired' })
        .eq('request_id', requestId)
        .eq('status', 'pending');

      // Create new token (expires in 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: tokenData, error: tokenError } = await supabase
        .from('request_action_tokens')
        .insert({
          request_id: requestId,
          action_type: 'specialist_response',
          expires_at: expiresAt.toISOString()
        })
        .select('token')
        .single();

      if (tokenError) {
        console.error("Error creating action token:", tokenError);
      } else {
        actionToken = tokenData.token;
        console.log(`Created action token: ${actionToken}`);
      }
    }

    const { subject, html } = getNotificationContent(
      notificationType,
      request,
      recipientName,
      appUrl,
      additionalMessage,
      actionToken
    );

    // Get access token by impersonating the sender
    const accessToken = await getAccessToken(serviceAccountEmail, serviceAccountPrivateKey, senderEmail);

    // Send via Gmail API
    const emailResult = await sendViaGmailAPI(
      accessToken,
      senderEmail,
      recipientEmail,
      subject,
      html
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email via Gmail API");
    }

    console.log(`Notification sent successfully to ${recipientEmail}, messageId: ${emailResult.messageId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notificación enviada correctamente",
        messageId: emailResult.messageId,
        actionToken: actionToken || null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
