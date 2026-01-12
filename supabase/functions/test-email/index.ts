import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function for base64url encoding
async function base64UrlEncode(data: Uint8Array): Promise<string> {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Create JWT for service account authentication
async function createServiceAccountJWT(
  serviceAccountEmail: string,
  privateKey: string,
  userToImpersonate: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccountEmail,
    sub: userToImpersonate,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = await base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = await base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Clean the private key
  const cleanedKey = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(cleanedKey), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = await base64UrlEncode(new Uint8Array(signature));
  return `${signatureInput}.${encodedSignature}`;
}

// Get OAuth2 access token using the JWT
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

// Create MIME message for simple email
function createMimeMessage(
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string
): string {
  const boundary = `boundary_${Date.now()}`;
  
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

    if (!serviceAccountEmail || !privateKey) {
      throw new Error('Missing Google Service Account credentials');
    }

    const { fromEmail, toEmail, subject, body } = await req.json();

    // Validate required fields
    if (!fromEmail || !toEmail || !subject || !body) {
      throw new Error('Faltan campos requeridos: fromEmail, toEmail, subject, body');
    }

    // Validate @hayas.es domain for sender
    if (!fromEmail.endsWith('@hayas.es')) {
      throw new Error('El remitente debe ser un email @hayas.es para poder impersonar');
    }

    console.log(`Test email: ${fromEmail} -> ${toEmail}`);
    console.log(`Subject: ${subject}`);

    // Create JWT for service account with domain-wide delegation
    const jwt = await createServiceAccountJWT(serviceAccountEmail, privateKey, fromEmail);
    
    // Get access token
    const accessToken = await getAccessToken(jwt);
    console.log('Access token obtained successfully');

    // Create HTML email body
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email de Prueba - Gmail API</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">${body.replace(/\n/g, '<br>')}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Este es un email de prueba enviado desde Hayas Hub usando Gmail API con Service Account.
        </p>
      </div>
    `;

    // Create and send the email
    const rawMessage = createMimeMessage(fromEmail, toEmail, subject, htmlBody);
    const result = await sendViaGmailAPI(accessToken, rawMessage, fromEmail);

    if (!result.success) {
      throw new Error(`Error al enviar email: ${result.error}`);
    }

    console.log('Email sent successfully, messageId:', result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email enviado correctamente',
        messageId: result.messageId,
        from: fromEmail,
        to: toEmail
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in test-email function:', errorMessage);
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
