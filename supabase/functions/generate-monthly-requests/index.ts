import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Template {
  id: string;
  client_id: string;
  contract_id: string;
  service_id: string | null;
  specialist_id: string | null;
  title: string;
  description: string | null;
  quantity: number | null;
  hours: number | null;
  sale_hours: number | null;
  cost_type: string | null;
  cost_rate: number | null;
  fixed_cost: number | null;
  cost_to_agency: number | null;
  sale_type: string | null;
  sale_rate: number | null;
  unit_price: number | null;
  sale_amount: number | null;
  bill_separately: boolean;
  notes?: string | null;
  service?: {
    id: string;
    name: string;
    template_structure: any;
  } | null;
  contract?: {
    id: string;
    code: string;
    title: string;
    status: string;
    client_id: string;
    pm_user_id: string | null;
    am_user_id: string | null;
  } | null;
}

interface GenerationResult {
  contractId: string;
  contractCode: string;
  requestsCreated: number;
  projectCreated: boolean;
  projectId?: string;
  skipped: boolean;
  skipReason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { contract_id, auto_mode, work_month: overrideMonth, work_year: overrideYear } = body;

    const now = new Date();
    const workMonth = overrideMonth ?? (now.getMonth() + 1);
    const workYear = overrideYear ?? now.getFullYear();
    const monthName = new Date(workYear, workMonth - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    console.log(`[generate-monthly-requests] ${monthName} | mode=${auto_mode ? 'AUTO' : 'MANUAL'} | contract=${contract_id || 'ALL'}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Manual mode: validate caller permissions
    if (!auto_mode && contract_id) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const token = authHeader.replace('Bearer ', '');
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: roles } = await supabaseAdmin
        .from('user_roles').select('role').eq('user_id', user.id);
      const allowed = ['admin', 'finanzas', 'project_manager'];
      if (!roles?.some((r) => allowed.includes(r.role))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch templates: financial_requests with is_recurring_template=true AND recurrence_active=true
    let query = supabaseAdmin
      .from('financial_requests')
      .select(`
        id, client_id, contract_id, service_id, specialist_id, title, description,
        quantity, hours, sale_hours, cost_type, cost_rate, fixed_cost, cost_to_agency,
        sale_type, sale_rate, unit_price, sale_amount, bill_separately,
        service:services(id, name, template_structure),
        contract:contracts!inner(id, code, title, status, client_id, pm_user_id, am_user_id)
      `)
      .eq('is_recurring_template', true)
      .eq('recurrence_active', true)
      .eq('contract.status', 'active');

    if (contract_id) {
      query = query.eq('contract_id', contract_id);
    }

    const { data: templatesRaw, error: templatesError } = await query;
    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return new Response(JSON.stringify({ error: 'Error fetching templates' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templates = (templatesRaw || []) as unknown as Template[];
    // Filter out any with null contract (safety net)
    const validTemplates = templates.filter((t) => t.contract && t.contract.status === 'active');

    console.log(`[generate-monthly-requests] Found ${validTemplates.length} active templates`);

    if (validTemplates.length === 0) {
      return new Response(JSON.stringify({
        count: 0,
        message: 'No active templates to process',
        results: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Group by contract for project creation
    const byContract = new Map<string, Template[]>();
    for (const t of validTemplates) {
      if (!byContract.has(t.contract_id)) byContract.set(t.contract_id, []);
      byContract.get(t.contract_id)!.push(t);
    }

    const results: GenerationResult[] = [];

    for (const [contractId, contractTemplates] of byContract.entries()) {
      const contract = contractTemplates[0].contract!;
      console.log(`[generate-monthly-requests] Processing ${contract.code} with ${contractTemplates.length} templates`);

      // Duplicate guard: check templates already cloned this period
      const templateIds = contractTemplates.map((t) => t.id);
      const { data: alreadyCloned } = await supabaseAdmin
        .from('financial_requests')
        .select('template_source_id')
        .in('template_source_id', templateIds)
        .eq('work_month', workMonth)
        .eq('work_year', workYear);

      const clonedSet = new Set((alreadyCloned || []).map((r: any) => r.template_source_id));
      const toClone = contractTemplates.filter((t) => !clonedSet.has(t.id));

      if (toClone.length === 0) {
        results.push({
          contractId, contractCode: contract.code, requestsCreated: 0,
          projectCreated: false, skipped: true,
          skipReason: `All ${contractTemplates.length} templates already cloned for ${workMonth}/${workYear}`,
        });
        continue;
      }

      // Clone templates → draft requests for the target month
      const requestsToInsert = toClone.map((t) => ({
        client_id: t.client_id,
        contract_id: t.contract_id,
        service_id: t.service_id,
        specialist_id: t.specialist_id,
        title: `${t.title} - ${monthName}`,
        description: t.description,
        quantity: t.quantity ?? 1,
        hours: t.hours,
        sale_hours: t.sale_hours,
        cost_type: t.cost_type,
        cost_rate: t.cost_rate,
        fixed_cost: t.fixed_cost,
        cost_to_agency: t.cost_to_agency,
        sale_type: t.sale_type,
        sale_rate: t.sale_rate,
        unit_price: t.unit_price,
        sale_amount: t.sale_amount,
        bill_separately: t.bill_separately,
        status: 'draft',
        code: '',
        work_month: workMonth,
        work_year: workYear,
        template_source_id: t.id,
        is_recurring_template: false,
        recurrence_active: true,
      }));

      const { data: createdRequests, error: insertError } = await supabaseAdmin
        .from('financial_requests')
        .insert(requestsToInsert)
        .select('id, code, title, specialist_id, service_id, template_source_id');

      if (insertError) {
        console.error(`Error inserting requests for ${contract.code}:`, insertError);
        results.push({
          contractId, contractCode: contract.code, requestsCreated: 0,
          projectCreated: false, skipped: true,
          skipReason: `Insert error: ${insertError.message}`,
        });
        continue;
      }

      console.log(`[generate-monthly-requests] Created ${createdRequests?.length || 0} requests for ${contract.code}`);

      // Create operational project
      let projectCreated = false;
      let projectId: string | undefined;
      const ownerUserId = contract.pm_user_id || contract.am_user_id;

      if (ownerUserId) {
        const projectName = `${contract.title} - ${monthName}`;
        const { data: newProject, error: projectError } = await supabaseAdmin
          .from('operational_projects')
          .insert({
            name: projectName,
            client_id: contract.client_id,
            contract_id: contract.id,
            owner_user_id: ownerUserId,
            created_by: ownerUserId,
            status: 'pending',
            work_month: workMonth,
            work_year: workYear,
          })
          .select('id')
          .single();

        if (projectError) {
          console.error(`Error creating project for ${contract.code}:`, projectError);
        } else if (newProject) {
          projectCreated = true;
          projectId = newProject.id;
          await cloneMilestones(
            supabaseAdmin, contract, newProject.id,
            toClone, createdRequests || [],
            workMonth, workYear, ownerUserId
          );
        }
      } else {
        console.log(`[generate-monthly-requests] No owner for ${contract.code}, skipping project`);
      }

      results.push({
        contractId, contractCode: contract.code,
        requestsCreated: createdRequests?.length || 0,
        projectCreated, projectId, skipped: false,
      });
    }

    const totalRequests = results.reduce((s, r) => s + r.requestsCreated, 0);
    const projectsCreated = results.filter((r) => r.projectCreated).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    console.log(`[generate-monthly-requests] Done. requests=${totalRequests} projects=${projectsCreated} skipped=${skippedCount}`);

    return new Response(JSON.stringify({
      count: totalRequests,
      projectsCreated,
      contractsProcessed: byContract.size,
      skipped: skippedCount,
      workPeriod: { month: workMonth, year: workYear },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in generate-monthly-requests:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function cloneMilestones(
  supabaseClient: any,
  contract: { id: string; client_id: string },
  projectId: string,
  templates: Template[],
  createdRequests: { id: string; code: string; title: string; template_source_id: string }[],
  workMonth: number,
  workYear: number,
  createdBy: string
): Promise<void> {
  try {
    const milestoneDeadline = new Date(workYear, workMonth, 0).toISOString().split('T')[0];

    // Map template_source_id -> created request
    const reqByTemplate = new Map(createdRequests.map((r) => [r.template_source_id, r]));

    for (const template of templates) {
      const correspondingRequest = reqByTemplate.get(template.id);
      if (!correspondingRequest) continue;

      const tmplStructure = template.service?.template_structure;
      const hasTemplate = tmplStructure?.milestones?.length > 0;

      if (hasTemplate) {
        for (const milestone of tmplStructure.milestones) {
          const { data: newMilestone, error: msErr } = await supabaseClient
            .from('operational_requests')
            .insert({
              name: `${milestone.name} - ${correspondingRequest.code}`,
              client_id: contract.client_id,
              operational_project_id: projectId,
              created_by: createdBy,
              status: 'pending',
              financial_request_id: correspondingRequest.id,
              assignee_specialist_id: template.specialist_id,
              description: milestone.description || `Milestone de ${template.title}`,
              deadline: milestoneDeadline,
            })
            .select('id')
            .single();

          if (msErr) {
            console.error('Error creating milestone:', msErr);
            continue;
          }

          if (milestone.tasks?.length > 0 && newMilestone) {
            const tasksToInsert = milestone.tasks.map((task: any, idx: number) => ({
              name: typeof task === 'string' ? task : task.name,
              operational_request_id: newMilestone.id,
              order_index: idx,
              status: 'pending',
              assignee_specialist_id: template.specialist_id,
              deadline: milestoneDeadline,
            }));
            const { error: tasksErr } = await supabaseClient.from('tasks').insert(tasksToInsert);
            if (tasksErr) console.error('Error creating tasks:', tasksErr);
          }
        }
      } else {
        const { error: msErr } = await supabaseClient
          .from('operational_requests')
          .insert({
            name: correspondingRequest.title,
            client_id: contract.client_id,
            operational_project_id: projectId,
            created_by: createdBy,
            status: 'pending',
            financial_request_id: correspondingRequest.id,
            assignee_specialist_id: template.specialist_id,
            description: template.notes || `Milestone generado desde plantilla recurrente`,
            deadline: milestoneDeadline,
          });
        if (msErr) console.error('Error creating simple milestone:', msErr);
      }
    }
  } catch (error) {
    console.error('Error in cloneMilestones:', error);
  }
}
