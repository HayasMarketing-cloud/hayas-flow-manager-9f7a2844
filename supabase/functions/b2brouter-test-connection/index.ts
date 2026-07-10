import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission check: admin or finanzas
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "finanzas"
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config, error: cfgErr } = await supabase
      .from("b2brouter_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (cfgErr || !config) {
      return new Response(
        JSON.stringify({ error: "B2BRouter config not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const env = config.environment as "staging" | "production";
    const apiKey = env === "production"
      ? Deno.env.get("B2BROUTER_API_KEY_PRODUCTION")
      : Deno.env.get("B2BROUTER_API_KEY_STAGING");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key not configured for ${env}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accountId = env === "production"
      ? config.account_id_production
      : config.account_id_staging;
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: `Account ID not configured for ${env}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = env === "production"
      ? "https://api.b2brouter.net"
      : "https://api-staging.b2brouter.net";

    const url = `${baseUrl}/accounts/${accountId}`;
    const started = Date.now();
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "X-B2B-API-Key": apiKey,
        "Accept": "application/json",
        "X-B2B-API-Version": config.api_version,
      },
    });

    const elapsed = Date.now() - started;
    const text = await resp.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep text */ }

    return new Response(
      JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        environment: env,
        account_id: accountId,
        api_version: config.api_version,
        url,
        elapsed_ms: elapsed,
        response: body,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
