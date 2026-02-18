import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LiquidationPaidRequest {
  liquidationId: string;
  senderEmail: string;
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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

// Get access token from Google OAuth
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

// Create simple MIME message (no attachment)
function createMimeMessage(
  from: string,
  to: string,
  subject: string,
  htmlContent: string
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
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

// Send email via Gmail API
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

    const { liquidationId, senderEmail }: LiquidationPaidRequest = await req.json();

    // Validate sender email is from hayas.es domain
    if (!senderEmail || !senderEmail.endsWith('@hayas.es')) {
      throw new Error("El remitente debe tener un email @hayas.es");
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch liquidation with specialist info
    const { data: liquidation, error: fetchError } = await supabase
      .from('liquidations')
      .select(`
        *,
        specialist:specialists(id, name, email, user_id)
      `)
      .eq('id', liquidationId)
      .single();

    if (fetchError || !liquidation) {
      console.error("Error fetching liquidation:", fetchError);
      throw new Error("Liquidation not found");
    }

    if (!liquidation.specialist?.email) {
      throw new Error("Specialist email not found");
    }

    const specialistName = liquidation.specialist.name;
    const specialistEmail = liquidation.specialist.email;
    const periodName = `${monthNames[liquidation.period_month - 1]} ${liquidation.period_year}`;
    const formattedAmount = new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(liquidation.subtotal || liquidation.total_amount || 0);

    console.log(`Sending payment confirmation email from ${senderEmail} to ${specialistEmail} for ${liquidation.code}`);

    const subject = `✅ Pago procesado - Liquidación ${liquidation.code} - ${periodName}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #10b981; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✅ Pago Procesado</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hola <strong>${specialistName}</strong>,</p>
          
          <p style="font-size: 16px;">Te confirmamos que el pago de tu liquidación ha sido procesado y lo recibirás en tu cuenta bancaria en los próximos días hábiles.</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <table style="width: 100%;">
              <tr>
                <td style="color: #666; padding: 8px 0;">Código:</td>
                <td style="font-weight: bold; text-align: right;">${liquidation.code}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 8px 0;">Período:</td>
                <td style="font-weight: bold; text-align: right;">${periodName}</td>
              </tr>
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="color: #666; padding: 12px 0; font-size: 18px;">Importe:</td>
                <td style="font-weight: bold; color: #10b981; font-size: 24px; text-align: right;">${formattedAmount}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Si tienes alguna pregunta sobre este pago, no dudes en contactarnos.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px;">
            Saludos cordiales,<br>
            <strong>El equipo de Hayas</strong>
          </p>
        </div>
      </div>
    `;

    // Get access token by impersonating the sender
    const accessToken = await getAccessToken(serviceAccountEmail, serviceAccountPrivateKey, senderEmail);

    // Send via Gmail API
    const emailResult = await sendViaGmailAPI(
      accessToken,
      senderEmail,
      specialistEmail,
      subject,
      htmlContent
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email via Gmail API");
    }

    // Create in-app notification for specialist if they have a user_id
    if (liquidation.specialist.user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: liquidation.specialist.user_id,
          title: 'Pago procesado',
          message: `El pago de tu liquidación ${liquidation.code} (${periodName}) por ${formattedAmount} ha sido procesado`,
          type: 'success',
          category: 'liquidation',
          entity_type: 'liquidation',
          entity_id: liquidationId,
          action_url: `/liquidaciones/${liquidationId}`,
        });
    }

    console.log(`Payment notification sent successfully to ${specialistEmail}, messageId: ${emailResult.messageId}`);

    // Notify admin/finanzas via Slack DM that liquidation is paid
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
      if (LOVABLE_API_KEY && SLACK_API_KEY) {
        const { data: adminUsers } = await supabase
          .from('user_roles')
          .select('user_id, profiles:user_id(email)')
          .in('role', ['admin', 'finanzas']);

        const adminEmails: string[] = (adminUsers ?? [])
          .map((r: any) => r.profiles?.email)
          .filter(Boolean);

        const slackBlocks = [
          {
            type: "section",
            text: { type: "mrkdwn", text: "🧾 *Liquidación actualizada*\n━━━━━━━━━━━━━━━━━" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `📋 *Código:* ${liquidation.code}` },
              { type: "mrkdwn", text: `👤 *Especialista:* ${specialistName}` },
              { type: "mrkdwn", text: `📊 *Estado:* 💰 Marcada como pagada` },
              { type: "mrkdwn", text: `💶 *Importe:* ${formattedAmount}` },
            ],
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Ver liquidación →", emoji: true },
                url: `https://hayas-flow-manager.lovable.app/liquidaciones/${liquidationId}`,
                action_id: "view_liquidation",
              },
            ],
          },
        ];

        const slackFunctionUrl = `${supabaseUrl}/functions/v1/send-slack-notification`;
        for (const email of adminEmails) {
          fetch(slackFunctionUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              message: `💰 Liquidación ${liquidation.code} de ${specialistName} marcada como pagada (${formattedAmount})`,
              blocks: slackBlocks,
            }),
          }).catch(err => console.warn("Slack DM failed for", email, err));
        }
      }
    } catch (slackErr) {
      console.warn("Slack paid notification failed:", slackErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notificación de pago enviada correctamente",
        messageId: emailResult.messageId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending payment notification:", error);
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
