import { useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, User, Calendar } from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Target } from 'lucide-react';
import { useTrackingData } from '@/hooks/useTrackingData';
import { ProjectTrackingRow } from './ProjectTrackingRow';
import { MilestoneFilters, useUpdateMilestoneStatus } from '@/hooks/useProjectMilestones';
import { useUpdateProjectField } from '@/hooks/useOperationalProjects';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';

interface HierarchicalTrackingTableProps {
  filters?: MilestoneFilters;
  hasFilters?: boolean;
}

type SelectionItem = {
  type: 'project' | 'milestone' | 'task';
  id: string;
};

export function HierarchicalTrackingTable({ 
  filters,
  hasFilters = false,
}: HierarchicalTrackingTableProps) {
  const { projectGroups, isLoading, error, totalProjects, totalMilestones, refetch } = useTrackingData(filters);
  const updateMilestoneStatus = useUpdateMilestoneStatus();
  const updateProjectField = useUpdateProjectField();
  
  // Fetch specialists list for the dropdown
  const { data: specialists = [] } = useQuery({
    queryKey: ['specialists-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<SelectionItem[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkSpecialist, setBulkSpecialist] = useState<string>('');
  const [bulkDeadline, setBulkDeadline] = useState<string>('');

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

  const toggleSelectItem = (type: 'project' | 'milestone' | 'task', id: string) => {
    setSelectedItems(prev => {
      const exists = prev.find(item => item.type === type && item.id === id);
      if (exists) {
        return prev.filter(item => !(item.type === type && item.id === id));
      }
      return [...prev, { type, id }];
    });
  };

  const isItemSelected = (type: 'project' | 'milestone' | 'task', id: string) => {
    return selectedItems.some(item => item.type === type && item.id === id);
  };

  const clearSelection = () => {
    setSelectedItems([]);
    setBulkStatus('');
    setBulkSpecialist('');
    setBulkDeadline('');
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus && !bulkSpecialist && !bulkDeadline || selectedItems.length === 0) return;

    const projectUpdates = selectedItems.filter(i => i.type === 'project');
    const milestoneUpdates = selectedItems.filter(i => i.type === 'milestone');
    const taskUpdates = selectedItems.filter(i => i.type === 'task');

    try {
      // Update projects
      for (const item of projectUpdates) {
        if (bulkStatus) {
          await updateProjectField.mutateAsync({
            projectId: item.id,
            field: 'status',
            value: bulkStatus,
          });
        }
      }

      // Update milestones
      for (const item of milestoneUpdates) {
        const updates: any = {};
        if (bulkStatus) updates.status = bulkStatus;
        if (bulkSpecialist) updates.assignee_specialist_id = bulkSpecialist === 'none' ? null : bulkSpecialist;
        if (bulkDeadline) updates.deadline = bulkDeadline;
        
        if (Object.keys(updates).length > 0) {
          await updateMilestoneStatus.mutateAsync({
            milestoneId: item.id,
            status: updates.status || undefined,
          });
          // Handle specialist and deadline updates
          if (bulkSpecialist || bulkDeadline) {
            const { error } = await supabase
              .from('operational_requests')
              .update(updates)
              .eq('id', item.id);
            if (error) throw error;
          }
        }
      }

      // Update tasks
      for (const item of taskUpdates) {
        const updates: any = {};
        if (bulkStatus) updates.status = bulkStatus;
        if (bulkSpecialist) updates.assignee_specialist_id = bulkSpecialist === 'none' ? null : bulkSpecialist;
        if (bulkDeadline) updates.deadline = bulkDeadline;
        
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      toast.success(`${selectedItems.length} elementos actualizados`);
      clearSelection();
      refetch();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const selectAllProjects = () => {
    const allProjects: SelectionItem[] = projectGroups.map(g => ({ type: 'project' as const, id: g.project.id }));
    setSelectedItems(allProjects);
  };

  const isAllExpanded = expandedProjects.size === projectGroups.length && projectGroups.length > 0;
  const hasSelection = selectedItems.length > 0;

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
      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex flex-col gap-1 mr-4">
            <span className="text-sm font-bold">
              {selectedItems.length} seleccionado{selectedItems.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              {selectedItems.filter(i => i.type === 'project').length > 0 && (
                <span>{selectedItems.filter(i => i.type === 'project').length} proyectos</span>
              )}
              {selectedItems.filter(i => i.type === 'milestone').length > 0 && (
                <span>{selectedItems.filter(i => i.type === 'milestone').length} hitos</span>
              )}
              {selectedItems.filter(i => i.type === 'task').length > 0 && (
                <span>{selectedItems.filter(i => i.type === 'task').length} tareas</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Cambiar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En Progreso</SelectItem>
                <SelectItem value="in_review">En Revisión</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={bulkSpecialist} onValueChange={setBulkSpecialist}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <SelectValue placeholder="Asignar especialista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {specialists.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-2 py-1 bg-background border rounded-md">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={bulkDeadline}
                onChange={(e) => setBulkDeadline(e.target.value)}
                className="h-7 w-[120px] text-xs border-0 p-0 focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              onClick={handleBulkStatusUpdate}
              disabled={(!bulkStatus && !bulkSpecialist && !bulkDeadline) || updateMilestoneStatus.isPending || updateProjectField.isPending}
            >
              Aplicar Cambios
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

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
          {!hasSelection && (
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllProjects}
            >
              Seleccionar proyectos
            </Button>
          )}
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
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedItems.length > 0 && selectedItems.length === projectGroups.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selectAllProjects();
                    } else {
                      clearSelection();
                    }
                  }}
                />
              </TableHead>
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
              <ProjectTrackingRowWithCheckbox
                key={group.project.id}
                group={group}
                isExpanded={expandedProjects.has(group.project.id)}
                onToggle={() => toggleProject(group.project.id)}
                expandedMilestones={expandedMilestones}
                onToggleMilestone={toggleMilestone}
                isSelected={isItemSelected('project', group.project.id)}
                onSelectChange={() => toggleSelectItem('project', group.project.id)}
                selectedMilestoneIds={selectedItems.filter(i => i.type === 'milestone').map(i => i.id)}
                onMilestoneSelectChange={(id) => toggleSelectItem('milestone', id)}
                selectedTaskIds={selectedItems.filter(i => i.type === 'task').map(i => i.id)}
                onTaskSelectChange={(id) => toggleSelectItem('task', id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Wrapper component to add checkbox to project row
function ProjectTrackingRowWithCheckbox({
  group,
  isExpanded,
  onToggle,
  expandedMilestones,
  onToggleMilestone,
  isSelected,
  onSelectChange,
  selectedMilestoneIds,
  onMilestoneSelectChange,
  selectedTaskIds,
  onTaskSelectChange,
}: {
  group: any;
  isExpanded: boolean;
  onToggle: () => void;
  expandedMilestones: Set<string>;
  onToggleMilestone: (id: string) => void;
  isSelected: boolean;
  onSelectChange: () => void;
  selectedMilestoneIds?: string[];
  onMilestoneSelectChange?: (id: string) => void;
  selectedTaskIds?: string[];
  onTaskSelectChange?: (id: string) => void;
}) {
  return (
    <ProjectTrackingRow
      group={group}
      isExpanded={isExpanded}
      onToggle={onToggle}
      expandedMilestones={expandedMilestones}
      onToggleMilestone={onToggleMilestone}
      isSelected={isSelected}
      onSelectChange={onSelectChange}
      selectedMilestoneIds={selectedMilestoneIds}
      onMilestoneSelectChange={onMilestoneSelectChange}
      selectedTaskIds={selectedTaskIds}
      onTaskSelectChange={onTaskSelectChange}
    />
  );
}
