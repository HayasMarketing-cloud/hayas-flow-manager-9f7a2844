import { useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Target } from 'lucide-react';
import { useTrackingData } from '@/hooks/useTrackingData';
import { ProjectTrackingRow } from './ProjectTrackingRow';
import { MilestoneFilters } from '@/hooks/useProjectMilestones';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface HierarchicalTrackingTableProps {
  filters?: MilestoneFilters;
  hasFilters?: boolean;
}

export function HierarchicalTrackingTable({ 
  filters,
  hasFilters = false,
}: HierarchicalTrackingTableProps) {
  const { projectGroups, isLoading, error, totalProjects, totalMilestones, refetch } = useTrackingData(filters);
  
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleMilestone = (id: string) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProjects(new Set(projectGroups.map(g => g.project.id)));
    const allMilestoneIds = projectGroups.flatMap(g => g.milestones.map(m => m.id));
    setExpandedMilestones(new Set(allMilestoneIds));
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
    setExpandedMilestones(new Set());
  };

  const isAllExpanded = expandedProjects.size === projectGroups.length && projectGroups.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state with details and retry button
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium">Error al cargar proyectos</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            No se pudieron cargar los datos de seguimiento. Esto puede deberse a un problema de conexión o permisos.
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
        {/* Collapsible technical details for debugging */}
        <Collapsible className="w-full max-w-lg">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Ver detalles técnicos
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-32">
              {JSON.stringify({ 
                message: error.message, 
                code: (error as any).code,
                details: (error as any).details,
                hint: (error as any).hint
              }, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  if (!projectGroups || projectGroups.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={hasFilters ? 'No se encontraron proyectos' : 'No hay proyectos'}
        description={
          hasFilters
            ? 'Intenta ajustar los filtros de búsqueda'
            : 'Los proyectos aparecerán aquí cuando crees proyectos con milestones'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={isAllExpanded ? collapseAll : expandAll}
          >
            {isAllExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Colapsar todo
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Expandir todo
              </>
            )}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalProjects} proyectos · {totalMilestones} hitos
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-10"></TableHead>
              <TableHead colSpan={2}>Proyecto / Milestone / Tarea</TableHead>
              <TableHead>Cliente / Especialista</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Fecha Fact.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Progreso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectGroups.map((group) => (
              <ProjectTrackingRow
                key={group.project.id}
                group={group}
                isExpanded={expandedProjects.has(group.project.id)}
                onToggle={() => toggleProject(group.project.id)}
                expandedMilestones={expandedMilestones}
                onToggleMilestone={toggleMilestone}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
