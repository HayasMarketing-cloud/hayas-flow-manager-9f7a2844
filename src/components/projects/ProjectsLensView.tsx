import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Briefcase } from 'lucide-react';
import { useProjectsLens } from '@/hooks/useProjectsLens';
import { ProjectGroupCard } from './ProjectGroupCard';
import {
  ProjectsFiltersBar,
  defaultProjectsLensFilters,
  type ProjectsLensFilters,
} from './ProjectsFiltersBar';
import { buildProjectLens, type LensRequest, type OriginMeta } from '@/lib/projects-view-aggregation';

/**
 * Lente de proyectos reutilizable (F6). Solo lectura.
 * Se usa en la página /proyectos y en la pestaña Proyectos de la ficha de cliente.
 */
export const ProjectsLensView = ({ clientId }: { clientId?: string }) => {
  const { data, isLoading } = useProjectsLens({ clientId });
  const [filters, setFilters] = useState<ProjectsLensFilters>(defaultProjectsLensFilters);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    (data?.requests ?? []).forEach((r) => {
      if (r.client_id && r.clientName) map.set(r.client_id, r.clientName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const specialists = useMemo(() => {
    const map = new Map<string, string>();
    (data?.requests ?? []).forEach((r) => {
      if (r.specialist_id && r.specialistName) map.set(r.specialist_id, r.specialistName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const groups = useMemo(() => {
    if (!data) return [];

    // Filtros de request → se reagrupa para que las métricas reflejen el filtro
    const term = filters.search.trim().toLowerCase();
    let rows: LensRequest[] = data.requests;

    if (filters.clientId !== 'all') rows = rows.filter((r) => r.client_id === filters.clientId);
    if (filters.specialistId !== 'all') rows = rows.filter((r) => r.specialist_id === filters.specialistId);

    const meta: OriginMeta = { budgets: {}, contracts: {} };
    data.groups.forEach((g) => {
      const id = g.key.split(':')[1];
      if (g.kind === 'budget') meta.budgets[id] = { title: g.title, code: g.code, clientId: g.clientId, clientName: g.clientName };
      if (g.kind === 'contract') meta.contracts[id] = { title: g.title, code: g.code, clientId: g.clientId, clientName: g.clientName };
    });

    let result = buildProjectLens(rows, meta);

    if (term) {
      result = result.filter(
        (g) =>
          g.title.toLowerCase().includes(term) ||
          (g.code ?? '').toLowerCase().includes(term) ||
          (g.clientName ?? '').toLowerCase().includes(term) ||
          g.phases.some((p) =>
            p.requests.some(
              (r) => r.title.toLowerCase().includes(term) || r.code.toLowerCase().includes(term),
            ),
          ),
      );
    }

    if (filters.state === 'open') result = result.filter((g) => g.metrics.active > 0);
    if (filters.state === 'closed') result = result.filter((g) => g.metrics.active === 0);

    return result;
  }, [data, filters]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProjectsFiltersBar
        filters={filters}
        onChange={setFilters}
        clients={clients}
        specialists={specialists}
        hideClient={!!clientId}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Sin proyectos que mostrar"
          description="No hay requests que cumplan los filtros seleccionados."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <ProjectGroupCard key={g.key} group={g} defaultOpen={groups.length === 1} />
          ))}
        </div>
      )}
    </div>
  );
};
