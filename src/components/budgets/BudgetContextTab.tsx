import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Edit, Save, X, Plus, Trash2, ExternalLink, Target, FileText, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ProposalContext {
  objectives: string[];
  scope: string;
  approach: string;
  drive_proposal_url: string;
}

interface BudgetContextTabProps {
  budgetId: string;
  proposalContext: ProposalContext | null;
  userId: string | undefined;
}

const defaultContext: ProposalContext = {
  objectives: [],
  scope: '',
  approach: '',
  drive_proposal_url: '',
};

export function BudgetContextTab({ budgetId, proposalContext, userId }: BudgetContextTabProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ProposalContext>(proposalContext || defaultContext);
  const [newObjective, setNewObjective] = useState('');

  const hasContent = proposalContext && (
    proposalContext.objectives?.length > 0 ||
    proposalContext.scope ||
    proposalContext.approach ||
    proposalContext.drive_proposal_url
  );

  const handleAddObjective = () => {
    if (!newObjective.trim()) return;
    setFormData({
      ...formData,
      objectives: [...(formData.objectives || []), newObjective.trim()],
    });
    setNewObjective('');
  };

  const handleRemoveObjective = (index: number) => {
    setFormData({
      ...formData,
      objectives: formData.objectives.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('budgets')
        .update({ proposal_context: formData as any })
        .eq('id', budgetId);

      if (error) throw error;

      // Registrar en activity_log
      if (userId) {
        await supabase.from('activity_log').insert([{
          entity_type: 'budget',
          entity_id: budgetId,
          action: 'update_proposal_context',
          changes: JSON.parse(JSON.stringify({ proposal_context: formData })),
          user_id: userId,
        }]);
      }

      queryClient.invalidateQueries({ queryKey: ['budget-detail', budgetId] });
      toast.success('Contexto de propuesta guardado');
      setIsEditing(false);
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(proposalContext || defaultContext);
    setNewObjective('');
    setIsEditing(false);
  };

  if (!hasContent && !isEditing) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium">Sin contexto de propuesta</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Añade objetivos, alcance y metodología para contextualizar este presupuesto
              </p>
            </div>
            <Button onClick={() => setIsEditing(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir Contexto
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Objetivos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Objetivos
          </CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Contexto
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Añadir objetivo..."
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObjective())}
                />
                <Button type="button" onClick={handleAddObjective} size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.objectives?.map((obj, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                    {obj}
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(idx)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {formData.objectives?.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin objetivos definidos</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {proposalContext?.objectives?.length ? (
                proposalContext.objectives.map((obj, idx) => (
                  <Badge key={idx} variant="secondary">{obj}</Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin objetivos definidos</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alcance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Alcance del Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              placeholder="Describe el alcance del proyecto, qué incluye y qué no incluye..."
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
              rows={4}
            />
          ) : (
            <p className="text-base whitespace-pre-wrap">
              {proposalContext?.scope || <span className="text-muted-foreground">Sin alcance definido</span>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Metodología */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Metodología / Enfoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              placeholder="Describe la metodología o enfoque propuesto..."
              value={formData.approach}
              onChange={(e) => setFormData({ ...formData, approach: e.target.value })}
              rows={4}
            />
          ) : (
            <p className="text-base whitespace-pre-wrap">
              {proposalContext?.approach || <span className="text-muted-foreground">Sin metodología definida</span>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Documento de propuesta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Documento de Propuesta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-2">
              <Label htmlFor="drive_url">URL del documento (Google Drive, etc.)</Label>
              <Input
                id="drive_url"
                type="url"
                placeholder="https://drive.google.com/..."
                value={formData.drive_proposal_url}
                onChange={(e) => setFormData({ ...formData, drive_proposal_url: e.target.value })}
              />
            </div>
          ) : proposalContext?.drive_proposal_url ? (
            <Button asChild variant="outline">
              <a href={proposalContext.drive_proposal_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Propuesta en Drive
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Sin documento vinculado</p>
          )}
        </CardContent>
      </Card>

      {/* Botones de acción */}
      {isEditing && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar Contexto'}
          </Button>
        </div>
      )}
    </div>
  );
}
