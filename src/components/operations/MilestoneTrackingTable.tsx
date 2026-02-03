import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Target } from 'lucide-react';
import { MilestoneTrackingRow } from './MilestoneTrackingRow';
import { MilestoneWithDetails, useUpdateMilestoneStatus } from '@/hooks/useProjectMilestones';

interface MilestoneTrackingTableProps {
  milestones: MilestoneWithDetails[];
  isLoading: boolean;
  hasFilters?: boolean;
}

export function MilestoneTrackingTable({ 
  milestones, 
  isLoading,
  hasFilters = false,
}: MilestoneTrackingTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const updateStatusMutation = useUpdateMilestoneStatus();

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStatusChange = (milestoneId: string, status: string) => {
    updateStatusMutation.mutate({ milestoneId, status });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!milestones || milestones.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={hasFilters ? 'No se encontraron milestones' : 'No hay milestones'}
        description={
          hasFilters
            ? 'Intenta ajustar los filtros de búsqueda'
            : 'Los milestones aparecerán aquí cuando crees proyectos con solicitudes operativas'
        }
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Proyecto</TableHead>
            <TableHead>Milestone</TableHead>
            <TableHead>Presupuesto</TableHead>
            <TableHead>Contrato</TableHead>
            <TableHead>Especialista</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Fecha Fact.</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Tareas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {milestones.map((milestone) => (
            <MilestoneTrackingRow
              key={milestone.id}
              milestone={milestone}
              isExpanded={expandedRows.has(milestone.id)}
              onToggle={() => toggleRow(milestone.id)}
              onStatusChange={handleStatusChange}
              isUpdating={updateStatusMutation.isPending}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
