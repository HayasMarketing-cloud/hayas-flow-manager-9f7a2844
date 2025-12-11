import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contract_id } = await req.json();

    if (!contract_id) {
      return new Response(
        JSON.stringify({ error: 'contract_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Obtener contrato con sus servicios
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*, contract_services(*)')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Contract not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (contract.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Contract must be active to generate requests' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Crear requests según billing_frequency
    const now = new Date();
    const monthName = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const requests = [];

    for (const service of contract.contract_services) {
      if (service.billing_frequency === 'monthly') {
        // Crear request mensual sin precios (se resuelven en facturación)
        requests.push({
          client_id: contract.client_id,
          service_id: service.service_id,
          specialist_id: service.specialist_id,
          contract_id: contract_id,
          title: `${service.description} - ${monthName}`,
          description: `Generado automáticamente desde contrato. ${service.notes || ''}`,
          quantity: service.quantity,
          status: 'active', // Los contratos crean requests activos
          code: '', // El trigger generate_request_code lo generará
        });
      }
      // billing_frequency === 'one_time', 'per_project', 'on_demand' no generan requests automáticamente
    }

    if (requests.length === 0) {
      return new Response(
        JSON.stringify({ count: 0, message: 'No monthly services to generate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Insertar requests
    const { data: createdRequests, error: requestsError } = await supabase
      .from('financial_requests')
      .insert(requests)
      .select();

    if (requestsError) {
      throw requestsError;
    }

    return new Response(
      JSON.stringify({
        count: createdRequests?.length || 0,
        requests: createdRequests,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating monthly requests:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
