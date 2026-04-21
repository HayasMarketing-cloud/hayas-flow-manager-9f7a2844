import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ExtractedInvoiceData {
  invoice_number: string;
  invoice_date: string | null;
  period_month: number | null;
  period_year: number | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  irpf_rate: number | null;
  irpf_amount: number | null;
  total_amount: number;
  specialist_name: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, pdf_base64, file_name } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: 'PDF data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP and user agent for evidence
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Use service role to access protected tables
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validate token and get signature with liquidation data
    console.log('Validating signature token...');
    const { data: signature, error: sigError } = await supabase
      .from('liquidation_signatures')
      .select(`
        id,
        status,
        expires_at,
        liquidation:liquidations(
          id,
          code,
          subtotal,
          specialist_id,
          specialist_invoice_url
        )
      `)
      .eq('token', token)
      .single();

    if (sigError || !signature) {
      console.error('Token validation failed:', sigError);
      return new Response(
        JSON.stringify({ error: 'Token inválido o no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if token is expired
    if (new Date(signature.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'El enlace ha expirado' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check signature status - allow upload even if already signed
    // but not if disputed (status could be pending, accepted, or disputed)
    if (signature.status === 'disputed') {
      return new Response(
        JSON.stringify({ error: 'No se puede subir factura en una liquidación disputada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const liquidation = signature.liquidation as any;
    if (!liquidation) {
      return new Response(
        JSON.stringify({ error: 'Liquidación no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const liquidationId = liquidation.id;

    // Calculate subtotal from actual liquidation_items (more reliable than stored field)
    console.log(`Fetching liquidation items to calculate real subtotal...`);
    const { data: items, error: itemsError } = await supabase
      .from('liquidation_items')
      .select('total')
      .eq('liquidation_id', liquidationId);

    if (itemsError) {
      console.error('Error fetching liquidation items:', itemsError);
      return new Response(
        JSON.stringify({ error: 'Error al obtener items de liquidación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Real subtotal is the sum of all items
    const liquidationSubtotal = items?.reduce((sum, item) => sum + Number(item.total), 0) || 0;

    console.log(`Processing invoice upload for liquidation ${liquidation.code}, calculated subtotal: ${liquidationSubtotal}...`);

    // 4. Extract invoice data with AI
    let extractedData: ExtractedInvoiceData | null = null;
    let aiError: string | null = null;

    try {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('AI service not configured');
      }

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analiza esta factura de un profesional/freelance y extrae los siguientes datos. Responde SOLO con un JSON válido, sin explicaciones ni markdown:

{
  "invoice_number": "número de factura del profesional",
  "invoice_date": "fecha de emisión en formato YYYY-MM-DD",
  "period_month": mes del período facturado (1-12) o null si no se encuentra,
  "period_year": año del período facturado o null si no se encuentra,
  "subtotal": importe base sin impuestos (número),
  "tax_rate": porcentaje de IVA aplicado (número, ej: 21),
  "tax_amount": importe del IVA (número),
  "irpf_rate": porcentaje de retención IRPF si existe (número, ej: 15) o null,
  "irpf_amount": importe de la retención IRPF (número) o null,
  "total_amount": importe total a pagar (base + IVA - IRPF),
  "specialist_name": nombre del emisor de la factura
}

IMPORTANTE:
- Esta es una factura emitida POR un profesional/freelance
- El IRPF es una retención que SE RESTA del total (común en España: 7%, 15%)
- La fórmula es: total = subtotal + IVA - IRPF
- Si no hay IRPF, usa null para irpf_rate e irpf_amount
- Los importes deben ser números, no strings
- Responde SOLO el JSON, sin texto adicional`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${pdf_base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;
        
        if (content) {
          let jsonStr = content.trim();
          if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
          else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
          if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
          jsonStr = jsonStr.trim();
          
          const parsed = JSON.parse(jsonStr);
          extractedData = {
            invoice_number: parsed.invoice_number || '',
            invoice_date: parsed.invoice_date || null,
            period_month: parsed.period_month ?? null,
            period_year: parsed.period_year ?? null,
            subtotal: Number(parsed.subtotal) || 0,
            tax_rate: Number(parsed.tax_rate) || 0,
            tax_amount: Number(parsed.tax_amount) || 0,
            irpf_rate: parsed.irpf_rate != null ? Number(parsed.irpf_rate) : null,
            irpf_amount: parsed.irpf_amount != null ? Number(parsed.irpf_amount) : null,
            total_amount: Number(parsed.total_amount) || 0,
            specialist_name: parsed.specialist_name || null,
          };
          console.log('AI extraction successful:', { 
            invoice: extractedData.invoice_number, 
            subtotal: extractedData.subtotal 
          });
        }
      } else {
        const status = aiResponse.status;
        if (status === 429) aiError = 'Rate limit exceeded';
        else if (status === 402) aiError = 'AI credits exhausted';
        else aiError = `AI error: ${status}`;
        console.warn('AI extraction failed:', aiError);
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : 'AI extraction failed';
      console.warn('AI extraction exception:', aiError);
    }

    // 5. Compare amounts (±1€ tolerance)
    const invoiceSubtotal = extractedData?.subtotal ?? null;
    const amountsMatch = invoiceSubtotal !== null 
      ? Math.abs(invoiceSubtotal - liquidationSubtotal) <= 1
      : null;

    console.log('Amount comparison:', { 
      invoiceSubtotal, 
      liquidationSubtotal, 
      amountsMatch 
    });

    // 6. Upload PDF to storage with unique path (no overwrite)
    const slug = (s: string) =>
      s.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9.]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'factura.pdf';

    const newInvoiceId = crypto.randomUUID();
    const safeName = slug(file_name || 'factura.pdf');
    const filePath = `${liquidationId}/${newInvoiceId}-${safeName}`;
    const pdfBuffer = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from('liquidation-invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Error al subir la factura' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('liquidation-invoices')
      .getPublicUrl(filePath);
    const invoiceUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    // 7. Insert row in liquidation_invoices
    const { error: insertInvoiceError } = await supabase
      .from('liquidation_invoices')
      .insert({
        id: newInvoiceId,
        liquidation_id: liquidationId,
        file_url: invoiceUrl,
        file_name: file_name || 'factura.pdf',
        storage_path: filePath,
        invoice_number: extractedData?.invoice_number || null,
        invoice_date: extractedData?.invoice_date || null,
        subtotal: extractedData?.subtotal ?? null,
        tax_amount: extractedData?.tax_amount ?? null,
        irpf_amount: extractedData?.irpf_amount ?? null,
        total_amount: extractedData?.total_amount ?? null,
        ai_extracted: extractedData,
      });

    if (insertInvoiceError) {
      console.error('Insert invoice error:', insertInvoiceError);
      return new Response(
        JSON.stringify({ error: 'Error al registrar la factura' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Recompute sum across all invoices and adjust status
    const { data: allInvoices } = await supabase
      .from('liquidation_invoices')
      .select('id, file_url, file_name, invoice_number, invoice_date, subtotal, total_amount, uploaded_at')
      .eq('liquidation_id', liquidationId)
      .order('uploaded_at', { ascending: true });

    const invoicesSum = (allInvoices || []).reduce(
      (acc: number, i: any) => acc + (Number(i.subtotal) || 0),
      0,
    );
    const sumMatches = Math.abs(invoicesSum - liquidationSubtotal) <= 1;

    const currentStatus = (liquidation as any).status as string | undefined;
    let newStatus: string | null = null;
    if (sumMatches && ['accepted', 'invoice_received'].includes(currentStatus || '')) {
      newStatus = 'pending_payment';
    } else if (!sumMatches && currentStatus === 'pending_payment') {
      newStatus = 'invoice_received';
    } else if (!sumMatches && currentStatus === 'accepted') {
      newStatus = 'invoice_received';
    } else if (!currentStatus || ['draft', 'validated', 'sent'].includes(currentStatus)) {
      newStatus = sumMatches ? 'pending_payment' : 'invoice_received';
    }

    const liquidationUpdate: { specialist_invoice_url: string; status?: string } = {
      specialist_invoice_url: invoiceUrl,
    };
    if (newStatus) liquidationUpdate.status = newStatus;

    const { error: liquidationUpdateError } = await supabase
      .from('liquidations')
      .update(liquidationUpdate)
      .eq('id', liquidationId);

    if (liquidationUpdateError) {
      console.error('Liquidation update error:', liquidationUpdateError);
    }

    // 9. Record digital evidence in signature
    const verificationData = {
      uploaded_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      extracted_data: extractedData,
      invoice_subtotal: invoiceSubtotal,
      invoices_sum: invoicesSum,
      invoice_count: (allInvoices || []).length,
      liquidation_subtotal: liquidationSubtotal,
      amounts_match: sumMatches,
      tolerance_applied: '±1€',
      ai_error: aiError,
    };

    const { error: signatureUpdateError } = await supabase
      .from('liquidation_signatures')
      .update({
        invoice_uploaded_at: new Date().toISOString(),
        invoice_verification: verificationData,
      })
      .eq('id', signature.id);

    if (signatureUpdateError) {
      console.error('Signature update error:', signatureUpdateError);
      // Non-critical, continue
    }

    console.log(`Invoice uploaded successfully for ${liquidation.code}`);

    // 9. Get specialist name
    const { data: specialistData } = await supabase
      .from('specialists')
      .select('name')
      .eq('id', liquidation.specialist_id)
      .single();
    const specialistName = specialistData?.name || 'Especialista';

    // 10. Send in-app notifications to admin & finanzas
    try {
      const { data: adminFinanzaUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'finanzas']);

      const uniqueUserIds = [...new Set(adminFinanzaUsers?.map(r => r.user_id) || [])];
      
      if (uniqueUserIds.length > 0) {
        const matchText = amountsMatch === true
          ? 'Los importes coinciden ✓'
          : amountsMatch === false
            ? '⚠ Los importes NO coinciden'
            : 'No se pudo verificar el importe';

        const notifications = uniqueUserIds.map(userId => ({
          user_id: userId,
          title: 'Factura de especialista recibida',
          message: `${specialistName} ha subido su factura para ${liquidation.code}. ${matchText}`,
          type: amountsMatch === false ? 'warning' : 'info',
          category: 'liquidation',
          entity_id: liquidationId,
          entity_type: 'liquidation',
          action_url: `/liquidaciones/${liquidationId}`,
        }));

        await supabase.from('notifications').insert(notifications);
        console.log(`Sent ${notifications.length} in-app notifications`);
      }
    } catch (notifError) {
      console.error('Error sending in-app notifications:', notifError);
    }

    // 11. Send email notification via Gmail API
    try {
      const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
      const serviceAccountPrivateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
      const gmailUser = Deno.env.get('GMAIL_USER');
      const appUrl = Deno.env.get('APP_PRODUCTION_URL') || 'https://hayas-flow-manager.lovable.app';

      if (serviceAccountEmail && serviceAccountPrivateKey && gmailUser) {
        // Get admin/finanzas emails
        const { data: adminFinanzaUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'finanzas']);

        const uniqueIds = [...new Set(adminFinanzaUsers?.map(r => r.user_id) || [])];

        if (uniqueIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('email')
            .in('id', uniqueIds);

          const recipientEmails = profiles
            ?.map(p => p.email)
            .filter(e => e && e.includes('@hayas.es')) || [];

          if (recipientEmails.length > 0) {
            // Create JWT and get access token
            const now = Math.floor(Date.now() / 1000);
            const header = { alg: "RS256", typ: "JWT" };
            const payload = {
              iss: serviceAccountEmail,
              sub: gmailUser,
              scope: "https://www.googleapis.com/auth/gmail.send",
              aud: "https://oauth2.googleapis.com/token",
              iat: now,
              exp: now + 3600
            };

            const b64url = (data: string) => {
              const b64 = btoa(data);
              return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            };

            const headerB64 = b64url(JSON.stringify(header));
            const payloadB64 = b64url(JSON.stringify(payload));
            const unsignedToken = `${headerB64}.${payloadB64}`;

            const pemContent = serviceAccountPrivateKey
              .replace(/-----BEGIN PRIVATE KEY-----/g, '')
              .replace(/-----END PRIVATE KEY-----/g, '')
              .replace(/\\n/g, '')
              .replace(/\s/g, '');

            const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
            const cryptoKey = await crypto.subtle.importKey(
              "pkcs8", binaryKey,
              { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
              false, ["sign"]
            );

            const sig = await crypto.subtle.sign(
              "RSASSA-PKCS1-v1_5", cryptoKey,
              new TextEncoder().encode(unsignedToken)
            );
            const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));
            const jwt = `${unsignedToken}.${sigB64}`;

            const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
            });

            if (tokenResp.ok) {
              const tokenData = await tokenResp.json();
              const accessToken = tokenData.access_token;

              const matchStatus = amountsMatch === true
                ? '✅ Los importes coinciden'
                : amountsMatch === false
                  ? '⚠️ Los importes NO coinciden'
                  : 'ℹ️ No se pudo verificar el importe';

              const detailUrl = `${appUrl}/liquidaciones/${liquidationId}`;
              const subject = `Factura recibida - ${liquidation.code} - ${specialistName}`;
              const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1a1a2e;">Factura de especialista recibida</h2>
                  <p>El especialista <strong>${specialistName}</strong> ha subido su factura para la liquidación <strong>${liquidation.code}</strong>.</p>
                  <div style="background: ${amountsMatch === false ? '#fef2f2' : '#f0fdf4'}; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 0; font-weight: 600; color: ${amountsMatch === false ? '#dc2626' : '#16a34a'};">${matchStatus}</p>
                    ${invoiceSubtotal !== null ? `<p style="margin: 4px 0 0; font-size: 14px;">Factura: €${invoiceSubtotal.toFixed(2)} | Liquidación: €${liquidationSubtotal.toFixed(2)}</p>` : ''}
                  </div>
                  <a href="${detailUrl}" style="display: inline-block; background: #1a1a2e; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 12px;">Ver liquidación</a>
                </div>
              `;

              for (const recipientEmail of recipientEmails) {
                const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
                const mimeMessage = [
                  `From: ${gmailUser}`,
                  `To: ${recipientEmail}`,
                  `Subject: ${encodedSubject}`,
                  `MIME-Version: 1.0`,
                  `Content-Type: text/html; charset="UTF-8"`,
                  `Content-Transfer-Encoding: base64`,
                  ``,
                  btoa(unescape(encodeURIComponent(htmlContent))),
                ].join("\r\n");

                const raw = b64url(mimeMessage);
                await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ raw }),
                });
              }
              console.log(`Sent email to ${recipientEmails.length} recipients`);
            }
          }
        }
      } else {
        console.warn('Gmail credentials not configured, skipping email notification');
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
    }

    // 12. Return result
    return new Response(
      JSON.stringify({
        success: true,
        invoiceUrl,
        amountsMatch,
        invoiceSubtotal,
        liquidationSubtotal,
        extractedData,
        digitalEvidence: {
          uploadedAt: verificationData.uploaded_at,
          ipAddress: ipAddress,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-specialist-invoice:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
