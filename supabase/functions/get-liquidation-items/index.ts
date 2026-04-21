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

    // Fetch commission details for this liquidation
    const { data: commissions } = await supabase
      .from('sales_commissions')
      .select('id, commission_type, commission_percentage, base_amount, invoice_ids, commission_amount, budget_id, contract_id')
      .eq('liquidation_id', liquidation_id);

    let commissionDetails: Record<string, any> = {};
    if (commissions?.length) {
      // Fetch all invoice data (codes + client + budget)
      const allInvoiceIds = [...new Set(commissions.flatMap((c: any) => c.invoice_ids || []))];
      let invoicesDataMap = new Map<string, any>();
      if (allInvoiceIds.length > 0) {
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, code, client_id, budget_id')
          .in('id', allInvoiceIds);
        
        // Fetch client names
        const clientIds = [...new Set((invoicesData || []).map((i: any) => i.client_id).filter(Boolean))];
        let clientMap = new Map<string, string>();
        if (clientIds.length > 0) {
          const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
          for (const c of (clients || [])) clientMap.set(c.id, c.name);
        }

        // Fetch budget info
        const budgetIds = [...new Set((invoicesData || []).map((i: any) => i.budget_id).filter(Boolean))];
        let budgetMap = new Map<string, any>();
        if (budgetIds.length > 0) {
          const { data: budgets } = await supabase.from('budgets').select('id, code, title').in('id', budgetIds);
          for (const b of (budgets || [])) budgetMap.set(b.id, b);
        }

        for (const inv of (invoicesData || [])) {
          invoicesDataMap.set(inv.id, {
            code: inv.code,
            client_id: inv.client_id,
            client_name: clientMap.get(inv.client_id) || null,
            budget_id: inv.budget_id,
            budget: budgetMap.get(inv.budget_id) || null,
          });
        }
      }

      for (const comm of commissions) {
        const invoiceEntries = (comm.invoice_ids || [])
          .map((id: string) => invoicesDataMap.get(id))
          .filter(Boolean);
        const invoiceCodes = invoiceEntries.map((i: any) => i.code);
        const firstInv = invoiceEntries[0];
        commissionDetails[comm.id] = {
          type: comm.commission_type,
          percentage: Number(comm.commission_percentage),
          baseAmount: Number(comm.base_amount),
          amount: Number(comm.commission_amount),
          invoiceCodes,
          clientId: firstInv?.client_id || undefined,
          clientName: firstInv?.client_name || undefined,
          budgetId: firstInv?.budget_id || comm.budget_id || undefined,
          budgetCode: firstInv?.budget?.code || undefined,
          budgetTitle: firstInv?.budget?.title || undefined,
        };
      }
    }

    // Fetch liquidation invoices for the specialist's view
    const { data: invoicesData } = await supabase
      .from('liquidation_invoices')
      .select('id, file_url, file_name, invoice_number, invoice_date, subtotal, total_amount, uploaded_at')
      .eq('liquidation_id', liquidation_id)
      .order('uploaded_at', { ascending: true });

    return new Response(
      JSON.stringify({ items: enrichedItems, commissionDetails, invoices: invoicesData || [] }),
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
