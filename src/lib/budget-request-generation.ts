import { supabase } from '@/integrations/supabase/client';

/**
 * Lógica compartida de generación de requests desde un presupuesto (F2).
 * Usada tanto por "Aprobar y Generar Solicitudes" como por "Generar Requests".
 */

export interface GenerationLine {
  itemId: string;
  description: string;
  serviceId: string | null;
  specialistId: string | null;
  specialistName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  hours: number | null;
  costRate: number | null;
  costToAgency: number | null;
  /** Editables en el modal de confirmación */
  phase: string | null;
  deadline: string | null;
}

export interface GenerationPlan {
  budget: any;
  lines: GenerationLine[];
  alreadyGeneratedCount: number;
  totalItems: number;
  linesWithoutService: string[];
}

export interface SpecialistSummary {
  specialistId: string | null;
  specialistName: string;
  count: number;
  hours: number;
  cost: number;
}

export async function buildBudgetGenerationPlan(budgetId: string): Promise<GenerationPlan> {
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('*, client:clients(name)')
    .eq('id', budgetId)
    .single();
  if (budgetError) throw budgetError;

  const { data: items, error: itemsError } = await supabase
    .from('budget_items')
    .select('*, specialist:specialists(id, name), service:services(id, name)')
    .eq('budget_id', budgetId)
    .order('created_at');
  if (itemsError) throw itemsError;

  const { data: existing, error: existingError } = await supabase
    .from('financial_requests')
    .select('id, budget_item_id')
    .eq('budget_id', budgetId)
    .not('budget_item_id', 'is', null);
  if (existingError) throw existingError;

  const generatedIds = new Set((existing || []).map((r: any) => r.budget_item_id));
  const pending = (items || []).filter((i: any) => !generatedIds.has(i.id));

  const specialistIds = pending
    .filter((i: any) => i.specialist_id)
    .map((i: any) => i.specialist_id);

  const ratesMap: Record<string, number> = {};
  if (specialistIds.length > 0) {
    const { data: specialists } = await supabase
      .from('specialists')
      .select('id, hourly_rate')
      .in('id', specialistIds);
    specialists?.forEach((s: any) => {
      ratesMap[s.id] = Number(s.hourly_rate) || 0;
    });
  }

  const lines: GenerationLine[] = pending.map((item: any) => {
    const rate = item.specialist_id ? ratesMap[item.specialist_id] || 0 : 0;
    const hours = Number(item.quantity) || 0;
    return {
      itemId: item.id,
      description: item.description,
      serviceId: item.service_id || null,
      specialistId: item.specialist_id || null,
      specialistName: item.specialist?.name || 'Sin especialista',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
      hours: rate > 0 ? hours : null,
      costRate: rate > 0 ? rate : null,
      costToAgency: rate > 0 ? hours * rate : null,
      phase: null,
      deadline: null,
    };
  });

  return {
    budget,
    lines,
    alreadyGeneratedCount: generatedIds.size,
    totalItems: (items || []).length,
    linesWithoutService: pending.filter((i: any) => !i.service_id).map((i: any) => i.description),
  };
}

export function summarizeBySpecialist(lines: GenerationLine[]): SpecialistSummary[] {
  const map = new Map<string, SpecialistSummary>();
  for (const line of lines) {
    const key = line.specialistId || '__none__';
    const current = map.get(key) || {
      specialistId: line.specialistId,
      specialistName: line.specialistName,
      count: 0,
      hours: 0,
      cost: 0,
    };
    current.count += 1;
    current.hours += line.hours || 0;
    current.cost += line.costToAgency || 0;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => a.specialistName.localeCompare(b.specialistName));
}

export async function insertBudgetRequests(budget: any, lines: GenerationLine[]): Promise<number> {
  if (lines.length === 0) return 0;

  const payload = lines.map((line) => ({
    title: line.description,
    description: `Generado automáticamente desde presupuesto: ${budget.title}`,
    client_id: budget.client_id,
    client_contact_id: budget.client_contact_id || null,
    service_id: line.serviceId,
    specialist_id: line.specialistId,
    budget_id: budget.id,
    budget_item_id: line.itemId,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    sale_amount: line.total,
    status: 'pending_specialist' as const,
    code: '',
    cost_type: line.costRate ? ('hourly' as const) : null,
    hours: line.hours,
    cost_rate: line.costRate,
    cost_to_agency: line.costToAgency,
    phase: line.phase || null,
    deadline: line.deadline || null,
  }));

  const { error } = await supabase.from('financial_requests').insert(payload as any);
  if (error) throw error;
  return payload.length;
}
