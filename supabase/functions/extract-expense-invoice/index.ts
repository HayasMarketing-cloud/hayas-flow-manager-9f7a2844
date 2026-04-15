import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_base64 } = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: 'PDF data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing expense invoice with AI...');

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
                text: `Analiza esta factura de gasto/suscripción y extrae los siguientes datos. Responde SOLO con un JSON válido, sin explicaciones ni markdown:

{
  "issuer_name": "nombre de la empresa que emite la factura",
  "description": "concepto o descripción principal del servicio facturado",
  "invoice_date": "fecha de emisión en formato YYYY-MM-DD",
  "subtotal": importe base imponible sin IVA (número),
  "tax_rate": porcentaje de IVA aplicado (número, ejemplo: 21). Si NO aparece IVA o está exento, pon 0,
  "tax_amount": importe del IVA (número). Si no hay IVA, pon 0,
  "total_amount": importe total incluyendo IVA (número)
}

IMPORTANTE:
- Los importes deben ser números, no strings
- El issuer_name es QUIEN EMITE la factura (el proveedor/vendedor)
- Si el total coincide con el subtotal y no se menciona IVA, tax_rate y tax_amount deben ser 0
- Si no encuentras algún dato, usa null o 0 según corresponda
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
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const errorStatus = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorStatus, errorText);

      if (errorStatus === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes excedido. Intenta de nuevo en unos momentos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (errorStatus === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA agotados. Contacta al administrador.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Error procesando la factura con IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No se pudo extraer información de la factura' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedData;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      jsonStr = jsonStr.trim();
      extractedData = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Error al interpretar los datos extraídos', raw_content: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Expense invoice extracted:', extractedData);

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in extract-expense-invoice:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
