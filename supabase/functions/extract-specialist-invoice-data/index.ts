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
  "subtotal": BASE IMPONIBLE (importe de servicios SIN IVA y SIN restar IRPF),
  "tax_rate": porcentaje de IVA aplicado (número, ej: 21),
  "tax_amount": importe del IVA en euros,
  "irpf_rate": porcentaje de retención IRPF si existe (número, ej: 7 o 15) o null,
  "irpf_amount": importe de la retención IRPF en euros o null,
  "total_with_tax": subtotal + IVA (antes de restar IRPF),
  "total_amount": importe LÍQUIDO a pagar después de restar IRPF (subtotal + IVA - IRPF),
  "specialist_name": nombre del emisor de la factura
}

REGLAS CRÍTICAS DE EXTRACCIÓN:
- Esta es una factura emitida POR un profesional/freelance hacia una agencia
- "subtotal" = BASE IMPONIBLE. NO es el total a pagar. NO incluye IVA. NO resta IRPF.
- El IRPF es una retención que SE RESTA del total a pagar (común en España: 7%, 15%)
- Fórmula obligatoria: subtotal + tax_amount - irpf_amount = total_amount
- Verificación: total_with_tax = subtotal + tax_amount

EJEMPLO 1 (con IVA 21% e IRPF 15%):
  Servicios prestados: 1.000,00 €  ← este es el "subtotal" (base imponible)
  IVA 21%:               210,00 €  ← "tax_amount"
  IRPF -15%:            -150,00 €  ← "irpf_amount" (positivo: 150)
  Total a pagar:       1.060,00 €  ← "total_amount" (líquido)
  → subtotal=1000, tax_amount=210, irpf_amount=150, total_amount=1060, total_with_tax=1210

EJEMPLO 2 (solo IVA 21%, sin IRPF):
  Base:        500,00 €  ← "subtotal"
  IVA 21%:     105,00 €  ← "tax_amount"
  Total:       605,00 €  ← "total_amount"
  → subtotal=500, tax_amount=105, irpf_rate=null, irpf_amount=null, total_amount=605

NUNCA pongas el "total a pagar" en el campo "subtotal". El subtotal es siempre la cifra menor antes de impuestos.
- Si no hay IRPF, usa null para irpf_rate e irpf_amount
- Busca el período de trabajo facturado (ej: "Trabajos enero 2026", "Servicios mes de enero")
- Los importes deben ser números (no strings, no euros, no símbolos)
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

    // === Coherence post-processing ===
    // Validate: subtotal + tax_amount - (irpf_amount || 0) ≈ total_amount
    const irpf = result.irpf_amount ?? 0;
    const expectedTotal = result.subtotal + result.tax_amount - irpf;
    const coherent = Math.abs(expectedTotal - result.total_amount) <= 1;

    if (!coherent && result.total_amount > 0) {
      console.warn('Incoherent extraction, attempting reconstruction:', {
        subtotal: result.subtotal,
        tax_amount: result.tax_amount,
        irpf_amount: irpf,
        total_amount: result.total_amount,
        expectedTotal,
      });

      // Strategy A: reconstruct subtotal from total + rates
      if (result.tax_rate > 0) {
        const taxFactor = result.tax_rate / 100;
        const irpfFactor = (result.irpf_rate ?? 0) / 100;
        const denom = 1 + taxFactor - irpfFactor;
        if (denom > 0) {
          const newSubtotal = result.total_amount / denom;
          const newTax = newSubtotal * taxFactor;
          const newIrpf = result.irpf_rate != null ? newSubtotal * irpfFactor : null;
          result.subtotal = Math.round(newSubtotal * 100) / 100;
          result.tax_amount = Math.round(newTax * 100) / 100;
          if (newIrpf !== null) result.irpf_amount = Math.round(newIrpf * 100) / 100;
          console.log('Reconstructed from total + rates:', {
            subtotal: result.subtotal,
            tax_amount: result.tax_amount,
            irpf_amount: result.irpf_amount,
          });
        }
      } else if (result.tax_amount > 0 && result.tax_rate > 0) {
        // Strategy B: reconstruct subtotal from tax_amount / tax_rate
        result.subtotal = Math.round((result.tax_amount / (result.tax_rate / 100)) * 100) / 100;
        console.log('Reconstructed subtotal from tax:', result.subtotal);
      }
    }

    console.log('Specialist invoice data extracted:', {
      invoice_number: result.invoice_number,
      invoice_date: result.invoice_date,
      period: result.period_month && result.period_year
        ? `${result.period_month}/${result.period_year}`
        : 'unknown',
      subtotal: result.subtotal,
      tax_amount: result.tax_amount,
      irpf_amount: result.irpf_amount,
      total_amount: result.total_amount,
      coherent,
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
