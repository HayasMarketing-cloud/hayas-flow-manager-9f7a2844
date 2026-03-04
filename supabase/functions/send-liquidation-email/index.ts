import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LiquidationEmailRequest {
  specialistName: string;
  specialistEmail: string;
  liquidationCode: string;
  liquidationId: string;
  periodMonth: number;
  periodYear: number;
  totalAmount: number;
  pdfBase64: string;
  appUrl: string;
  senderEmail: string; // Email del usuario que envía (debe ser @hayas.es)
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
    sub: userToImpersonate, // User to impersonate
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600 // 1 hour
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Parse PEM private key
  const pemContent = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  
  // Import key for signing
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // Sign the token
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

// Create MIME message with attachment
function createMimeMessage(
  from: string,
  to: string,
  subject: string,
  htmlContent: string,
  pdfBase64: string,
  pdfFilename: string
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  // Encode subject for UTF-8
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(htmlContent))),
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`,
  ];
  
  return messageParts.join("\r\n");
}

// Send email via Gmail API
async function sendViaGmailAPI(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlContent: string,
  pdfBase64: string,
  pdfFilename: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const mimeMessage = createMimeMessage(from, to, subject, htmlContent, pdfBase64, pdfFilename);
    
    // Gmail API expects web-safe base64
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

// Send Slack DM to a list of emails (fire-and-forget)
async function notifySlackUsers(emails: string[], message: string, blocks: object[]): Promise<void> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

  if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
    console.log("Slack keys not configured — skipping Slack notification");
    return;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const functionUrl = `${supabaseUrl}/functions/v1/send-slack-notification`;

  for (const email of emails) {
    try {
      await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message, blocks }),
      });
    } catch (err) {
      console.warn(`Slack DM to ${email} failed:`, err);
    }
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
      throw new Error("Google Service Account credentials not configured. Please add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY secrets.");
    }

    const {
      specialistName,
      specialistEmail,
      liquidationCode,
      liquidationId,
      periodMonth,
      periodYear,
      totalAmount,
      pdfBase64,
      appUrl,
      senderEmail,
    }: LiquidationEmailRequest = await req.json();

    // Validate sender email is from hayas.es domain
    if (!senderEmail || !senderEmail.endsWith('@hayas.es')) {
      throw new Error("El remitente debe tener un email @hayas.es");
    }

    console.log(`Sending liquidation email from ${senderEmail} to ${specialistEmail} for ${liquidationCode}`);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create signature token with 30 days expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data: signatureData, error: signatureError } = await supabase
      .from('liquidation_signatures')
      .insert({
        liquidation_id: liquidationId,
        expires_at: expiresAt.toISOString(),
      })
      .select('token')
      .single();

    if (signatureError) {
      console.error("Error creating signature token:", signatureError);
      throw new Error("Failed to create signature token");
    }

    const signatureToken = signatureData.token;
    const signatureUrl = `${appUrl}/liquidacion/firmar/${signatureToken}`;

    console.log(`Created signature token: ${signatureToken}`);

    const periodName = `${monthNames[periodMonth - 1]} ${periodYear}`;
    const formattedAmount = new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(totalAmount);

    const subject = `Liquidación ${liquidationCode} - ${periodName} - Pendiente de validación`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Liquidación ${liquidationCode}</h2>
        
        <p>Hola <strong>${specialistName}</strong>,</p>
        
        <p>Te enviamos la liquidación correspondiente al período <strong>${periodName}</strong>.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #666;">Código:</td>
              <td style="font-weight: bold;">${liquidationCode}</td>
            </tr>
            <tr>
              <td style="color: #666;">Período:</td>
              <td style="font-weight: bold;">${periodName}</td>
            </tr>
            <tr>
              <td style="color: #666;">Total:</td>
              <td style="font-weight: bold; color: #10b981; font-size: 1.2em;">${formattedAmount}</td>
            </tr>
          </table>
        </div>
        
        <p>Por favor, revisa el documento adjunto y <strong>confirma o disputa</strong> la liquidación haciendo clic en el botón de abajo.</p>
        
        

        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 30px auto;">
          <tr>
            <td align="center" bgcolor="#10b981" style="border-radius: 8px;">
              <a href="${signatureUrl}" 
                 target="_blank" 
                 style="display: inline-block; background-color: #10b981; font-size: 16px; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; border: 1px solid #10b981;">
                Revisar y Firmar
              </a>
            </td>
          </tr>
        </table>
        
        <p style="color: #666; font-size: 0.9em; text-align: center;">
          Este enlace expira en 30 días.<br>
          Si tienes problemas, copia y pega esta URL en tu navegador:<br>
          <a href="${signatureUrl}" style="color: #3b82f6;">${signatureUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 0.9em;">
          Saludos cordiales,<br>
          <strong>El equipo de Hayas</strong>
        </p>
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
      htmlContent,
      pdfBase64,
      `Liquidacion_${liquidationCode}.pdf`
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email via Gmail API");
    }

    console.log(`Email sent successfully from ${senderEmail} to ${specialistEmail}, messageId: ${emailResult.messageId}`);

    // Notify admin/finanzas users in Slack that a liquidation was sent
    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: adminUsers } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, profiles:user_id(email)')
        .in('role', ['admin', 'finanzas']);

      const adminEmails: string[] = (adminUsers ?? [])
        .map((r: any) => r.profiles?.email)
        .filter(Boolean);

      const slackBlocks = [
        {
          type: "section",
          text: { type: "mrkdwn", text: "🧾 *Liquidación enviada al especialista*\n━━━━━━━━━━━━━━━━━" },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `📋 *Código:* ${liquidationCode}` },
            { type: "mrkdwn", text: `👤 *Especialista:* ${specialistName}` },
            { type: "mrkdwn", text: `📊 *Estado:* 📤 Enviada al especialista` },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Ver liquidación →", emoji: true },
              url: `${appUrl}/liquidaciones/${liquidationId}`,
              action_id: "view_liquidation",
            },
          ],
        },
      ];

      await notifySlackUsers(
        adminEmails,
        `📤 Liquidación ${liquidationCode} enviada a ${specialistName}`,
        slackBlocks
      );
    } catch (slackErr) {
      console.warn("Slack notification after email send failed:", slackErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email enviado correctamente",
        signatureToken: signatureToken,
        messageId: emailResult.messageId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
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
