import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectCompletedRequest {
  projectId: string;
  senderEmail: string;
  appUrl: string;
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
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

function createMimeMessage(to: string, from: string, subject: string, htmlBody: string): string {
  const boundary = "boundary_" + Date.now();
  
  const mimeMessage = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(htmlBody))),
    `--${boundary}--`
  ].join('\r\n');
  
  return btoa(mimeMessage).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendViaGmailAPI(accessToken: string, to: string, from: string, subject: string, htmlBody: string) {
  const rawMessage = createMimeMessage(to, from, subject, htmlBody);
  
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawMessage }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error: ${error}`);
  }
  
  return await response.json();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function generateEmailContent(
  projectName: string,
  clientName: string,
  projectId: string,
  appUrl: string,
  requests: any[]
): { subject: string; body: string } {
  const subject = `🎉 Proyecto completado - ${projectName} - Pendiente facturación`;

  // Group requests by specialist
  const requestsBySpecialist = requests.reduce((acc, req) => {
    const specialistName = req.specialist?.name || 'Sin asignar';
    if (!acc[specialistName]) {
      acc[specialistName] = [];
    }
    acc[specialistName].push(req);
    return acc;
  }, {} as Record<string, any[]>);

  const totalSaleAmount = requests.reduce((sum, r) => sum + (r.sale_amount || 0), 0);
  const totalCostAmount = requests.reduce((sum, r) => sum + (r.cost_to_agency || 0), 0);

  let specialistSummaryHtml = '';
  for (const [specialist, reqs] of Object.entries(requestsBySpecialist) as [string, any[]][]) {
    const specialistTotal = reqs.reduce((sum, r) => sum + (r.cost_to_agency || 0), 0);
    specialistSummaryHtml += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${specialist}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${reqs.length}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(specialistTotal)}</td>
      </tr>
    `;
  }

  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Proyecto Completado</h1>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
            <h2 style="margin: 0 0 8px 0; color: #065f46; font-size: 18px;">${projectName}</h2>
            <p style="margin: 0; color: #047857;">Cliente: <strong>${clientName}</strong></p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">📊 Resumen Financiero</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Total solicitudes:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #111827;">${requests.length}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Facturación al cliente:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #10b981;">${formatCurrency(totalSaleAmount)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Coste especialistas:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #ef4444;">${formatCurrency(totalCostAmount)}</td>
              </tr>
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0; color: #374151; font-weight: 600;">Margen bruto:</td>
                <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #059669; font-size: 18px;">${formatCurrency(totalSaleAmount - totalCostAmount)}</td>
              </tr>
            </table>
          </div>
          
          ${Object.keys(requestsBySpecialist).length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">👥 Desglose por Especialista</h3>
            <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px;">
              <thead>
                <tr style="background-color: #e5e7eb;">
                  <th style="padding: 10px; text-align: left; font-size: 13px; color: #374151;">Especialista</th>
                  <th style="padding: 10px; text-align: center; font-size: 13px; color: #374151;">Solicitudes</th>
                  <th style="padding: 10px; text-align: right; font-size: 13px; color: #374151;">Coste</th>
                </tr>
              </thead>
              <tbody>
                ${specialistSummaryHtml}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <div style="background-color: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⚠️ Acciones pendientes:</strong><br>
              • Facturar al cliente las solicitudes completadas<br>
              • Incluir costes de especialistas en liquidaciones mensuales
            </p>
          </div>
          
          <div style="text-align: center;">
            <a href="${appUrl}/operaciones/proyectos/${projectId}" 
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px;">
              Ver Proyecto
            </a>
            <a href="${appUrl}/facturas" 
               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px;">
              Ir a Facturación
            </a>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">Este es un mensaje automático del sistema Hayas Flow</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

const handler = async (req: Request): Promise<Response> => {
  console.log('=== send-project-completed-notification function called ===');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!serviceAccountEmail || !privateKey) {
      throw new Error('Google Service Account credentials not configured');
    }

    const requestData: ProjectCompletedRequest = await req.json();
    console.log('Request data:', { projectId: requestData.projectId, sender: requestData.senderEmail });

    // Validate sender domain
    if (!requestData.senderEmail.endsWith('@hayas.es')) {
      throw new Error('El remitente debe tener un email @hayas.es');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project details with client
    const { data: project, error: projectError } = await supabase
      .from('operational_projects')
      .select(`
        id,
        name,
        client:clients(id, name)
      `)
      .eq('id', requestData.projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }

    console.log('Project found:', project.name);

    // Get associated operational_requests and their financial_requests
    const { data: operationalRequests, error: opReqError } = await supabase
      .from('operational_requests')
      .select('financial_request_id')
      .eq('operational_project_id', requestData.projectId)
      .not('financial_request_id', 'is', null);

    if (opReqError) {
      console.error('Error fetching operational requests:', opReqError);
    }

    const financialRequestIds = (operationalRequests || [])
      .map(r => r.financial_request_id)
      .filter(Boolean);

    let requests: any[] = [];
    if (financialRequestIds.length > 0) {
      const { data: financialRequests, error: frError } = await supabase
        .from('financial_requests')
        .select(`
          id,
          code,
          title,
          sale_amount,
          cost_to_agency,
          specialist:specialists(id, name)
        `)
        .in('id', financialRequestIds);

      if (!frError && financialRequests) {
        requests = financialRequests;
      }
    }

    console.log(`Found ${requests.length} associated financial requests`);

    // Get finanzas users to send email
    const { data: finanzasUsers, error: usersError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'finanzas');

    if (usersError) {
      console.error('Error fetching finanzas users:', usersError);
    }

    const finanzasUserIds = [...new Set((finanzasUsers || []).map(u => u.user_id))];
    
    if (finanzasUserIds.length === 0) {
      console.log('No finanzas users found, skipping email');
      return new Response(
        JSON.stringify({ success: true, message: 'No finanzas users to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get email addresses
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('email')
      .in('id', finanzasUserIds);

    if (profilesError || !profiles || profiles.length === 0) {
      console.log('No profiles found for finanzas users');
      return new Response(
        JSON.stringify({ success: true, message: 'No finanzas emails found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientName = (project.client as any)?.name || 'Cliente desconocido';
    const { subject, body } = generateEmailContent(
      project.name,
      clientName,
      project.id,
      requestData.appUrl,
      requests
    );

    // Get access token
    const accessToken = await getAccessToken(serviceAccountEmail, privateKey, requestData.senderEmail);

    // Send to each finanzas user
    for (const profile of profiles) {
      console.log(`Sending email to: ${profile.email}`);
      await sendViaGmailAPI(
        accessToken,
        profile.email,
        requestData.senderEmail,
        subject,
        body
      );
    }

    console.log('Emails sent successfully');

    return new Response(
      JSON.stringify({ success: true, emailsSent: profiles.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-project-completed-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
