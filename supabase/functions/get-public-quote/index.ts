import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate token
    const { data: shareToken, error: tokenError } = await supabase
      .from('budget_share_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !shareToken) {
      return new Response(JSON.stringify({ error: 'Enlace no válido o expirado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiration
    if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Este enlace ha expirado' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get budget with client and items
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        id, code, title, description, valid_until, created_at, total_amount, client_po_number, status,
        clients!budgets_client_id_fkey (id, name, code, address, city, tax_id)
      `)
      .eq('id', shareToken.budget_id)
      .single();

    if (budgetError || !budget) {
      return new Response(JSON.stringify({ error: 'Presupuesto no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get items with service info
    const { data: items, error: itemsError } = await supabase
      .from('budget_items')
      .select(`
        id, description, quantity, unit_price, total,
        services!budget_items_service_id_fkey (id, name, category)
      `)
      .eq('budget_id', shareToken.budget_id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      return new Response(JSON.stringify({ error: 'Error al obtener items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update access counter
    await supabase
      .from('budget_share_tokens')
      .update({
        accessed_count: (shareToken.accessed_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', shareToken.id);

    return new Response(JSON.stringify({
      budget: {
        ...budget,
        client: budget.clients,
      },
      items: (items || []).map((item: any) => ({
        ...item,
        service: item.services,
      })),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
