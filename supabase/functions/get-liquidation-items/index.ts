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
    const { token, liquidation_id } = await req.json();

    if (!token || !liquidation_id) {
      return new Response(
        JSON.stringify({ error: 'Token and liquidation_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token) || !uuidRegex.test(liquidation_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First verify the token is valid and matches the liquidation
    const { data: signature, error: sigError } = await supabase
      .from('liquidation_signatures')
      .select('id, liquidation_id')
      .eq('token', token)
      .eq('liquidation_id', liquidation_id)
      .single();

    if (sigError || !signature) {
      return new Response(
        JSON.stringify({ error: 'Invalid token or liquidation mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch liquidation items
    const { data: items, error: itemsError } = await supabase
      .from('liquidation_items')
      .select(`
        id,
        description,
        quantity,
        unit_price,
        total,
        financial_request:financial_requests(
          id,
          title,
          client:clients(name)
        )
      `)
      .eq('liquidation_id', liquidation_id);

    if (itemsError) {
      throw itemsError;
    }

    return new Response(
      JSON.stringify(items || []),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching liquidation items:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
