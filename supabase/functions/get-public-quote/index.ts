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
    const code = url.searchParams.get('code');

    if (!token && !code) {
      return new Response(JSON.stringify({ error: 'Token o código requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate token or short_code
    let query = supabase
      .from('budget_share_tokens')
      .select('*')
      .eq('is_active', true);
    
    if (code) {
      query = query.eq('short_code', code);
    } else {
      query = query.eq('token', token);
    }

    const { data: shareToken, error: tokenError } = await query.single();

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
        id, code, title, description, valid_until, created_at, total_amount, client_po_number, status, client_contact_id, estimated_invoice_date, payment_plan,
        clients!budgets_client_id_fkey (id, name, code, address, city, tax_id),
        client_contacts!budgets_client_contact_id_fkey (id, name, email, role)
      `)
      .eq('id', shareToken.budget_id)
      .single();

    if (budgetError || !budget) {
      return new Response(JSON.stringify({ error: 'Presupuesto no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get invoice allocations linked to this budget
    const { data: allocations } = await supabase
      .from('invoice_budget_allocations')
      .select(`
        id, allocated_amount,
        invoice:invoices!invoice_budget_allocations_invoice_id_fkey (
          id, code, invoice_date, status, pdf_url, source_milestone_index, budget_id
        )
      `)
      .eq('budget_id', shareToken.budget_id);


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
        requested_by: budget.client_contacts?.name || null,
        quote_code: shareToken.short_code || null,
      },
      items: (items || []).map((item: any) => ({
        ...item,
        service: item.services,
      })),
      allocations: (allocations || [])
        .filter((a: any) => a.invoice)
        .map((a: any) => ({
          id: a.id,
          allocated_amount: Number(a.allocated_amount),
          invoice: a.invoice,
        })),
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
