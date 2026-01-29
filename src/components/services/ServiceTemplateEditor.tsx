import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface MilestoneTemplate {
  name: string;
  tasks: string[];
}

interface TemplateStructure {
  milestones: MilestoneTemplate[];
}

interface ServiceTemplateEditorProps {
  value: TemplateStructure | null;
  onChange: (value: TemplateStructure | null) => void;
  disabled?: boolean;
}

export function ServiceTemplateEditor({ value, onChange, disabled }: ServiceTemplateEditorProps) {
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newTaskInputs, setNewTaskInputs] = useState<Record<number, string>>({});
  const [expandedMilestones, setExpandedMilestones] = useState<Record<number, boolean>>({});

  const milestones = value?.milestones || [];

  const handleAddMilestone = () => {
    if (!newMilestoneName.trim()) return;
    const newMilestone: MilestoneTemplate = {
      name: newMilestoneName.trim(),
      tasks: [],
    };
    onChange({
      milestones: [...milestones, newMilestone],
    });
    setNewMilestoneName('');
    setExpandedMilestones({ ...expandedMilestones, [milestones.length]: true });
  };

  const handleRemoveMilestone = (index: number) => {
    onChange({
      milestones: milestones.filter((_, i) => i !== index),
    });
  };

  const handleMilestoneNameChange = (index: number, name: string) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], name };
    onChange({ milestones: updated });
  };

  const handleAddTask = (milestoneIndex: number) => {
    const taskName = newTaskInputs[milestoneIndex]?.trim();
    if (!taskName) return;
    
    const updated = [...milestones];
    updated[milestoneIndex] = {
      ...updated[milestoneIndex],
      tasks: [...updated[milestoneIndex].tasks, taskName],
    };
    onChange({ milestones: updated });
    setNewTaskInputs({ ...newTaskInputs, [milestoneIndex]: '' });
  };

  const handleRemoveTask = (milestoneIndex: number, taskIndex: number) => {
    const updated = [...milestones];
    updated[milestoneIndex] = {
      ...updated[milestoneIndex],
      tasks: updated[milestoneIndex].tasks.filter((_, i) => i !== taskIndex),
    };
    onChange({ milestones: updated });
  };

  const toggleMilestone = (index: number) => {
    setExpandedMilestones({
      ...expandedMilestones,
      [index]: !expandedMilestones[index],
    });
  };

  const clearTemplate = () => {
    onChange(null);
  };

  if (disabled) {
    return (
      <div className="space-y-4">
        {milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin plantilla operativa definida</p>
        ) : (
          milestones.map((milestone, idx) => (
            <Card key={idx}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">{milestone.name}</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="flex flex-wrap gap-1">
                  {milestone.tasks.map((task, taskIdx) => (
                    <Badge key={taskIdx} variant="outline" className="text-xs">
                      {task}
                    </Badge>
                  ))}
                  {milestone.tasks.length === 0 && (
                    <span className="text-xs text-muted-foreground">Sin tareas</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {milestones.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearTemplate} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Limpiar plantilla
          </Button>
        </div>
      )}

      {milestones.map((milestone, idx) => (
        <Collapsible
          key={idx}
          open={expandedMilestones[idx] ?? true}
          onOpenChange={() => toggleMilestone(idx)}
        >
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    {expandedMilestones[idx] ?? true ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <Input
                  value={milestone.name}
                  onChange={(e) => handleMilestoneNameChange(idx, e.target.value)}
                  className="flex-1 h-8 text-sm font-medium"
                  placeholder="Nombre del milestone"
                />
                <Badge variant="secondary" className="text-xs">
                  {milestone.tasks.length} tareas
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleRemoveMilestone(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {milestone.tasks.map((task, taskIdx) => (
                      <Badge key={taskIdx} variant="outline" className="gap-1 pr-1">
                        {task}
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(idx, taskIdx)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nueva tarea..."
                      value={newTaskInputs[idx] || ''}
                      onChange={(e) => setNewTaskInputs({ ...newTaskInputs, [idx]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTask(idx);
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddTask(idx)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      {/* Añadir nuevo milestone */}
      <div className="flex gap-2 pt-2 border-t">
        <Input
          placeholder="Nombre del nuevo milestone..."
          value={newMilestoneName}
          onChange={(e) => setNewMilestoneName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddMilestone();
            }
          }}
        />
        <Button type="button" onClick={handleAddMilestone} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Milestone
        </Button>
      </div>

      {milestones.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Añade milestones para crear una plantilla operativa que se clonará al crear proyectos desde este servicio.
        </p>
      )}
    </div>
  );
}
