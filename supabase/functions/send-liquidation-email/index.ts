import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LiquidationEmailRequest {
  specialistName: string;
  specialistEmail: string;
  liquidationCode: string;
  periodMonth: number;
  periodYear: number;
  totalAmount: number;
  pdfBase64: string;
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPassword) {
      console.error("Gmail credentials not configured");
      throw new Error("Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD secrets.");
    }

    const {
      specialistName,
      specialistEmail,
      liquidationCode,
      periodMonth,
      periodYear,
      totalAmount,
      pdfBase64,
    }: LiquidationEmailRequest = await req.json();

    console.log(`Sending liquidation email to ${specialistEmail} for ${liquidationCode}`);

    const periodName = `${monthNames[periodMonth - 1]} ${periodYear}`;
    const formattedAmount = new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(totalAmount);

    // Build email content
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
        
        <p>Por favor, revisa el documento adjunto y confirma que los datos son correctos.</p>
        <p>Si tienes alguna discrepancia, no dudes en contactarnos.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 0.9em;">
          Saludos cordiales,<br>
          <strong>El equipo de administración</strong>
        </p>
      </div>
    `;

    // Use native fetch to send email via Gmail API with SMTP simulation
    // Since denomailer causes CPU timeout, we'll use a simpler approach with nodemailer-like logic
    
    // For now, let's use the Gmail API approach with base64 encoding
    const boundary = "boundary_" + Date.now();
    
    const rawEmail = [
      `From: ${gmailUser}`,
      `To: ${specialistEmail}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(htmlContent))),
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="Liquidacion_${liquidationCode}.pdf"`,
      `Content-Disposition: attachment; filename="Liquidacion_${liquidationCode}.pdf"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      pdfBase64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    // Convert to base64url for Gmail API
    const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Get OAuth2 access token using service account or app password
    // For simplicity with App Password, we'll use SMTP relay
    // But since that times out, let's try a direct HTTP approach to Gmail's SMTP
    
    // Alternative: Use a lightweight SMTP approach
    const smtpResponse = await sendViaSMTP({
      host: "smtp.gmail.com",
      port: 587,
      user: gmailUser,
      password: gmailPassword,
      from: gmailUser,
      to: specialistEmail,
      subject: subject,
      html: htmlContent,
      pdfBase64: pdfBase64,
      pdfFilename: `Liquidacion_${liquidationCode}.pdf`,
    });

    if (!smtpResponse.success) {
      throw new Error(smtpResponse.error || "Failed to send email");
    }

    console.log(`Email sent successfully to ${specialistEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado correctamente" }),
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

// Lightweight SMTP implementation optimized for Deno edge functions
async function sendViaSMTP(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  pdfBase64: string;
  pdfFilename: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const read = async (): Promise<string> => {
      const buffer = new Uint8Array(1024);
      const n = await conn.read(buffer);
      if (n === null) return "";
      return decoder.decode(buffer.subarray(0, n));
    };

    const write = async (data: string): Promise<void> => {
      await conn.write(encoder.encode(data + "\r\n"));
    };

    const readAndCheck = async (expectedCode: string): Promise<boolean> => {
      const response = await read();
      console.log("SMTP Response:", response.trim());
      return response.startsWith(expectedCode);
    };

    // Read greeting
    await read();

    // EHLO
    await write(`EHLO ${config.host}`);
    await read();

    // STARTTLS
    await write("STARTTLS");
    if (!await readAndCheck("220")) {
      throw new Error("STARTTLS failed");
    }

    // Upgrade to TLS
    const tlsConn = await Deno.startTls(conn, { hostname: config.host });

    const tlsRead = async (): Promise<string> => {
      const buffer = new Uint8Array(4096);
      const n = await tlsConn.read(buffer);
      if (n === null) return "";
      return decoder.decode(buffer.subarray(0, n));
    };

    const tlsWrite = async (data: string): Promise<void> => {
      await tlsConn.write(encoder.encode(data + "\r\n"));
    };

    // EHLO again after TLS
    await tlsWrite(`EHLO ${config.host}`);
    await tlsRead();

    // AUTH LOGIN
    await tlsWrite("AUTH LOGIN");
    await tlsRead();

    await tlsWrite(btoa(config.user));
    await tlsRead();

    await tlsWrite(btoa(config.password));
    const authResponse = await tlsRead();
    if (!authResponse.startsWith("235")) {
      throw new Error("Authentication failed: " + authResponse);
    }

    // MAIL FROM
    await tlsWrite(`MAIL FROM:<${config.from}>`);
    await tlsRead();

    // RCPT TO
    await tlsWrite(`RCPT TO:<${config.to}>`);
    await tlsRead();

    // DATA
    await tlsWrite("DATA");
    const dataResponse = await tlsRead();
    if (!dataResponse.startsWith("354")) {
      throw new Error("DATA command failed: " + dataResponse);
    }

    // Build message with attachment
    const boundary = "----=_Part_" + Date.now();
    const message = [
      `From: ${config.from}`,
      `To: ${config.to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(config.subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(config.html))),
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${config.pdfFilename}"`,
      `Content-Disposition: attachment; filename="${config.pdfFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      config.pdfBase64,
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    await tlsWrite(message);
    const sendResponse = await tlsRead();
    
    if (!sendResponse.startsWith("250")) {
      throw new Error("Failed to send message: " + sendResponse);
    }

    // QUIT
    await tlsWrite("QUIT");
    await tlsRead();

    tlsConn.close();

    return { success: true };
  } catch (error: any) {
    console.error("SMTP Error:", error);
    return { success: false, error: error.message };
  }
}

serve(handler);
