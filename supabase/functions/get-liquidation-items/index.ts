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

    // Fetch liquidation items with full data for PDF grouping
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
          hours,
          quantity,
          cost_type,
          client:clients(id, name),
          budget:budgets(id, code, title)
        )
      `)
      .eq('liquidation_id', liquidation_id);

    // Fetch operational project info for items that have financial_request_id
    const requestIds = (items || [])
      .map((item: any) => item.financial_request?.id)
      .filter(Boolean);

    let opRequestMap: Record<string, any> = {};
    if (requestIds.length > 0) {
      const { data: opRequests } = await supabase
        .from('operational_requests')
        .select('financial_request_id, operational_project:operational_projects(id, name)')
        .in('financial_request_id', requestIds);

      if (opRequests) {
        for (const opr of opRequests) {
          if (opr.financial_request_id) {
            opRequestMap[opr.financial_request_id] = opr.operational_project;
          }
        }
      }
    }

    // Merge operational project data into items
    const enrichedItems = (items || []).map((item: any) => {
      if (item.financial_request?.id && opRequestMap[item.financial_request.id]) {
        return {
          ...item,
          financial_request: {
            ...item.financial_request,
            operational_project: opRequestMap[item.financial_request.id],
          },
        };
      }
      return item;
    });

    if (itemsError) {
      throw itemsError;
    }

    return new Response(
      JSON.stringify(enrichedItems),
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
