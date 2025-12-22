import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
      throw new Error("Gmail credentials not configured");
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

    // Create SMTP client for Gmail
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });

    // Convert base64 to Uint8Array for attachment
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    // Send email
    await client.send({
      from: gmailUser,
      to: specialistEmail,
      subject: `Liquidación ${liquidationCode} - ${periodName} - Pendiente de validación`,
      content: `
        Hola ${specialistName},

        Te enviamos la liquidación correspondiente al período ${periodName}.

        Código: ${liquidationCode}
        Total: ${formattedAmount}

        Por favor, revisa el documento adjunto y confirma que los datos son correctos.
        Si tienes alguna discrepancia, no dudes en contactarnos.

        Saludos cordiales,
        El equipo de administración
      `,
      html: `
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
      `,
      attachments: [
        {
          filename: `Liquidacion_${liquidationCode}.pdf`,
          content: pdfBytes,
          contentType: "application/pdf",
          encoding: "binary",
        },
      ],
    });

    await client.close();

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

serve(handler);
