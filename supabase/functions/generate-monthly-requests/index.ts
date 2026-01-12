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
    // 1. Validate authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate user token and get user identity
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check user roles using service role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Error validating permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedRoles = ['admin', 'finanzas', 'project_manager'];
    const hasPermission = roles?.some(r => allowedRoles.includes(r.role));

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parse request body
    const { contract_id } = await req.json();

    if (!contract_id) {
      return new Response(
        JSON.stringify({ error: 'contract_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Fetch contract with services using admin client
    const { data: contract, error: contractError } = await supabaseAdmin
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

    // 6. Create requests based on billing_frequency
    const now = new Date();
    const monthName = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const requests = [];

    for (const service of contract.contract_services) {
      if (service.billing_frequency === 'monthly') {
        requests.push({
          client_id: contract.client_id,
          service_id: service.service_id,
          specialist_id: service.specialist_id,
          contract_id: contract_id,
          title: `${service.description} - ${monthName}`,
          description: `Generado automáticamente desde contrato. ${service.notes || ''}`,
          quantity: service.quantity,
          status: 'active',
          code: '',
        });
      }
    }

    if (requests.length === 0) {
      return new Response(
        JSON.stringify({ count: 0, message: 'No monthly services to generate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Insert requests
    const { data: createdRequests, error: requestsError } = await supabaseAdmin
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