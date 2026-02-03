import { useState, useMemo } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
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
import { useTrackingData, ProjectGroup } from '@/hooks/useTrackingData';
import { ProjectTrackingRow } from './ProjectTrackingRow';
import { MilestoneFilters } from '@/hooks/useProjectMilestones';

interface HierarchicalTrackingTableProps {
  filters?: MilestoneFilters;
  hasFilters?: boolean;
}

export function HierarchicalTrackingTable({ 
  filters,
  hasFilters = false,
}: HierarchicalTrackingTableProps) {
  const { projectGroups, isLoading, totalProjects, totalMilestones } = useTrackingData(filters);
  
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
