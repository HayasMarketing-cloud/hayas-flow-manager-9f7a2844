import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedInvoiceData {
  invoice_code: string;
  client_name: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface Client {
  id: string;
  name: string;
}

const matchClient = (extractedName: string, clients: Client[]): { client_id: string | null; client_matched: boolean } => {
  if (!extractedName || !clients.length) {
    return { client_id: null, client_matched: false };
  }

  const normalize = (s: string) => s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[.,\s]+/g, ' ')
    .trim();

  const normalizedExtracted = normalize(extractedName);

  for (const client of clients) {
    const normalizedClient = normalize(client.name);
    
    // Check for exact match or partial match
    if (normalizedClient === normalizedExtracted ||
        normalizedClient.includes(normalizedExtracted) ||
        normalizedExtracted.includes(normalizedClient)) {
      return { client_id: client.id, client_matched: true };
    }
    
    // Check for word-level matching (e.g., "Asendia" matches "Asendia Spain")
    const extractedWords = normalizedExtracted.split(' ').filter(w => w.length > 2);
    const clientWords = normalizedClient.split(' ').filter(w => w.length > 2);
    
    for (const extractedWord of extractedWords) {
      for (const clientWord of clientWords) {
        if (extractedWord === clientWord && extractedWord.length > 3) {
          return { client_id: client.id, client_matched: true };
        }
      }
    }
  }

  return { client_id: null, client_matched: false };
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_base64, clients } = await req.json();

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

    console.log('Processing invoice PDF with AI...');

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
                text: `Analiza esta factura y extrae los siguientes datos. Responde SOLO con un JSON válido, sin explicaciones ni markdown:

{
  "invoice_code": "número o código de la factura",
  "client_name": "nombre del cliente facturado (la empresa o persona a quien se factura)",
  "invoice_date": "fecha de emisión en formato YYYY-MM-DD",
  "due_date": "fecha de vencimiento en formato YYYY-MM-DD si aparece, o null",
  "subtotal": importe base imponible sin IVA (número),
  "tax_rate": porcentaje de IVA aplicado (número, ejemplo: 21),
  "tax_amount": importe del IVA (número),
  "total_amount": importe total con IVA (número),
  "line_items": [
    {"description": "descripción del servicio", "quantity": cantidad, "unit_price": precio_unitario}
  ]
}

IMPORTANTE: 
- Los importes deben ser números, no strings
- El client_name es a QUIEN se factura, no quien emite la factura
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
    let extractedData: ExtractedInvoiceData;
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

    // Match client if clients list provided
    let clientMatch = { client_id: null as string | null, client_matched: false };
    if (clients && Array.isArray(clients) && extractedData.client_name) {
      clientMatch = matchClient(extractedData.client_name, clients);
    }

    const result = {
      ...extractedData,
      client_id: clientMatch.client_id,
      client_matched: clientMatch.client_matched,
    };

    console.log('Invoice data extracted successfully:', {
      invoice_code: result.invoice_code,
      client_name: result.client_name,
      client_matched: result.client_matched,
      total_amount: result.total_amount
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-invoice-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
