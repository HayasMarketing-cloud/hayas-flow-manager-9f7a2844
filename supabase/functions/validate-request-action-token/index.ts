import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token requerido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate token format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return new Response(
        JSON.stringify({ error: "Formato de token inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch token data with request details
    const { data: tokenData, error: tokenError } = await supabase
      .from('request_action_tokens')
      .select(`
        *,
        request:financial_requests(
          id,
          code,
          title,
          description,
          deadline,
          status,
          cost_to_agency,
          sale_amount,
          client:clients(id, name),
          service:services(id, name),
          specialist:specialists(id, name, email)
        ),
        specialist:specialists(id, name, email)
      `)
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token not found:", tokenError);
      return new Response(
        JSON.stringify({ error: "Token no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          error: "Token expirado",
          expired: true,
          expires_at: tokenData.expires_at
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already used
    if (tokenData.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          error: "Este enlace ya ha sido utilizado",
          already_used: true,
          status: tokenData.status,
          acted_at: tokenData.acted_at
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Batch token: return the list of requests in the batch
    if (tokenData.action_type === 'specialist_batch_response') {
      const { data: items } = await supabase
        .from('request_action_token_items')
        .select(`
          request_id,
          request:financial_requests(
            id, code, title, phase, hours, deadline, status, specialist_id,
            cost_to_agency,
            client:clients(id, name),
            budget:budgets(id, title),
            service:services(id, name)
          )
        `)
        .eq('token_id', tokenData.id);

      const requests = (items || []).map((i: any) => i.request).filter(Boolean);

      return new Response(
        JSON.stringify({
          id: tokenData.id,
          token: tokenData.token,
          action_type: tokenData.action_type,
          status: tokenData.status,
          expires_at: tokenData.expires_at,
          is_batch: true,
          specialist: tokenData.specialist,
          requests,
          totals: {
            count: requests.length,
            hours: requests.reduce((s: number, r: any) => s + (Number(r.hours) || 0), 0),
            cost: requests.reduce((s: number, r: any) => s + (Number(r.cost_to_agency) || 0), 0),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Return token and request data
    return new Response(
      JSON.stringify({
        id: tokenData.id,
        token: tokenData.token,
        action_type: tokenData.action_type,
        status: tokenData.status,
        expires_at: tokenData.expires_at,
        is_batch: false,
        request: tokenData.request
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error validating token:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
