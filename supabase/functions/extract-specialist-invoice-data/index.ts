import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedSpecialistInvoice {
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

serve(async (req) => {
  // Handle CORS preflight
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
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing specialist invoice PDF with AI...');

    // Call Lovable AI Gateway with Gemini (multimodal model)
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
- Busca el período de trabajo facturado (ej: "Trabajos enero 2026", "Servicios mes de enero")
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
    console.log('AI response received');

    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      console.error('No content in AI response:', aiData);
      return new Response(
        JSON.stringify({ error: 'No se pudo extraer información de la factura' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response - handle potential markdown code blocks
    let extractedData: ExtractedSpecialistInvoice;
    try {
      let jsonStr = content.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      return new Response(
        JSON.stringify({ 
          error: 'Error al interpretar los datos extraídos',
          raw_content: content 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure numeric values
    const result: ExtractedSpecialistInvoice = {
      invoice_number: extractedData.invoice_number || '',
      invoice_date: extractedData.invoice_date || null,
      period_month: extractedData.period_month ?? null,
      period_year: extractedData.period_year ?? null,
      subtotal: Number(extractedData.subtotal) || 0,
      tax_rate: Number(extractedData.tax_rate) || 0,
      tax_amount: Number(extractedData.tax_amount) || 0,
      irpf_rate: extractedData.irpf_rate != null ? Number(extractedData.irpf_rate) : null,
      irpf_amount: extractedData.irpf_amount != null ? Number(extractedData.irpf_amount) : null,
      total_amount: Number(extractedData.total_amount) || 0,
      specialist_name: extractedData.specialist_name || null,
    };

    console.log('Specialist invoice data extracted:', {
      invoice_number: result.invoice_number,
      invoice_date: result.invoice_date,
      period: result.period_month && result.period_year 
        ? `${result.period_month}/${result.period_year}` 
        : 'unknown',
      total_amount: result.total_amount,
      irpf_rate: result.irpf_rate,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-specialist-invoice-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
