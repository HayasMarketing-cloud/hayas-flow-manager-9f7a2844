import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

export type ProjectsLensFilters = {
  search: string;
  clientId: string;
  specialistId: string;
  state: 'all' | 'open' | 'closed';
};

export const defaultProjectsLensFilters: ProjectsLensFilters = {
  search: '',
  clientId: 'all',
  specialistId: 'all',
  state: 'open',
};

type Props = {
  filters: ProjectsLensFilters;
  onChange: (next: ProjectsLensFilters) => void;
  clients: { id: string; name: string }[];
  specialists: { id: string; name: string }[];
  hideClient?: boolean;
};

export const ProjectsFiltersBar = ({ filters, onChange, clients, specialists, hideClient }: Props) => {
  const set = <K extends keyof ProjectsLensFilters>(k: K, v: ProjectsLensFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const dirty =
    filters.search !== '' ||
    filters.clientId !== 'all' ||
    filters.specialistId !== 'all' ||
    filters.state !== 'open';

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input
        placeholder="Buscar proyecto o request…"
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
        className="w-64"
      />

      {!hideClient && (
        <Select value={filters.clientId} onValueChange={(v) => set('clientId', v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.specialistId} onValueChange={(v) => set('specialistId', v)}>
        <SelectTrigger className="w-52"><SelectValue placeholder="Especialista" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los especialistas</SelectItem>
          {specialists.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.state} onValueChange={(v) => set('state', v as ProjectsLensFilters['state'])}>
        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Con requests vivos</SelectItem>
          <SelectItem value="closed">Todo completado</SelectItem>
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </Select>

      {dirty && (
        <Button variant="ghost" size="sm" onClick={() => onChange(defaultProjectsLensFilters)}>
          <X className="h-4 w-4 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
};
