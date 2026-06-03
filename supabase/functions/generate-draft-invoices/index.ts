import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface RequestBody {
  year: number;
  month: number; // 1-12
  dry_run?: boolean;
}

interface PreviewInvoice {
  type: "contract" | "budget";
  client_name: string;
  source_code: string; // contract or budget code
  source_title: string;
  amount: number;
  lines: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  milestone_label?: string;
  milestone_index?: number;
  notes?: string;
  request_count?: number;
}

interface Warning {
  level: "warn" | "info";
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated and is admin/finanzas
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleNames = (roles ?? []).map((r: any) => r.role);
    if (!roleNames.includes("admin") && !roleNames.includes("finanzas")) {
      return new Response(JSON.stringify({ error: "Forbidden: requires admin or finanzas role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const year = Number(body.year);
    const month = Number(body.month);
    const dryRun = Boolean(body.dry_run);

    if (!year || !month || month < 1 || month > 12) {
      return new Response(JSON.stringify({ error: "Invalid year/month" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthLabel = `${MONTHS_ES[month - 1]} ${year}`;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const preview: PreviewInvoice[] = [];
    const warnings: Warning[] = [];
    const createdInvoiceIds: string[] = [];

    // ───────────────────────────────────────────────
    // A) CONTRACTS — 1 invoice per active contract with completed requests
    // ───────────────────────────────────────────────
    const { data: activeContracts, error: contractsErr } = await admin
      .from("contracts")
      .select("id, code, title, client_id, detail_sheet_url, client:clients(id, name)")
      .eq("status", "active");
    if (contractsErr) throw contractsErr;

    for (const contract of activeContracts ?? []) {
      // requests of this contract, completed, in target month, not yet billed
      const { data: requests, error: reqErr } = await admin
        .from("financial_requests")
        .select("id, code, title, hours, sale_amount, work_year, work_month, deadline")
        .eq("contract_id", contract.id)
        .eq("status", "completed")
        .is("billed_invoice_id", null)
        .or(
          `and(work_year.eq.${year},work_month.eq.${month}),and(work_year.is.null,deadline.gte.${startDate},deadline.lte.${endDate})`,
        );
      if (reqErr) throw reqErr;
      if (!requests || requests.length === 0) continue;

      const totalHours = requests.reduce((s: number, r: any) => s + (Number(r.hours) || 0), 0);
      const totalAmount = requests.reduce(
        (s: number, r: any) => s + (Number(r.sale_amount) || 0),
        0,
      );
      if (totalAmount <= 0) {
        warnings.push({
          level: "warn",
          message: `Contrato ${contract.code} (${(contract as any).client?.name}): ${requests.length} requests sin importe → omitido`,
        });
        continue;
      }

      const hoursLabel = totalHours > 0 ? ` (${totalHours}h)` : "";
      const lineDescription = `${contract.title} - ${monthLabel}${hoursLabel}`;
      const notes = contract.detail_sheet_url
        ? `Detalle de requests: ${contract.detail_sheet_url}`
        : `(Falta enlace al Google Sheet de detalle del contrato ${contract.code})`;

      if (!contract.detail_sheet_url) {
        warnings.push({
          level: "warn",
          message: `Contrato ${contract.code}: falta detail_sheet_url`,
        });
      }

      preview.push({
        type: "contract",
        client_name: (contract as any).client?.name ?? "",
        source_code: contract.code,
        source_title: contract.title,
        amount: totalAmount,
        lines: [{ description: lineDescription, quantity: 1, unit_price: totalAmount, total: totalAmount }],
        notes,
        request_count: requests.length,
      });

      if (!dryRun) {
        const subtotal = totalAmount;
        const taxRate = 21;
        const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
        const total = +(subtotal + taxAmount).toFixed(2);

        const { data: invoice, error: invErr } = await admin
          .from("invoices")
          .insert({
            client_id: contract.client_id,
            contract_id: contract.id,
            invoice_date: endDate,
            status: "draft",
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: total,
            billing_period_month: month,
            billing_period_year: year,
            notes,
          })
          .select("id")
          .single();
        if (invErr) throw invErr;

        const { error: itemErr } = await admin.from("invoice_items").insert({
          invoice_id: invoice.id,
          description: lineDescription,
          quantity: 1,
          unit_price: subtotal,
          total: subtotal,
          aggregated_request_ids: requests.map((r: any) => r.id),
        });
        if (itemErr) throw itemErr;

        const { error: linkErr } = await admin
          .from("financial_requests")
          .update({ billed_invoice_id: invoice.id })
          .in("id", requests.map((r: any) => r.id));
        if (linkErr) throw linkErr;

        createdInvoiceIds.push(invoice.id);
      }
    }

    // ───────────────────────────────────────────────
    // B) BUDGETS — payment_plan milestones OR estimated_invoice_date
    // ───────────────────────────────────────────────
    const { data: budgets, error: budgetsErr } = await admin
      .from("budgets")
      .select(
        "id, code, title, client_id, total_amount, status, payment_plan, estimated_invoice_date, client_po_number, client:clients(id, name)",
      )
      .in("status", ["approved", "invoiced"]);
    if (budgetsErr) throw budgetsErr;

    for (const budget of budgets ?? []) {
      // Build milestones list
      type Milestone = { index: number; label: string; percentage: number; invoice_date: string };
      let milestones: Milestone[] = [];

      const plan = (budget as any).payment_plan;
      if (Array.isArray(plan) && plan.length > 0) {
        milestones = plan.map((m: any, i: number) => ({
          index: i,
          label: m.label ?? `Hito ${i + 1}`,
          percentage: Number(m.percentage) || 0,
          invoice_date: m.invoice_date,
        }));
      } else if (budget.estimated_invoice_date) {
        milestones = [{
          index: 0,
          label: "Total",
          percentage: 100,
          invoice_date: budget.estimated_invoice_date,
        }];
      } else {
        continue;
      }

      // Filter milestones falling in target month
      const targetMilestones = milestones.filter((m) => {
        if (!m.invoice_date) return false;
        const d = new Date(m.invoice_date);
        return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
      });
      if (targetMilestones.length === 0) continue;

      // Check existing invoices for these milestone indices
      const { data: existing } = await admin
        .from("invoices")
        .select("source_milestone_index")
        .eq("budget_id", budget.id)
        .not("source_milestone_index", "is", null);
      const existingIdx = new Set((existing ?? []).map((x: any) => x.source_milestone_index));

      for (const m of targetMilestones) {
        if (existingIdx.has(m.index)) continue;

        const baseTotal = Number(budget.total_amount) || 0;
        const amount = +(baseTotal * (m.percentage / 100)).toFixed(2);
        if (amount <= 0) {
          warnings.push({
            level: "warn",
            message: `Presupuesto ${budget.code}: hito "${m.label}" con importe 0 → omitido`,
          });
          continue;
        }

        if (!budget.client_po_number || budget.client_po_number === "Pendiente") {
          warnings.push({
            level: "warn",
            message: `Presupuesto ${budget.code} (${(budget as any).client?.name}): sin PO Number`,
          });
        }

        const lineDescription = `${budget.title} — ${m.label}`;
        preview.push({
          type: "budget",
          client_name: (budget as any).client?.name ?? "",
          source_code: budget.code,
          source_title: budget.title,
          amount,
          lines: [{ description: lineDescription, quantity: 1, unit_price: amount, total: amount }],
          milestone_label: m.label,
          milestone_index: m.index,
        });

        if (!dryRun) {
          const subtotal = amount;
          const taxRate = 21;
          const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
          const total = +(subtotal + taxAmount).toFixed(2);

          const { data: invoice, error: invErr } = await admin
            .from("invoices")
            .insert({
              client_id: budget.client_id,
              budget_id: budget.id,
              source_milestone_index: m.index,
              invoice_date: m.invoice_date,
              status: "draft",
              subtotal,
              tax_rate: taxRate,
              tax_amount: taxAmount,
              total_amount: total,
            })
            .select("id")
            .single();
          if (invErr) throw invErr;

          const { error: itemErr } = await admin.from("invoice_items").insert({
            invoice_id: invoice.id,
            description: lineDescription,
            quantity: 1,
            unit_price: subtotal,
            total: subtotal,
          });
          if (itemErr) throw itemErr;

          createdInvoiceIds.push(invoice.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        dry_run: dryRun,
        year,
        month,
        month_label: monthLabel,
        preview,
        warnings,
        created_count: createdInvoiceIds.length,
        created_invoice_ids: createdInvoiceIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("generate-draft-invoices error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
