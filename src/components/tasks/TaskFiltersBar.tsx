import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X, User } from 'lucide-react';
import { TaskFilters } from '@/hooks/useTaskFilters';

interface TaskFiltersBarProps {
  filters: TaskFilters;
  updateFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  clients: { id: string; name: string }[];
  specialists: { id: string; name: string }[];
  contracts: { id: string; title: string; code: string }[];
  budgets: { id: string; title: string; code: string }[];
  monthOptions: { value: string; label: string }[];
}

export function TaskFiltersBar({
  filters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  clients,
  specialists,
  contracts,
  budgets,
  monthOptions,
}: TaskFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Botón MIS TAREAS */}
      <Button
        variant={filters.onlyMyTasks ? 'default' : 'outline'}
        size="sm"
        onClick={() => updateFilter('onlyMyTasks', !filters.onlyMyTasks)}
        className="gap-2"
      >
        <User className="h-4 w-4" />
        MIS TAREAS
      </Button>

      <div className="h-6 w-px bg-border" />

      {/* Cliente */}
      <Select
        value={filters.clientId || 'all'}
        onValueChange={(v) => updateFilter('clientId', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los clientes</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Especialista */}
      <Select
        value={filters.specialistId || 'all'}
        onValueChange={(v) => updateFilter('specialistId', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Especialista" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los especialistas</SelectItem>
          {specialists.map((spec) => (
            <SelectItem key={spec.id} value={spec.id}>
              {spec.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Contrato */}
      <Select
        value={filters.contractId || 'all'}
        onValueChange={(v) => updateFilter('contractId', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Contrato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los contratos</SelectItem>
          {contracts.map((contract) => (
            <SelectItem key={contract.id} value={contract.id}>
              {contract.code} - {contract.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Presupuesto */}
      <Select
        value={filters.budgetId || 'all'}
        onValueChange={(v) => updateFilter('budgetId', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Presupuesto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los presupuestos</SelectItem>
          {budgets.map((budget) => (
            <SelectItem key={budget.id} value={budget.id}>
              {budget.code} - {budget.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mes */}
      <Select
        value={filters.monthYear || 'all'}
        onValueChange={(v) => updateFilter('monthYear', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los meses</SelectItem>
          {monthOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-border" />

      {/* Show completed checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="showCompleted"
          checked={filters.showCompleted}
          onCheckedChange={(checked) => updateFilter('showCompleted', !!checked)}
        />
        <Label htmlFor="showCompleted" className="text-sm cursor-pointer">
          Mostrar completadas
        </Label>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}

      {/* Active filters count */}
      {hasActiveFilters && (
        <Badge variant="secondary" className="ml-2">
          {Object.values(filters).filter(v => v !== null && v !== false).length} filtros activos
        </Badge>
      )}
    </div>
  );
}
