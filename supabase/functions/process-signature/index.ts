import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessSignatureRequest {
  token: string;
  action: 'accept' | 'dispute';
  comments?: string;
  disputeReason?: string;
}

// Helper function to encode base64url
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Create JWT for Google Service Account
async function createServiceAccountJWT(
  serviceAccountEmail: string,
  privateKeyPem: string,
  impersonateEmail: string
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: serviceAccountEmail,
    sub: impersonateEmail,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Parse PEM private key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${unsignedToken}.${signatureB64}`;
}

// Get OAuth access token using service account JWT
async function getAccessToken(
  serviceAccountEmail: string,
  privateKeyPem: string,
  impersonateEmail: string
): Promise<string> {
  const jwt = await createServiceAccountJWT(serviceAccountEmail, privateKeyPem, impersonateEmail);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send email via Gmail API
async function sendEmailViaGmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const emailLines = [
    `From: Hayas Flow <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ];
  
  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gmail API error:', error);
    throw new Error(`Failed to send email: ${error}`);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, action, comments, disputeReason }: ProcessSignatureRequest = await req.json();

    // Get client IP and User Agent for digital evidence
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("x-real-ip") 
      || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    console.log(`Processing signature for token: ${token}, action: ${action}`);

    // Find signature by token
    const { data: signature, error: findError } = await supabase
      .from('liquidation_signatures')
      .select('*, liquidation:liquidations(id, code, status, subtotal)')
      .eq('token', token)
      .single();

    if (findError || !signature) {
      console.error("Signature not found:", findError);
      return new Response(
        JSON.stringify({ error: "Token de firma no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already processed
    if (signature.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          error: "Esta liquidación ya ha sido procesada",
          currentStatus: signature.status 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(signature.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "El enlace de firma ha expirado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const newStatus = action === 'accept' ? 'accepted' : 'disputed';
    const now = new Date().toISOString();

    // Update signature with digital evidence
    const { error: updateSignatureError } = await supabase
      .from('liquidation_signatures')
      .update({
        status: newStatus,
        signed_at: now,
        ip_address: ipAddress,
        user_agent: userAgent,
        specialist_comments: comments || null,
        dispute_reason: action === 'dispute' ? disputeReason : null,
      })
      .eq('id', signature.id);

    if (updateSignatureError) {
      console.error("Error updating signature:", updateSignatureError);
      throw new Error("Error al actualizar la firma");
    }

    // Update liquidation status based on action
    const liquidationStatus = action === 'accept' ? 'paid' : 'disputed';
    const updateData: any = { status: liquidationStatus };
    
    if (action === 'accept') {
      updateData.paid_at = now;
    }

    const { error: updateLiqError } = await supabase
      .from('liquidations')
      .update(updateData)
      .eq('id', signature.liquidation_id);

    if (updateLiqError) {
      console.error("Error updating liquidation:", updateLiqError);
      throw new Error("Error al actualizar la liquidación");
    }

    // Get liquidation details for notification
    const { data: liquidationData } = await supabase
      .from('liquidations')
      .select('code, subtotal, specialist:specialists(name)')
      .eq('id', signature.liquidation_id)
      .single();

    // Get users with admin, account_manager, and finanzas roles for notification
    const { data: usersToNotify } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'account_manager', 'finanzas']);

    const specialistName = (liquidationData?.specialist as any)?.name || 'Especialista';
    const liquidationCode = liquidationData?.code || 'N/A';
    const subtotal = liquidationData?.subtotal || 0;

    if (usersToNotify && usersToNotify.length > 0 && liquidationData) {
      const uniqueUserIds = [...new Set(usersToNotify.map((u: { user_id: string }) => u.user_id))];
      
      // Create in-app notifications
      const notifications = uniqueUserIds.map((userId: string) => ({
        user_id: userId,
        title: action === 'accept' 
          ? 'Liquidación aceptada' 
          : 'Liquidación disputada',
        message: action === 'accept'
          ? `${specialistName} ha aceptado ${liquidationCode}`
          : `${specialistName} ha disputado ${liquidationCode}${disputeReason ? `: ${disputeReason}` : ''}`,
        type: action === 'accept' ? 'success' : 'warning',
        category: 'liquidation',
        entity_id: signature.liquidation_id,
        entity_type: 'liquidation',
        action_url: `/liquidaciones/${signature.liquidation_id}`,
        is_read: false,
      }));

      const { error: notifyError } = await supabase.from('notifications').insert(notifications);
      if (notifyError) {
        console.error("Error creating notifications:", notifyError);
      } else {
        console.log(`In-app notifications sent to ${uniqueUserIds.length} users`);
      }

      // Send email notifications to admin/finanzas users
      const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
      const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
      const gmailUser = Deno.env.get("GMAIL_USER");

      if (serviceAccountEmail && privateKey && gmailUser) {
        try {
          // Get user emails
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('email, full_name')
            .in('id', uniqueUserIds);

          if (userProfiles && userProfiles.length > 0) {
            const accessToken = await getAccessToken(serviceAccountEmail, privateKey, gmailUser);
            
            const formattedAmount = new Intl.NumberFormat('es-ES', {
              style: 'currency',
              currency: 'EUR',
            }).format(subtotal);

            const emailSubject = action === 'accept'
              ? `✅ Liquidación ${liquidationCode} aceptada`
              : `⚠️ Liquidación ${liquidationCode} disputada`;

            const emailHtml = action === 'accept'
              ? `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #10b981;">Liquidación Aceptada</h2>
                  <p><strong>${specialistName}</strong> ha aceptado la liquidación <strong>${liquidationCode}</strong>.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Código:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${liquidationCode}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Especialista:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${specialistName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Importe:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${formattedAmount}</td>
                    </tr>
                    ${comments ? `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Comentarios:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${comments}</td>
                    </tr>
                    ` : ''}
                  </table>
                  <p style="color: #666; font-size: 12px;">Este email ha sido generado automáticamente por Hayas Flow.</p>
                </div>
              `
              : `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #ef4444;">Liquidación Disputada</h2>
                  <p><strong>${specialistName}</strong> ha disputado la liquidación <strong>${liquidationCode}</strong>.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Código:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${liquidationCode}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Especialista:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${specialistName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Importe:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${formattedAmount}</td>
                    </tr>
                    <tr style="background-color: #fef2f2;">
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Motivo de disputa:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: #dc2626;">${disputeReason || 'No especificado'}</td>
                    </tr>
                    ${comments ? `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Comentarios adicionales:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${comments}</td>
                    </tr>
                    ` : ''}
                  </table>
                  <p style="color: #666;">Por favor, revise la disputa y contacte al especialista para resolver el problema.</p>
                  <p style="color: #666; font-size: 12px;">Este email ha sido generado automáticamente por Hayas Flow.</p>
                </div>
              `;

            // Send email to each admin/finanzas user
            for (const user of userProfiles) {
              if (user.email) {
                try {
                  await sendEmailViaGmail(accessToken, gmailUser, user.email, emailSubject, emailHtml);
                  console.log(`Email sent to ${user.email}`);
                } catch (emailError) {
                  console.error(`Failed to send email to ${user.email}:`, emailError);
                }
              }
            }
          }
        } catch (emailError) {
          console.error("Error sending email notifications:", emailError);
          // Don't fail the whole request, just log the error
        }
      } else {
        console.log("Gmail credentials not configured, skipping email notifications");
      }
    }

    console.log(`Signature processed successfully: ${action}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: action === 'accept' 
          ? "Liquidación aceptada correctamente" 
          : "Disputa registrada correctamente",
        digitalEvidence: {
          signedAt: now,
          ipAddress: ipAddress,
          action: newStatus,
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error processing signature:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
