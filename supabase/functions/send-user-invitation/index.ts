import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get OAuth2 access token using the signed JWT
async function getAccessToken(jwt: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OAuth token error:', errorText);
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Create MIME message for email
function createMimeMessage(
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string
): string {
  const mimeMessage = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: text/html; charset=UTF-8`,
    '',
    body
  ].join('\r\n');

  return btoa(unescape(encodeURIComponent(mimeMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Send email via Gmail API
async function sendViaGmailAPI(
  accessToken: string,
  rawMessage: string,
  userEmail: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${userEmail}/messages/send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawMessage })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gmail API error:', errorText);
    return { success: false, error: errorText };
  }

  const result = await response.json();
  return { success: true, messageId: result.id };
}

// Format PEM key
function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\n/g, '\n');
  
  const hasBegin = formattedKey.includes('-----BEGIN');
  const hasEnd = formattedKey.includes('-----END');
  
  if (hasBegin && hasEnd) {
    return formattedKey.trim();
  }
  
  const cleanKey = formattedKey.replace(/\s/g, '');
  const lines: string[] = [];
  for (let i = 0; i < cleanKey.length; i += 64) {
    lines.push(cleanKey.substring(i, i + 64));
  }
  
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

interface InvitationEmailRequest {
  recipientEmail: string;
  recipientName?: string;
  invitedByName: string;
  roles: string[];
  senderEmail: string;
  appUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountEmail = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '').trim();
    const rawPrivateKey = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') ?? '').trim();

    if (!serviceAccountEmail || !rawPrivateKey) {
      throw new Error('Missing Google Service Account credentials');
    }

    const { recipientEmail, recipientName, invitedByName, roles, senderEmail, appUrl }: InvitationEmailRequest = await req.json();

    // Validate required fields
    if (!recipientEmail || !senderEmail || !roles || roles.length === 0) {
      throw new Error('Faltan campos requeridos: recipientEmail, senderEmail, roles');
    }

    // Validate sender is @hayas.es (only internal users can send invitations)
    if (!senderEmail.endsWith('@hayas.es')) {
      throw new Error('El remitente debe ser un email @hayas.es');
    }

    console.log(`Sending invitation: ${senderEmail} -> ${recipientEmail}`);

    // Format the private key
    const privateKey = formatPrivateKey(rawPrivateKey);

    // Import the private key
    const key = await importPKCS8(privateKey, 'RS256');

    // Create JWT for service account with domain-wide delegation
    const jwt = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/gmail.send',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(serviceAccountEmail)
      .setSubject(senderEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);

    // Get access token
    const accessToken = await getAccessToken(jwt);

    // Role labels for display
    const roleLabels: Record<string, string> = {
      admin: 'Administrador',
      moderator: 'Moderador',
      user: 'Usuario',
      finanzas: 'Finanzas',
      project_manager: 'Project Manager',
      especialista: 'Especialista',
      account_manager: 'Account Manager',
      seller: 'Vendedor',
    };

    const rolesDisplay = roles.map(r => roleLabels[r] || r).join(', ');
    const displayName = recipientName || recipientEmail.split('@')[0];
    
    // Use production URL from env, fallback to appUrl from request
    const productionUrl = Deno.env.get('APP_PRODUCTION_URL');
    const loginUrl = productionUrl ? `${productionUrl}/auth` : (appUrl ? `${appUrl}/auth` : 'https://hayas-hub.lovable.app/auth');
    
    console.log('Invitation details:', { 
      recipientEmail, 
      senderEmail, 
      appUrl, 
      productionUrl,
      finalLoginUrl: loginUrl 
    });

    // Create HTML email
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
              ¡Bienvenido a Hayas Hub!
            </h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px;">
              Hola <strong>${displayName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px;">
              <strong>${invitedByName}</strong> te ha invitado a unirte a <strong>Hayas Hub</strong>, 
              nuestra plataforma de gestión interna.
            </p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 0 0 25px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #166534; font-weight: 600;">
                Roles asignados:
              </p>
              <p style="margin: 0; font-size: 16px; color: #15803d; font-weight: 500;">
                ${rolesDisplay}
              </p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 30px;">
              ${recipientEmail.endsWith('@hayas.es') 
                ? `Para acceder, simplemente haz clic en el botón de abajo y usa tu cuenta de Google con el email <strong>${recipientEmail}</strong>.`
                : `Para acceder, haz clic en el botón de abajo y crea tu cuenta con el email <strong>${recipientEmail}</strong> y una contraseña.`
              }
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                Acceder a Hayas Hub
              </a>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 20px 0 0;">
              O copia este enlace: <a href="${loginUrl}" style="color: #059669; word-break: break-all;">${loginUrl}</a>
            </p>
            
            <p style="font-size: 14px; color: #9ca3af; text-align: center; margin: 20px 0 0;">
              Esta invitación expira en 7 días.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              © ${new Date().getFullYear()} Hayas. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `${invitedByName} te ha invitado a Hayas Hub`;
    const rawMessage = createMimeMessage(senderEmail, recipientEmail, subject, htmlBody);
    const result = await sendViaGmailAPI(accessToken, rawMessage, senderEmail);

    if (!result.success) {
      throw new Error(`Error al enviar email: ${result.error}`);
    }

    console.log('Invitation email sent successfully, messageId:', result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitación enviada correctamente',
        messageId: result.messageId,
        to: recipientEmail
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-user-invitation function:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
