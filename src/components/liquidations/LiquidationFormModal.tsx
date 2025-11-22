import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { calculateTaxAmount, calculateTotalAmount, formatPeriod } from '@/lib/liquidation-utils';
import { Database } from '@/integrations/supabase/types';
import { generateLiquidationPDF } from '@/utils/pdf/liquidationPDFGenerator';
import { FileDown } from 'lucide-react';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

const liquidationSchema = z.object({
  specialist_id: z.string().min(1, 'Especialista es requerido'),
  period_year: z.number().min(2020).max(2100),
  period_month: z.number().min(1).max(12),
  status: z.enum(['draft', 'sent', 'paid', 'disputed']),
  subtotal: z.number().min(0, 'Subtotal debe ser mayor o igual a 0'),
  tax_rate: z.number().min(0).max(100),
  notes: z.string().optional(),
});

type LiquidationFormData = z.infer<typeof liquidationSchema>;

interface LiquidationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidation?: any;
  mode: 'create' | 'edit' | 'view';
}

export const LiquidationFormModal = ({ isOpen, onClose, liquidation, mode }: LiquidationFormModalProps) => {
  const queryClient = useQueryClient();
  const isViewMode = mode === 'view';
  const isEditable = mode === 'create' || (mode === 'edit' && liquidation?.status === 'draft');

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<LiquidationFormData>({
    resolver: zodResolver(liquidationSchema),
    defaultValues: {
      specialist_id: '',
      period_year: new Date().getFullYear(),
      period_month: new Date().getMonth() + 1,
      status: 'draft',
      subtotal: 0,
      tax_rate: 21,
      notes: '',
    },
  });

  const { data: specialists } = useQuery({
    queryKey: ['specialists-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const subtotal = watch('subtotal');
  const taxRate = watch('tax_rate');
  const selectedSpecialistId = watch('specialist_id');
  const selectedYear = watch('period_year');
  const selectedMonth = watch('period_month');

  const taxAmount = calculateTaxAmount(subtotal, taxRate);
  const totalAmount = calculateTotalAmount(subtotal, taxAmount);

  // Verificar si ya existe una liquidación para el mismo especialista y período
  const { data: existingLiquidation } = useQuery({
    queryKey: ['check-liquidation', selectedSpecialistId, selectedYear, selectedMonth],
    queryFn: async () => {
      if (!selectedSpecialistId || !selectedYear || !selectedMonth) return null;
      
      let query = supabase
        .from('liquidations')
        .select('id')
        .eq('specialist_id', selectedSpecialistId)
        .eq('period_year', selectedYear)
        .eq('period_month', selectedMonth);

      // Si estamos editando, excluir la liquidación actual
      if (mode === 'edit' && liquidation?.id) {
        query = query.neq('id', liquidation.id);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!selectedSpecialistId && !!selectedYear && !!selectedMonth,
  });

  useEffect(() => {
    if (liquidation && isOpen) {
      reset({
        specialist_id: liquidation.specialist_id,
        period_year: liquidation.period_year,
        period_month: liquidation.period_month,
        status: liquidation.status,
        subtotal: liquidation.subtotal,
        tax_rate: liquidation.tax_rate,
        notes: liquidation.notes || '',
      });
    } else if (!liquidation && isOpen) {
      reset({
        specialist_id: '',
        period_year: new Date().getFullYear(),
        period_month: new Date().getMonth() + 1,
        status: 'draft',
        subtotal: 0,
        tax_rate: 21,
        notes: '',
      });
    }
  }, [liquidation, isOpen, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: LiquidationFormData) => {
      const { error } = await supabase.from('liquidations').insert({
        code: '', // Se genera automáticamente por el trigger
        specialist_id: data.specialist_id,
        period_year: data.period_year,
        period_month: data.period_month,
        status: data.status,
        subtotal: data.subtotal,
        tax_rate: data.tax_rate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: data.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success('Liquidación creada exitosamente');
      onClose();
    },
    onError: (error) => {
      toast.error('Error al crear liquidación: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: LiquidationFormData) => {
      const { error } = await supabase
        .from('liquidations')
        .update({
          specialist_id: data.specialist_id,
          period_year: data.period_year,
          period_month: data.period_month,
          status: data.status,
          subtotal: data.subtotal,
          tax_rate: data.tax_rate,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: data.notes,
        })
        .eq('id', liquidation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success('Liquidación actualizada exitosamente');
      onClose();
    },
    onError: (error) => {
      toast.error('Error al actualizar liquidación: ' + error.message);
    },
  });

  // Query para cargar items de la liquidación (para PDF)
  const { data: liquidationItems } = useQuery({
    queryKey: ['liquidation-items', liquidation?.id],
    queryFn: async () => {
      if (!liquidation?.id) return [];
      
      const { data, error } = await supabase
        .from('liquidation_items')
        .select('*')
        .eq('liquidation_id', liquidation.id)
        .order('created_at');
      
      if (error) throw error;
      return data;
    },
    enabled: isViewMode && !!liquidation?.id,
  });

  const handleDownloadPDF = async () => {
    if (!liquidation || !liquidationItems) {
      toast.error('No hay datos para generar el PDF');
      return;
    }

    const specialist = specialists?.find((s) => s.id === liquidation.specialist_id);
    if (!specialist) {
      toast.error('Especialista no encontrado');
      return;
    }

    try {
      await generateLiquidationPDF({
        liquidation,
        items: liquidationItems,
        specialist,
      });
      toast.success('PDF generado correctamente');
    } catch (error: any) {
      toast.error('Error al generar PDF: ' + error.message);
    }
  };

  const onSubmit = (data: LiquidationFormData) => {
    if (existingLiquidation) {
      toast.error('Ya existe una liquidación para este especialista y período');
      return;
    }

    if (mode === 'create') {
      createMutation.mutate(data);
    } else if (mode === 'edit') {
      updateMutation.mutate(data);
    }
  };

  const getTitle = () => {
    if (mode === 'view') return 'Ver Liquidación';
    if (mode === 'edit') return 'Editar Liquidación';
    return 'Nueva Liquidación';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        {mode === 'edit' && liquidation?.status !== 'draft' && (
          <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground">
            Esta liquidación no se puede editar porque su estado no es borrador
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="specialist_id">Especialista *</Label>
            <Select
              value={watch('specialist_id')}
              onValueChange={(value) => setValue('specialist_id', value)}
              disabled={isViewMode || !isEditable}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar especialista" />
              </SelectTrigger>
              <SelectContent>
                {specialists?.map((specialist) => (
                  <SelectItem key={specialist.id} value={specialist.id}>
                    {specialist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.specialist_id && (
              <p className="text-sm text-destructive mt-1">{errors.specialist_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="period_year">Año *</Label>
              <Select
                value={watch('period_year').toString()}
                onValueChange={(value) => setValue('period_year', parseInt(value))}
                disabled={isViewMode || !isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.period_year && (
                <p className="text-sm text-destructive mt-1">{errors.period_year.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="period_month">Mes *</Label>
              <Select
                value={watch('period_month').toString()}
                onValueChange={(value) => setValue('period_month', parseInt(value))}
                disabled={isViewMode || !isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {formatPeriod(2024, month, 'long').split(' ')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.period_month && (
                <p className="text-sm text-destructive mt-1">{errors.period_month.message}</p>
              )}
            </div>
          </div>

          {existingLiquidation && mode === 'create' && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              Ya existe una liquidación para este especialista en {formatPeriod(selectedYear, selectedMonth)}
            </div>
          )}

          <div>
            <Label htmlFor="status">Estado *</Label>
            <Select
              value={watch('status')}
              onValueChange={(value) => setValue('status', value as LiquidationStatus)}
              disabled={isViewMode || !isEditable}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="sent">Enviada</SelectItem>
                <SelectItem value="paid">Pagada</SelectItem>
                <SelectItem value="disputed">En Disputa</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive mt-1">{errors.status.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="subtotal">Subtotal (€) *</Label>
              <Input
                type="number"
                step="0.01"
                {...register('subtotal', { valueAsNumber: true })}
                disabled={isViewMode || !isEditable}
              />
              {errors.subtotal && (
                <p className="text-sm text-destructive mt-1">{errors.subtotal.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tax_rate">IVA (%) *</Label>
              <Input
                type="number"
                step="0.01"
                {...register('tax_rate', { valueAsNumber: true })}
                disabled={isViewMode || !isEditable}
              />
              {errors.tax_rate && (
                <p className="text-sm text-destructive mt-1">{errors.tax_rate.message}</p>
              )}
            </div>
          </div>

          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="flex justify-between text-sm">
              <span>IVA:</span>
              <span className="font-medium">{taxAmount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total:</span>
              <span>{totalAmount.toFixed(2)} €</span>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              {...register('notes')}
              rows={3}
              disabled={isViewMode || !isEditable}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {isViewMode ? 'Cerrar' : 'Cancelar'}
            </Button>
            {isViewMode && liquidation && (
              <Button type="button" variant="outline" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            )}
            {!isViewMode && isEditable && (
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
