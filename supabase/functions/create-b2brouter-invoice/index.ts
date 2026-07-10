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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "finanzas");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId: string | undefined = body?.invoice_id;
    const dryRun: boolean = !!body?.dry_run;
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoice_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for related reads
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: config, error: cfgErr } = await admin
      .from("b2brouter_config").select("*").limit(1).maybeSingle();
    if (cfgErr || !config) {
      return new Response(JSON.stringify({ error: "B2BRouter config missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!config.enabled) {
      return new Response(JSON.stringify({ error: "Integración B2BRouter desactivada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = config.environment as "staging" | "production";
    const apiKey = env === "production"
      ? Deno.env.get("B2BROUTER_API_KEY_PRODUCTION")
      : Deno.env.get("B2BROUTER_API_KEY_STAGING");
    const accountId = env === "production"
      ? config.account_id_production : config.account_id_staging;
    if (!apiKey || !accountId) {
      return new Response(JSON.stringify({ error: `Falta API Key o Account ID para ${env}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate issuer fiscal data
    const missing: string[] = [];
    for (const f of ["issuer_name", "issuer_tax_id", "issuer_address", "issuer_postal_code", "issuer_city", "issuer_country_code"]) {
      if (!(config as any)[f]) missing.push(f);
    }
    if (missing.length) {
      return new Response(JSON.stringify({ error: `Datos fiscales del emisor incompletos: ${missing.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invErr } = await admin
      .from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Factura no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invoice.status !== "draft") {
      return new Response(JSON.stringify({ error: "Solo se pueden emitir facturas en estado Borrador" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invoice.b2brouter_invoice_id) {
      return new Response(JSON.stringify({ error: "La factura ya fue enviada a B2BRouter", b2brouter_invoice_id: invoice.b2brouter_invoice_id }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await admin
      .from("clients").select("*").eq("id", invoice.client_id).maybeSingle();
    if (!client) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const clientMissing: string[] = [];
    for (const f of ["name", "tax_id", "address", "postal_code", "city"]) {
      if (!(client as any)[f]) clientMissing.push(f);
    }
    if (clientMissing.length) {
      return new Response(JSON.stringify({ error: `Datos fiscales del cliente incompletos: ${clientMissing.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await admin
      .from("invoice_items").select("*").eq("invoice_id", invoiceId);
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "La factura no tiene líneas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taxRate = Number(invoice.tax_rate ?? 21);
    const lines = items.map((it: any) => ({
      description: it.description ?? "Servicio",
      quantity: Number(it.quantity ?? 1),
      unit_price: Number(it.unit_price ?? 0),
      tax_percent: taxRate,
      tax_category: "S", // Standard
    }));

    const baseUrl = env === "production"
      ? "https://api.b2brouter.net/v2"
      : "https://api-staging.b2brouter.net/v2";

    // Body shape based on B2BRouter v2 invoice schema (standard commercial invoice)
    const payload = {
      invoice: {
        kind: "out_invoice",
        number: invoice.code,
        issue_date: invoice.invoice_date,
        due_date: invoice.due_date ?? invoice.invoice_date,
        currency: "EUR",
        series: config.invoice_series ?? "F",
        notes: invoice.notes ?? null,
        payment_means: config.default_payment_means ?? "transfer",
        payment_iban: config.issuer_iban ?? null,
        seller: {
          name: config.issuer_name,
          tax_identifier: config.issuer_tax_id,
          address: config.issuer_address,
          postcode: config.issuer_postal_code,
          town: config.issuer_city,
          province: config.issuer_province ?? null,
          country_code: config.issuer_country_code ?? "ES",
          email: config.issuer_email ?? null,
          phone: config.issuer_phone ?? null,
        },
        buyer: {
          name: client.name,
          tax_identifier: client.tax_id,
          address: client.address,
          postcode: client.postal_code,
          town: client.city,
          country_code: client.country ?? "ES",
          email: (Array.isArray(client.billing_emails) && client.billing_emails[0]) || client.email || null,
        },
        lines_attributes: lines,
      },
    };

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, payload, url: `${baseUrl}/accounts/${accountId}/invoices` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `${baseUrl}/accounts/${accountId}/invoices`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "X-B2B-API-Key": apiKey,
        "X-B2B-API-Version": config.api_version,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }

    if (!resp.ok) {
      await admin.from("invoices").update({
        b2brouter_last_error: typeof parsed === "string" ? parsed.slice(0, 1000) : JSON.stringify(parsed).slice(0, 1000),
      }).eq("id", invoiceId);
      return new Response(JSON.stringify({ ok: false, status: resp.status, response: parsed }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteId = String(parsed?.invoice?.id ?? parsed?.id ?? "");
    const remoteStatus = parsed?.invoice?.state ?? parsed?.state ?? "draft";

    await admin.from("invoices").update({
      b2brouter_invoice_id: remoteId || null,
      b2brouter_status: remoteStatus,
      b2brouter_environment: env,
      b2brouter_sent_at: new Date().toISOString(),
      b2brouter_last_error: null,
    }).eq("id", invoiceId);

    return new Response(JSON.stringify({ ok: true, status: resp.status, b2brouter_invoice_id: remoteId, response: parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
