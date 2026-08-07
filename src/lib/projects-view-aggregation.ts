import type { Database } from '@/integrations/supabase/types';

export type RequestStatus = Database['public']['Enums']['financial_request_status'];

/**
 * Lente "Proyectos" (F6).
 *
 * Vista de SOLO LECTURA derivada íntegramente de `financial_requests`.
 * No existe entidad "proyecto" persistida: un proyecto es la agrupación de
 * los requests que comparten origen (presupuesto o contrato).
 *
 * Jerarquía:  Origen -> Fase (`phase`) -> Request
 *
 * Reglas:
 *  - Origen: `budget_id` si existe; si no, `contract_id`; si no, grupo "Puntuales".
 *  - Avance: completados / (total - cancelados).
 *  - Semáforo: vencido y no completado -> rojo; deadline <= 7 días -> ámbar;
 *    resto -> verde; sin deadline -> neutro. Los completados/cancelados no alertan.
 *  - Todas las métricas se calculan en memoria en cada render. No hay
 *    `progress_pct` ni ningún campo derivado persistido.
 */

export type LensRequest = {
  id: string;
  code: string;
  title: string;
  status: RequestStatus;
  phase: string | null;
  deadline: string | null;
  hours: number | null;
  cost_to_agency: number | null;
  sale_amount: number | null;
  budget_id: string | null;
  contract_id: string | null;
  client_id: string | null;
  specialist_id: string | null;
  clientName: string | null;
  specialistName: string | null;
};

export type Signal = 'overdue' | 'due_soon' | 'ok' | 'none';

export type LensMetrics = {
  total: number;
  completed: number;
  cancelled: number;
  active: number;
  progress: number; // 0..1
  hours: number;
  cost: number;
  sale: number;
  overdue: number;
  dueSoon: number;
  signal: Signal;
  nextDeadline: string | null;
};

export type LensPhase = {
  key: string;
  label: string;
  requests: LensRequest[];
  metrics: LensMetrics;
  closed: boolean;
};

export type LensGroup = {
  key: string;
  kind: 'budget' | 'contract' | 'adhoc';
  title: string;
  code: string | null;
  clientId: string | null;
  clientName: string | null;
  phases: LensPhase[];
  metrics: LensMetrics;
  specialistIds: string[];
};

export const NO_PHASE_LABEL = 'Sin fase';
export const ADHOC_GROUP_KEY = 'adhoc';
export const ADHOC_GROUP_TITLE = 'Puntuales';

const DAY_MS = 86_400_000;

export function requestSignal(r: LensRequest, today = new Date()): Signal {
  if (r.status === 'completed' || r.status === 'cancelled') return 'none';
  if (!r.deadline) return 'none';
  const d = new Date(`${r.deadline}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - base.getTime()) / DAY_MS);
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'due_soon';
  return 'ok';
}

function computeMetrics(requests: LensRequest[], today = new Date()): LensMetrics {
  let completed = 0;
  let cancelled = 0;
  let hours = 0;
  let cost = 0;
  let sale = 0;
  let overdue = 0;
  let dueSoon = 0;
  let nextDeadline: string | null = null;

  for (const r of requests) {
    if (r.status === 'completed') completed++;
    if (r.status === 'cancelled') cancelled++;
    hours += Number(r.hours ?? 0);
    cost += Number(r.cost_to_agency ?? 0);
    sale += Number(r.sale_amount ?? 0);

    const sig = requestSignal(r, today);
    if (sig === 'overdue') overdue++;
    if (sig === 'due_soon') dueSoon++;

    if (
      r.deadline &&
      r.status !== 'completed' &&
      r.status !== 'cancelled' &&
      (!nextDeadline || r.deadline < nextDeadline)
    ) {
      nextDeadline = r.deadline;
    }
  }

  const total = requests.length;
  const denominator = total - cancelled;
  const progress = denominator > 0 ? completed / denominator : 0;

  const signal: Signal = overdue > 0 ? 'overdue' : dueSoon > 0 ? 'due_soon' : nextDeadline ? 'ok' : 'none';

  return {
    total,
    completed,
    cancelled,
    active: denominator - completed,
    progress,
    hours,
    cost,
    sale,
    overdue,
    dueSoon,
    signal,
    nextDeadline,
  };
}

function groupKeyFor(r: LensRequest): { key: string; kind: LensGroup['kind'] } {
  if (r.budget_id) return { key: `budget:${r.budget_id}`, kind: 'budget' };
  if (r.contract_id) return { key: `contract:${r.contract_id}`, kind: 'contract' };
  return { key: ADHOC_GROUP_KEY, kind: 'adhoc' };
}

export type OriginMeta = {
  budgets: Record<string, { title: string; code: string | null; clientId: string | null; clientName: string | null }>;
  contracts: Record<string, { title: string; code: string | null; clientId: string | null; clientName: string | null }>;
};

export function buildProjectLens(
  requests: LensRequest[],
  meta: OriginMeta,
  today = new Date(),
): LensGroup[] {
  const buckets = new Map<string, LensRequest[]>();

  for (const r of requests) {
    const { key } = groupKeyFor(r);
    const arr = buckets.get(key);
    if (arr) arr.push(r);
    else buckets.set(key, [r]);
  }

  const groups: LensGroup[] = [];

  for (const [key, rows] of buckets) {
    const kind: LensGroup['kind'] = key.startsWith('budget:')
      ? 'budget'
      : key.startsWith('contract:')
        ? 'contract'
        : 'adhoc';
    const id = key.includes(':') ? key.split(':')[1] : '';

    let title = ADHOC_GROUP_TITLE;
    let code: string | null = null;
    let clientId: string | null = null;
    let clientName: string | null = null;

    if (kind === 'budget') {
      const m = meta.budgets[id];
      title = m?.title ?? 'Presupuesto';
      code = m?.code ?? null;
      clientId = m?.clientId ?? rows[0]?.client_id ?? null;
      clientName = m?.clientName ?? rows[0]?.clientName ?? null;
    } else if (kind === 'contract') {
      const m = meta.contracts[id];
      title = m?.title ?? 'Contrato';
      code = m?.code ?? null;
      clientId = m?.clientId ?? rows[0]?.client_id ?? null;
      clientName = m?.clientName ?? rows[0]?.clientName ?? null;
    }

    // Fases
    const phaseBuckets = new Map<string, LensRequest[]>();
    for (const r of rows) {
      const label = r.phase?.trim() ? r.phase.trim() : NO_PHASE_LABEL;
      const arr = phaseBuckets.get(label);
      if (arr) arr.push(r);
      else phaseBuckets.set(label, [r]);
    }

    const phases: LensPhase[] = [...phaseBuckets.entries()]
      .map(([label, phaseRows]) => {
        const metrics = computeMetrics(phaseRows, today);
        return {
          key: `${key}::${label}`,
          label,
          requests: [...phaseRows].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')),
          metrics,
          closed: metrics.total - metrics.cancelled > 0 && metrics.completed === metrics.total - metrics.cancelled,
        };
      })
      .sort((a, b) => {
        if (a.label === NO_PHASE_LABEL) return 1;
        if (b.label === NO_PHASE_LABEL) return -1;
        return (a.metrics.nextDeadline ?? '9999').localeCompare(b.metrics.nextDeadline ?? '9999');
      });

    groups.push({
      key,
      kind,
      title,
      code,
      clientId,
      clientName,
      phases,
      metrics: computeMetrics(rows, today),
      specialistIds: [...new Set(rows.map((r) => r.specialist_id).filter(Boolean) as string[])],
    });
  }

  return groups.sort((a, b) => {
    if (a.kind === 'adhoc') return 1;
    if (b.kind === 'adhoc') return -1;
    const aOpen = a.metrics.active > 0 ? 0 : 1;
    const bOpen = b.metrics.active > 0 ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return (a.metrics.nextDeadline ?? '9999').localeCompare(b.metrics.nextDeadline ?? '9999');
  });
}
