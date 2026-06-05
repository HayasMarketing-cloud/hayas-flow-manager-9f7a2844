import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, ExternalLink, Repeat, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  contractId: string;
  contractTitle?: string;
  clientId?: string;
  disabled?: boolean;
}

interface TemplateRow {
  id: string;
  code: string;
  title: string;
  specialist_id: string | null;
  service_id: string | null;
  hours: number | null;
  fixed_cost: number | null;
  cost_to_agency: number | null;
  sale_amount: number | null;
  recurrence_active: boolean | null;
  specialists?: { name: string } | null;
  services?: { name: string } | null;
  clones_count?: number;
}

export function ContractRecurringTemplatesSection({ contractId, disabled }: Props) {
  const [open, setOpen] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Partial<TemplateRow>>>({});
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['contract-recurring-templates', contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          id, code, title, specialist_id, service_id, hours, fixed_cost,
          cost_to_agency, sale_amount, recurrence_active,
          specialists:specialist_id ( name ),
          services:service_id ( name )
        `)
        .eq('contract_id', contractId)
        .eq('is_recurring_template', true)
        .is('template_source_id', null)
        .order('code');
      if (error) throw error;

      const ids = (data || []).map(t => t.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: clones } = await supabase
          .from('financial_requests')
          .select('template_source_id')
          .in('template_source_id', ids);
        (clones || []).forEach((c: any) => {
          counts[c.template_source_id] = (counts[c.template_source_id] || 0) + 1;
        });
      }
      return (data || []).map((t: any) => ({ ...t, clones_count: counts[t.id] || 0 })) as TemplateRow[];
    },
    enabled: !!contractId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TemplateRow> }) => {
      const { error } = await supabase.from('financial_requests').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-recurring-templates', contractId] });
      toast.success('Plantilla actualizada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const getValue = (t: TemplateRow, key: keyof TemplateRow) =>
    drafts[t.id]?.[key] !== undefined ? (drafts[t.id] as any)[key] : (t as any)[key];

  const setDraft = (id: string, key: keyof TemplateRow, value: any) => {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: value } }));
  };

  const saveRow = (t: TemplateRow) => {
    const patch = drafts[t.id];
    if (!patch || Object.keys(patch).length === 0) return;
    const cleaned: any = {};
    ['hours', 'fixed_cost', 'cost_to_agency', 'sale_amount'].forEach(k => {
      if (patch[k as keyof TemplateRow] !== undefined) {
        const v = patch[k as keyof TemplateRow];
        cleaned[k] = v === '' || v === null ? null : Number(v);
      }
    });
    if (patch.recurrence_active !== undefined) cleaned.recurrence_active = patch.recurrence_active;
    updateMutation.mutate({ id: t.id, patch: cleaned }, {
      onSuccess: () => setDrafts(prev => { const n = { ...prev }; delete n[t.id]; return n; }),
    });
  };

  const hasDraft = (id: string) => drafts[id] && Object.keys(drafts[id]).length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Repeat className="h-4 w-4 text-primary" />
              <span className="font-medium">Plantillas recurrentes</span>
              <Badge variant="secondary">{templates?.length || 0}</Badge>
              <span className="text-xs text-muted-foreground ml-2">
                Se clonan automáticamente el día 1 de cada mes
              </span>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !templates || templates.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Este contrato no tiene plantillas recurrentes.
                <br />
                Crea un Request, activa "Hacer recurrente cada mes" y vincúlalo a este contrato.
              </div>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Especialista</TableHead>
                      <TableHead className="w-24">Horas</TableHead>
                      <TableHead className="w-28">Coste fijo</TableHead>
                      <TableHead className="w-28">Coste agencia</TableHead>
                      <TableHead className="w-28">Venta</TableHead>
                      <TableHead className="w-24">Activa</TableHead>
                      <TableHead className="w-20">Clones</TableHead>
                      <TableHead className="w-32 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.code}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={t.title}>{t.title}</TableCell>
                        <TableCell className="text-sm">{t.specialists?.name || '—'}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.5"
                            className="h-8"
                            value={getValue(t, 'hours') ?? ''}
                            onChange={(e) => setDraft(t.id, 'hours', e.target.value)}
                            disabled={disabled}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8"
                            value={getValue(t, 'fixed_cost') ?? ''}
                            onChange={(e) => setDraft(t.id, 'fixed_cost', e.target.value)}
                            disabled={disabled}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8"
                            value={getValue(t, 'cost_to_agency') ?? ''}
                            onChange={(e) => setDraft(t.id, 'cost_to_agency', e.target.value)}
                            disabled={disabled}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8"
                            value={getValue(t, 'sale_amount') ?? ''}
                            onChange={(e) => setDraft(t.id, 'sale_amount', e.target.value)}
                            disabled={disabled}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!!getValue(t, 'recurrence_active')}
                            onCheckedChange={(checked) => setDraft(t.id, 'recurrence_active', checked)}
                            disabled={disabled}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.clones_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasDraft(t.id) && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2"
                                onClick={() => saveRow(t)}
                                disabled={updateMutation.isPending}
                              >
                                Guardar
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => navigate(`/requests/${t.code}`)}
                              title="Abrir request completo"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Edición inline de horas, coste, venta y recurrencia. Para cambios completos abre el request.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/solicitudes?contract_id=${contractId}&new=template`)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nueva plantilla
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
