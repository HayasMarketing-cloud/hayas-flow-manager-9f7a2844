import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContractService {
  id: string;
  service_id: string | null;
  specialist_id: string | null;
  description: string;
  quantity: number;
  price_value: number;
  price_rule_type: string | null;
  billing_frequency: string | null;
  notes: string | null;
  project_type: string | null;
  specialist?: { hourly_rate: number | null };
  service?: { 
    id: string;
    name: string;
    template_structure: any;
  } | null;
}

interface Contract {
  id: string;
  client_id: string;
  title: string;
  code: string;
  pm_user_id: string | null;
  am_user_id: string | null;
  contract_services: ContractService[];
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { contract_id, auto_mode, work_month: overrideMonth, work_year: overrideYear } = body;

    // Determine work period
    const now = new Date();
    const workMonth = overrideMonth ?? (now.getMonth() + 1); // 1-12
    const workYear = overrideYear ?? now.getFullYear();
    const monthName = new Date(workYear, workMonth - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    console.log(`[generate-monthly-requests] Starting generation for ${monthName} (${workMonth}/${workYear})`);
    console.log(`[generate-monthly-requests] Mode: ${auto_mode ? 'AUTO' : 'MANUAL'}, contract_id: ${contract_id || 'ALL'}`);

    // Create admin client for all operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // If not auto_mode and contract_id provided, validate authorization
    if (!auto_mode && contract_id) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check user roles
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        return new Response(JSON.stringify({ error: 'Error validating permissions' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const allowedRoles = ['admin', 'finanzas', 'project_manager'];
      const hasPermission = roles?.some((r) => allowedRoles.includes(r.role));

      if (!hasPermission) {
        return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch contracts to process
    let contracts: Contract[] = [];

    if (contract_id) {
      // Single contract mode (manual trigger)
      const { data: contract, error: contractError } = await supabaseAdmin
        .from('contracts')
        .select(`
          id, client_id, title, code, pm_user_id, am_user_id, status,
          contract_services(
            id, service_id, specialist_id, description, quantity, 
            price_value, price_rule_type, billing_frequency, notes, project_type,
            specialist:specialists(hourly_rate),
            service:services(id, name, template_structure)
          )
        `)
        .eq('id', contract_id)
        .single();

      if (contractError || !contract) {
        return new Response(JSON.stringify({ error: 'Contract not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if ((contract as any).status !== 'active') {
        return new Response(JSON.stringify({ error: 'Contract must be active to generate requests' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      contracts = [contract as unknown as Contract];
    } else {
      // Auto mode: fetch all active contracts with enable_auto_requests
      const today = now.toISOString().split('T')[0];
      
      const { data: activeContracts, error: contractsError } = await supabaseAdmin
        .from('contracts')
        .select(`
          id, client_id, title, code, pm_user_id, am_user_id,
          contract_services(
            id, service_id, specialist_id, description, quantity, 
            price_value, price_rule_type, billing_frequency, notes, project_type,
            specialist:specialists(hourly_rate),
            service:services(id, name, template_structure)
          )
        `)
        .eq('status', 'active')
        .eq('enable_auto_requests', true)
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`);

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
        return new Response(JSON.stringify({ error: 'Error fetching contracts' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      contracts = (activeContracts || []) as unknown as Contract[];
      console.log(`[generate-monthly-requests] Found ${contracts.length} active contracts with auto_requests enabled`);
    }

    if (contracts.length === 0) {
      return new Response(JSON.stringify({ 
        count: 0, 
        message: 'No contracts to process',
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: GenerationResult[] = [];

    // Process each contract
    for (const contract of contracts) {
      console.log(`[generate-monthly-requests] Processing contract: ${contract.code} - ${contract.title}`);

      // Check for existing requests for this contract + month (duplicate detection)
      const { count: existingCount, error: checkError } = await supabaseAdmin
        .from('financial_requests')
        .select('id', { count: 'exact', head: true })
        .eq('contract_id', contract.id)
        .eq('work_month', workMonth)
        .eq('work_year', workYear);

      if (checkError) {
        console.error(`Error checking duplicates for ${contract.code}:`, checkError);
        results.push({
          contractId: contract.id,
          contractCode: contract.code,
          requestsCreated: 0,
          projectCreated: false,
          skipped: true,
          skipReason: 'Error checking duplicates'
        });
        continue;
      }

      if (existingCount && existingCount > 0) {
        console.log(`[generate-monthly-requests] Skipping ${contract.code}: ${existingCount} requests already exist for ${workMonth}/${workYear}`);
        results.push({
          contractId: contract.id,
          contractCode: contract.code,
          requestsCreated: 0,
          projectCreated: false,
          skipped: true,
          skipReason: `${existingCount} requests already exist for this period`
        });
        continue;
      }

      // Filter monthly services
      const monthlyServices = contract.contract_services?.filter(
        (s) => s.billing_frequency === 'monthly'
      ) || [];

      if (monthlyServices.length === 0) {
        console.log(`[generate-monthly-requests] Skipping ${contract.code}: No monthly services`);
        results.push({
          contractId: contract.id,
          contractCode: contract.code,
          requestsCreated: 0,
          projectCreated: false,
          skipped: true,
          skipReason: 'No monthly services'
        });
        continue;
      }

      // Create requests
      const requestsToInsert: Record<string, unknown>[] = [];

      for (const service of monthlyServices) {
        const qty = Number(service.quantity ?? 1);
        const saleValue = Number(service.price_value ?? 0);
        const specialistHourlyRate = Number(service.specialist?.hourly_rate ?? 0);
        const isHourly = service.price_rule_type === 'hourly';

        const hours = isHourly ? qty : null;
        const saleHours = isHourly ? qty : null;
        const fixedCost = isHourly ? null : qty * specialistHourlyRate;
        const costToAgency = isHourly ? qty * specialistHourlyRate : fixedCost;
        const unitPrice = isHourly ? null : saleValue;
        const saleAmount = isHourly ? qty * saleValue : qty * saleValue;

        requestsToInsert.push({
          client_id: contract.client_id,
          service_id: service.service_id,
          specialist_id: service.specialist_id,
          contract_id: contract.id,
          title: `${service.description} - ${monthName}`,
          description: `Generado automáticamente desde contrato. ${service.notes || ''}`,
          quantity: qty,
          hours,
          sale_hours: saleHours,
          status: 'draft',
          code: '', // Will be generated by trigger
          cost_type: isHourly ? 'hourly' : 'fixed',
          cost_rate: isHourly ? specialistHourlyRate : null,
          fixed_cost: fixedCost,
          cost_to_agency: costToAgency,
          sale_type: service.price_rule_type,
          sale_rate: isHourly ? saleValue : null,
          unit_price: unitPrice,
          sale_amount: saleAmount,
          work_month: workMonth,
          work_year: workYear,
        });
      }

      // Insert requests
      const { data: createdRequests, error: requestsError } = await supabaseAdmin
        .from('financial_requests')
        .insert(requestsToInsert)
        .select('id, code, title');

      if (requestsError) {
        console.error(`Error creating requests for ${contract.code}:`, requestsError);
        results.push({
          contractId: contract.id,
          contractCode: contract.code,
          requestsCreated: 0,
          projectCreated: false,
          skipped: true,
          skipReason: `Error creating requests: ${requestsError.message}`
        });
        continue;
      }

      console.log(`[generate-monthly-requests] Created ${createdRequests?.length || 0} requests for ${contract.code}`);

      // Create operational project
      let projectCreated = false;
      let projectId: string | undefined;

      // Get the user who should be the owner (PM or AM)
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
          console.log(`[generate-monthly-requests] Created project ${projectId} for ${contract.code}`);

          // Clone milestones and tasks from service templates
          await cloneTemplateStructures(supabaseAdmin, contract, newProject.id, monthlyServices, createdRequests || []);
        }
      } else {
        console.log(`[generate-monthly-requests] Skipping project creation for ${contract.code}: No PM or AM assigned`);
      }

      results.push({
        contractId: contract.id,
        contractCode: contract.code,
        requestsCreated: createdRequests?.length || 0,
        projectCreated,
        projectId,
        skipped: false
      });
    }

    // Summary
    const totalRequests = results.reduce((sum, r) => sum + r.requestsCreated, 0);
    const projectsCreated = results.filter(r => r.projectCreated).length;
    const skippedCount = results.filter(r => r.skipped).length;

    console.log(`[generate-monthly-requests] Completed. Requests: ${totalRequests}, Projects: ${projectsCreated}, Skipped: ${skippedCount}`);

    return new Response(
      JSON.stringify({
        count: totalRequests,
        projectsCreated,
        contractsProcessed: contracts.length,
        skipped: skippedCount,
        workPeriod: { month: workMonth, year: workYear },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating monthly requests:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Clone milestone and task structures from service templates to the new project
 */
async function cloneTemplateStructures(
  supabaseClient: any,
  contract: Contract,
  projectId: string,
  services: ContractService[],
  createdRequests: { id: string; code: string }[]
): Promise<void> {
  try {
    const createdBy = contract.pm_user_id || contract.am_user_id;

    // Iterate over ALL services (1:1 with createdRequests)
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      const correspondingRequest = createdRequests[i];
      if (!correspondingRequest) continue;

      const template = service.service?.template_structure;
      const hasTemplate = template?.milestones?.length > 0;

      if (hasTemplate) {
        // CASE A: service has template → clone milestones + tasks
        for (const milestone of template.milestones) {
          const { data: newMilestone, error: milestoneError } = await supabaseClient
            .from('operational_requests')
            .insert({
              name: milestone.name,
              client_id: contract.client_id,
              operational_project_id: projectId,
              created_by: createdBy,
              status: 'pending',
              financial_request_id: correspondingRequest.id,
              assignee_specialist_id: service.specialist_id,
              description: milestone.description || `Milestone de ${service.description}`,
            })
            .select('id')
            .single();

          if (milestoneError) {
            console.error(`Error creating milestone:`, milestoneError);
            continue;
          }

          if (milestone.tasks?.length > 0 && newMilestone) {
            const milestoneId = (newMilestone as any).id;
            const tasksToInsert = milestone.tasks.map((task: any, taskIndex: number) => ({
              name: typeof task === 'string' ? task : task.name,
              operational_request_id: milestoneId,
              order_index: taskIndex,
              status: 'pending',
              assignee_specialist_id: service.specialist_id,
            }));

            const { error: tasksError } = await supabaseClient
              .from('tasks')
              .insert(tasksToInsert);

            if (tasksError) {
              console.error(`Error creating tasks:`, tasksError);
            }
          }
        }
      } else {
        // CASE B: no template → 1 simple milestone per request
        const { error: milestoneError } = await supabaseClient
          .from('operational_requests')
          .insert({
            name: service.description,
            client_id: contract.client_id,
            operational_project_id: projectId,
            created_by: createdBy,
            status: 'pending',
            financial_request_id: correspondingRequest.id,
            assignee_specialist_id: service.specialist_id,
            description: service.notes || `Milestone generado desde request ${correspondingRequest.code}`,
          });

        if (milestoneError) {
          console.error(`Error creating simple milestone for ${correspondingRequest.code}:`, milestoneError);
        }
      }
    }

    console.log(`[generate-monthly-requests] Milestones created for ${services.length} requests`);
  } catch (error) {
    console.error('Error creating milestones:', error);
  }
}
