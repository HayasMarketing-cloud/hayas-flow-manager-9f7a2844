import { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, Building2, FileText, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { MilestoneTaskGroup } from './MilestoneTaskGroup';
import { GroupedByProject } from '@/hooks/useAllTasks';

interface ProjectTaskGroupProps {
  projectGroup: GroupedByProject;
  onTaskStatusChange: (taskId: string, status: string) => void;
  isUpdating?: boolean;
}

const statusColors = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  completed: 'bg-green-500',
};

const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

export function ProjectTaskGroup({ projectGroup, onTaskStatusChange, isUpdating }: ProjectTaskGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { project, milestones } = projectGroup;

  // Calculate progress
  const totalTasks = milestones.reduce((acc, m) => acc + m.tasks.length, 0);
  const completedTasks = milestones.reduce(
    (acc, m) => acc + m.tasks.filter(t => t.status === 'completed').length,
    0
  );
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-start justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-3 rounded-t-lg">
              <div className="flex items-start gap-3 flex-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-0.5">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {project.name}
                    <Badge className={statusColors[project.status as keyof typeof statusColors] || 'bg-gray-500'}>
                      {statusLabels[project.status as keyof typeof statusLabels] || project.status}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {project.client && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {project.client.name}
                      </span>
                    )}
                    {project.contract && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {project.contract.code}
                      </span>
                    )}
                    {project.budget && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {project.budget.code}
                      </span>
                    )}
                    {project.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(project.deadline).toLocaleDateString('es-ES')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="text-right">
                  <span className="text-sm font-medium">{completedTasks}/{totalTasks} tareas</span>
                  <Progress value={progressPercent} className="w-24 h-2 mt-1" />
                </div>
                <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {milestones.map((milestoneGroup) => (
              <MilestoneTaskGroup
                key={milestoneGroup.milestone.id}
                milestoneGroup={milestoneGroup}
                onTaskStatusChange={onTaskStatusChange}
                isUpdating={isUpdating}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
