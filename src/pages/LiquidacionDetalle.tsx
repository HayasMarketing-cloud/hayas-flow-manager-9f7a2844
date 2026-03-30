import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, User, Calendar, FileText, Mail, Download, Trash2, Plus, Sparkles, Users, Check, X, Award } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AddRequestsToLiquidationModal } from '@/components/liquidations/AddRequestsToLiquidationModal';
import { SpecialistInvoiceUpload } from '@/components/liquidations/SpecialistInvoiceUpload';
import { SpecialistInvoiceImportModal } from '@/components/liquidations/SpecialistInvoiceImportModal';
import { LiquidationStatusBadge } from '@/components/liquidations/LiquidationStatusBadge';
import { SignatureStatusBadge } from '@/components/liquidations/SignatureStatusBadge';
import { LiquidationProcessTimeline } from '@/components/liquidations/LiquidationProcessTimeline';
import { GroupedLiquidationItemsTable } from '@/components/liquidations/GroupedLiquidationItemsTable';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useUnliquidatedRequests } from '@/hooks/useUnliquidatedRequests';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notificationFeedback } from '@/lib/notification-feedback';
import { generateLiquidationPDF, generateLiquidationPDFBase64 } from '@/utils/pdf/liquidationPDFGenerator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useState } from 'react';
import { notifyLiquidationSent } from '@/lib/notification-utils';
import { useTeamMembers, useTeamLiquidations } from '@/hooks/useTeamMembers';

// Component for pending requests section
function PendingRequestsSection({ 
  specialistId,
  liquidationId,
  periodYear,
  periodMonth,
  onAddRequest,
  onRequestAdded,
}: { 
  specialistId: string;
  liquidationId: string;
  periodYear: number;
  periodMonth: number;
  onAddRequest: () => void;
  onRequestAdded: () => void;
}) {
  const { data: unliquidatedRequests, isLoading } = useUnliquidatedRequests(specialistId, periodYear, periodMonth);
  const [addingRequestId, setAddingRequestId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const addSingleRequest = async (request: any) => {
    if (addingRequestId) return;
    
    setAddingRequestId(request.id);
    try {
      const cost = Number(request.cost_to_agency) || 0;

      // Create liquidation item
      const { error: itemError } = await supabase
        .from('liquidation_items')
        .insert({
          liquidation_id: liquidationId,
          financial_request_id: request.id,
          description: `${request.code} - ${request.title}`,
          quantity: 1,
          unit_price: cost,
          total: cost,
        });

      if (itemError) throw itemError;

      // Update financial request
      const { error: requestError } = await supabase
        .from('financial_requests')
        .update({ liquidation_id: liquidationId })
        .eq('id', request.id);

      if (requestError) throw requestError;

      // Get current liquidation subtotal and tax_rate, then recalculate all totals
      const { data: liquidation, error: fetchError } = await supabase
        .from('liquidations')
        .select('subtotal, tax_rate')
        .eq('id', liquidationId)
        .single();

      if (fetchError) throw fetchError;

      const newSubtotal = (Number(liquidation.subtotal) || 0) + cost;
      const taxRate = liquidation.tax_rate || 0;
      const newTaxAmount = (newSubtotal * taxRate) / 100;
      const newTotal = newSubtotal + newTaxAmount;

      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ 
          subtotal: newSubtotal,
          tax_amount: newTaxAmount,
          total_amount: newTotal 
        })
        .eq('id', liquidationId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['liquidation-detail'] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      
      toast.success(`Solicitud ${request.code} añadida a la liquidación`);
      onRequestAdded();
    } catch (error: any) {
      toast.error('Error al añadir solicitud: ' + error.message);
    } finally {
      setAddingRequestId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trabajos pendientes para próxima liquidación</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!unliquidatedRequests || unliquidatedRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trabajos pendientes para próxima liquidación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            No hay trabajos pendientes para próxima liquidación
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPending = unliquidatedRequests.reduce((sum, req) => sum + (Number(req.cost_to_agency) || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Trabajos pendientes para próxima liquidación</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {unliquidatedRequests.length} trabajo(s) disponible(s) • Total: {formatCurrency(totalPending)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddRequest}>
          <Plus className="h-4 w-4 mr-2" />
          Añadir varias
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Haz clic en una fila para añadirla directamente a la liquidación
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Proyecto/Pres.</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Coste</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unliquidatedRequests.slice(0, 5).map((request) => {
              const opRequest = (request as any)?.operational_request?.[0];
              const projectOrBudget = opRequest?.operational_project ? (
                <span 
                  className="text-emerald-600 hover:underline cursor-pointer text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/operaciones/proyectos/${opRequest.operational_project.id}`, '_blank');
                  }}
                >
                  {opRequest.operational_project.name?.substring(0, 15)}{opRequest.operational_project.name?.length > 15 ? '...' : ''}
                </span>
              ) : (request as any)?.budget ? (
                <span 
                  className="text-primary hover:underline cursor-pointer text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/presupuestos/${(request as any).budget.id}`, '_blank');
                  }}
                  title={(request as any).budget.title || (request as any).budget.code}
                >
                  {((request as any).budget.title || (request as any).budget.code)?.substring(0, 35)}{((request as any).budget.title || (request as any).budget.code)?.length > 35 ? '...' : ''}
                </span>
              ) : '-';

              return (
                <TableRow 
                  key={request.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => addSingleRequest(request)}
                >
                  <TableCell className="font-mono text-sm">{request.code}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{request.title}</TableCell>
                  <TableCell>{request.client?.name || '-'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>{projectOrBudget}</TableCell>
                  <TableCell>{request.service?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                      {request.status === 'completed' ? 'Completado' : 'En progreso'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(request.cost_to_agency) || 0)}
                  </TableCell>
                  <TableCell>
                    {addingRequestId === request.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {unliquidatedRequests.length > 5 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Y {unliquidatedRequests.length - 5} trabajo(s) más...{' '}
            <button 
              onClick={onAddRequest}
              className="text-primary hover:underline"
            >
              Ver todas
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LiquidacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessFinance } = useUserRole();
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [addRequestsModalOpen, setAddRequestsModalOpen] = useState(false);
  const [importInvoiceModalOpen, setImportInvoiceModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; requestId: string | null; description: string } | null>(null);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [isAddingManualConcept, setIsAddingManualConcept] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [manualAmount, setManualAmount] = useState<string>('');
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);

  const { data: liquidation, isLoading, error } = useQuery({
    queryKey: ['liquidation-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidations')
        .select(`
          *,
          specialist:specialists(id, name, email, hourly_rate, type, user_id),
          liquidation_items(
            id,
            description,
            quantity,
            unit_price,
            total,
            financial_request:financial_requests(
              id,
              code,
              title,
              hours,
              quantity,
              cost_type,
              budget_id,
              client:clients(id, name),
              budget:budgets(id, code, title),
              operational_request:operational_requests!financial_request_id(
                id,
                operational_project:operational_projects(id, name)
              )
            )
          ),
          liquidation_signatures(
            id,
            token,
            status,
            signed_at,
            ip_address,
            dispute_reason,
            specialist_comments,
            expires_at,
            created_at
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Calcular el total correcto
      const calculatedTotal = data.liquidation_items?.reduce((sum: number, item: any) => {
        return sum + (Number(item.total) || 0);
      }, 0) || 0;

      // Ordenar firmas por fecha descendente para obtener siempre la más reciente primero
      const sortedSignatures = data.liquidation_signatures
        ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { ...data, liquidation_signatures: sortedSignatures, calculated_total: calculatedTotal };
    },
    enabled: !!id,
  });

  // Fetch team members if this specialist is a leader
  const { data: teamMembers } = useTeamMembers(liquidation?.specialist?.id);
  
  // Fetch team liquidations for the same period
  const { data: teamData } = useTeamLiquidations(
    liquidation?.specialist?.id,
    liquidation?.period_year,
    liquidation?.period_month
  );

  const hasTeam = (teamMembers?.length || 0) > 0;

  // Fetch pending commissions for this specialist
  const { data: availableCommissions } = useQuery({
    queryKey: ['specialist-commissions', liquidation?.specialist?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_commissions')
        .select('*, budget:budgets(code, title), contract:contracts(code, title)')
        .eq('seller_user_id', liquidation!.specialist!.user_id!)
        .in('status', ['pending', 'approved'])
        .is('liquidation_id', null)
        .order('created_at', { ascending: false });
      
      // For commissions with invoice_ids, fetch invoice codes (always, regardless of budget/contract)
      if (data) {
        for (const comm of data as any[]) {
          if (comm.invoice_ids?.length) {
            const { data: invoices } = await supabase
              .from('invoices')
              .select('code')
              .in('id', comm.invoice_ids);
            comm._invoice_codes = invoices?.map((i: any) => i.code) || [];
          }
        }
      }
      
      return data || [];
    },
    enabled: !!liquidation?.specialist?.user_id,
  });

  // Fetch commission details for already-assigned items
  const { data: linkedCommissionDetails } = useQuery({
    queryKey: ['linked-commission-details', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_commissions')
        .select('id, commission_type, commission_percentage, base_amount, invoice_ids, commission_amount')
        .eq('liquidation_id', id!);
      
      if (!data?.length) return {};

      // Fetch invoice codes for each commission
      const details: Record<string, { type: string; percentage: number; baseAmount: number; invoiceCodes: string[] }> = {};
      for (const comm of data) {
        let invoiceCodes: string[] = [];
        if (comm.invoice_ids?.length) {
          const { data: invoices } = await supabase
            .from('invoices')
            .select('code')
            .in('id', comm.invoice_ids as string[]);
          invoiceCodes = invoices?.map((i: any) => i.code) || [];
        }
        details[comm.id] = {
          type: comm.commission_type,
          percentage: Number(comm.commission_percentage),
          baseAmount: Number(comm.base_amount),
          invoiceCodes,
        };
      }
      return details;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;

      // Update related financial_requests
      const { error: requestsError } = await supabase
        .from('financial_requests')
        .update({ liquidation_id: null })
        .eq('liquidation_id', id);

      if (requestsError) throw requestsError;

      // Reset linked commissions before deleting liquidation items
      const { error: commissionsError } = await supabase
        .from('sales_commissions')
        .update({ liquidation_id: null, status: 'approved', paid_at: null })
        .eq('liquidation_id', id);

      if (commissionsError) throw commissionsError;

      // Delete liquidation_items
      const { error: itemsError } = await supabase
        .from('liquidation_items')
        .delete()
        .eq('liquidation_id', id);

      if (itemsError) throw itemsError;

      // Delete liquidation_signatures
      const { error: signaturesError } = await supabase
        .from('liquidation_signatures')
        .delete()
        .eq('liquidation_id', id);

      if (signaturesError) throw signaturesError;

      // Delete the liquidation
      const { error } = await supabase
        .from('liquidations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success('Liquidación eliminada correctamente');
      navigate('/liquidaciones');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async ({ itemId, requestId }: { itemId: string; requestId: string | null }) => {
      // Get the item details
      const { data: item, error: fetchError } = await supabase
        .from('liquidation_items')
        .select('total, description')
        .eq('id', itemId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the liquidation item
      const { error: deleteError } = await supabase
        .from('liquidation_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      // Update the financial_request to remove liquidation_id
      if (requestId) {
        const { error: updateError } = await supabase
          .from('financial_requests')
          .update({ liquidation_id: null })
          .eq('id', requestId);

        if (updateError) throw updateError;
      }

      // If item description starts with "Comisión", reset matching commission
      if (item.description?.startsWith('Comisión')) {
        // Find commission linked to this liquidation with matching amount
        const { data: linkedCommissions } = await (supabase
          .from('sales_commissions' as any)
          .select('id')
          .eq('liquidation_id', id)
          .eq('commission_amount', item.total) as any);
        
        if (linkedCommissions?.length) {
          // Reset only the first matching commission
          await (supabase
            .from('sales_commissions' as any)
            .update({ liquidation_id: null, status: 'approved', paid_at: null })
            .eq('id', linkedCommissions[0].id) as any);
        }
      }

      // Recalculate subtotal, tax_amount and total_amount
      const currentSubtotal = Number(liquidation?.subtotal) || 0;
      const taxRate = liquidation?.tax_rate || 0;
      const newSubtotal = currentSubtotal - (Number(item.total) || 0);
      const newTaxAmount = (newSubtotal * taxRate) / 100;
      const newTotal = newSubtotal + newTaxAmount;

      const { error: liquidationError } = await supabase
        .from('liquidations')
        .update({ 
          subtotal: newSubtotal,
          tax_amount: newTaxAmount,
          total_amount: newTotal 
        })
        .eq('id', id);

      if (liquidationError) throw liquidationError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['specialist-commissions'] });
      toast.success('Elemento eliminado de la liquidación');
      setItemToRemove(null);
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      
      // Update liquidation status
      const { error } = await supabase
        .from('liquidations')
        .update({ 
          status: 'paid', 
          paid_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;

      // Send payment notification email if specialist has email
      if (liquidation?.specialist?.email && user?.email?.endsWith('@hayas.es')) {
        try {
          const response = await supabase.functions.invoke('send-liquidation-paid-notification', {
            body: {
              liquidationId: id,
              senderEmail: user.email,
            },
          });

          if (response.error) {
            console.error('Error sending payment notification:', response.error);
            // Don't throw - the payment was still marked as paid
          }
        } catch (emailError) {
          console.error('Error invoking payment notification function:', emailError);
          // Don't throw - the payment was still marked as paid
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success('Liquidación marcada como pagada. Se ha enviado notificación al especialista.');
      setMarkPaidDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });

  const addManualConceptMutation = useMutation({
    mutationFn: async () => {
      if (!manualDescription.trim() || !manualAmount) {
        throw new Error('Debes completar concepto e importe');
      }
      
      const amount = parseFloat(manualAmount);
      if (isNaN(amount) || amount === 0) {
        throw new Error('El importe debe ser un número válido distinto de 0');
      }

      // Insert the manual item
      const { error: insertError } = await supabase
        .from('liquidation_items')
        .insert({
          liquidation_id: id,
          description: manualDescription.trim(),
          quantity: 1,
          unit_price: amount,
          total: amount,
          financial_request_id: null, // Item manual sin request
        });

      if (insertError) throw insertError;

      // Get current liquidation subtotal and update
      const { data: currentLiquidation, error: fetchError } = await supabase
        .from('liquidations')
        .select('subtotal')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const newSubtotal = (Number(currentLiquidation.subtotal) || 0) + amount;
      const taxRate = liquidation?.tax_rate || 0;
      const newTaxAmount = (newSubtotal * taxRate) / 100;
      const newTotalAmount = newSubtotal + newTaxAmount;

      const { error: updateError } = await supabase
        .from('liquidations')
        .update({
          subtotal: newSubtotal,
          tax_amount: newTaxAmount,
          total_amount: newTotalAmount,
        })
        .eq('id', id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      setManualDescription('');
      setManualAmount('');
      setIsAddingManualConcept(false);
      toast.success('Concepto añadido');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al añadir concepto');
    },
  });

  const addCommissionsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCommissionIds.length || !availableCommissions) return;

      const selected = availableCommissions.filter((c: any) => selectedCommissionIds.includes(c.id));

      // Insert each as a liquidation_item
      for (const commission of selected) {
        const typeLabel = commission.commission_type === 'am' ? 'AM' : commission.commission_type === 'pm' ? 'PM' : 'Venta';
        const invoiceCodes = (commission as any)._invoice_codes as string[] | undefined;
        let originLabel = '';
        // Prioritize invoice codes over budget/contract
        if (invoiceCodes?.length) {
          originLabel = invoiceCodes.length === 1
            ? `Factura Nº ${invoiceCodes[0]}`
            : `Facturas ${invoiceCodes.join(', ')}`;
        } else if (commission.budget) {
          originLabel = `${commission.budget.code} - ${commission.budget.title}`;
        } else if (commission.contract) {
          originLabel = `${commission.contract.code} - ${commission.contract.title}`;
        }
        const description = `Comisión ${typeLabel} (${commission.commission_percentage}%)${originLabel ? ` — ${originLabel}` : ''}`;

        const { error: insertError } = await supabase
          .from('liquidation_items')
          .insert({
            liquidation_id: id,
            description,
            quantity: 1,
            unit_price: commission.commission_amount,
            total: commission.commission_amount,
            financial_request_id: null,
          });
        if (insertError) throw insertError;

        // Mark commission as paid and link to liquidation
        const { error: updateError } = await (supabase
          .from('sales_commissions' as any)
          .update({ status: 'paid', paid_at: new Date().toISOString(), liquidation_id: id })
          .eq('id', commission.id) as any);
        if (updateError) throw updateError;
      }

      // Recalculate totals
      const totalToAdd = selected.reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);
      const { data: currentLiq, error: fetchError } = await supabase
        .from('liquidations')
        .select('subtotal, tax_rate')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const newSubtotal = (Number(currentLiq.subtotal) || 0) + totalToAdd;
      const taxRate = currentLiq.tax_rate || 0;
      const newTaxAmount = (newSubtotal * taxRate) / 100;
      const newTotal = newSubtotal + newTaxAmount;

      const { error: updateLiqError } = await supabase
        .from('liquidations')
        .update({ subtotal: newSubtotal, tax_amount: newTaxAmount, total_amount: newTotal })
        .eq('id', id);
      if (updateLiqError) throw updateLiqError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['specialist-commissions'] });
      setSelectedCommissionIds([]);
      toast.success('Comisiones añadidas a la liquidación');
    },
    onError: (error: any) => {
      toast.error('Error al añadir comisiones: ' + error.message);
    },
  });

  const handleDownloadPDF = async () => {
    if (!liquidation) return;

    try {
      await generateLiquidationPDF({
        liquidation,
        items: liquidation.liquidation_items || [],
        specialist: liquidation.specialist,
        commissionDetails: linkedCommissionDetails || undefined,
        teamData: hasTeam && teamData ? {
          members: teamData.members,
          teamTotal: teamData.teamTotal,
        } : undefined,
      });
      toast.success('PDF descargado');
    } catch (error: any) {
      toast.error('Error al generar PDF: ' + error.message);
    }
  };

  const handleSendEmail = async () => {
    if (!liquidation || !liquidation.specialist?.email) {
      toast.error('El especialista no tiene email configurado');
      return;
    }

    if (!user?.email?.endsWith('@hayas.es')) {
      toast.error('Solo usuarios con email @hayas.es pueden enviar liquidaciones');
      return;
    }

    setIsSending(true);

    try {
      const pdfBase64 = await generateLiquidationPDFBase64({
        liquidation,
        items: liquidation.liquidation_items || [],
        specialist: liquidation.specialist,
        commissionDetails: linkedCommissionDetails || undefined,
        teamData: hasTeam && teamData ? {
          members: teamData.members,
          teamTotal: teamData.teamTotal,
        } : undefined,
      });

      const { error } = await supabase.functions.invoke('send-liquidation-email', {
        body: {
          specialistName: liquidation.specialist.name,
          specialistEmail: liquidation.specialist.email,
          liquidationCode: liquidation.code,
          liquidationId: liquidation.id,
          periodMonth: liquidation.period_month,
          periodYear: liquidation.period_year,
          totalAmount: (hasTeam && teamData) 
            ? teamData.teamTotal 
            : (liquidation.calculated_total ?? liquidation.total_amount),
          pdfBase64,
          appUrl: 'https://hayas-flow-manager.lovable.app',
          senderEmail: user?.email,
        },
      });

      if (error) throw error;

      // Update liquidation status
      await supabase
        .from('liquidations')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id);

      // Send in-app notification to specialist if they have user_id
      const hasInAppNotification = !!liquidation.specialist?.user_id;
      await notifyLiquidationSent(
        liquidation.specialist?.user_id || null,
        liquidation.code,
        liquidation.id,
        liquidation.period_month,
        liquidation.period_year
      );

      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success(`Email enviado correctamente a ${liquidation.specialist.email}`);
      
      // Show notification feedback
      notificationFeedback.liquidationSent(liquidation.specialist.name, hasInAppNotification);
    } catch (error: any) {
      toast.error('Error al enviar email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Detalle de Liquidación">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (error || !liquidation) {
    return (
      <AppLayout title="Detalle de Liquidación">
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-destructive">Liquidación no encontrada</p>
            <Button variant="outline" onClick={() => navigate('/liquidaciones')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Liquidaciones
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const latestSignature = liquidation.liquidation_signatures?.[0] || null;
  const isEditable = liquidation.status === 'draft' || liquidation.status === 'validated' || liquidation.status === 'sent' || liquidation.status === 'disputed';
  const hasSpecialistEmail = !!liquidation.specialist?.email;
  const canMarkAsPaid = canAccessFinance() && liquidation.status !== 'draft' && liquidation.status !== 'paid';

  return (
    <AppLayout title={`Liquidación ${formatPeriod(liquidation.period_year, liquidation.period_month)}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/liquidaciones')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Liquidación {formatPeriod(liquidation.period_year, liquidation.period_month)}</h1>
              <p className="text-muted-foreground">{liquidation.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LiquidationStatusBadge status={liquidation.status} />
            {liquidation.status !== 'draft' && latestSignature && (
              <SignatureStatusBadge signature={latestSignature} />
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Specialist Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Especialista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{liquidation.specialist?.name || 'Sin asignar'}</p>
              {liquidation.specialist?.email && (
                <p className="text-sm text-muted-foreground">{liquidation.specialist.email}</p>
              )}
              {liquidation.specialist?.type && (
                <Badge variant="outline" className="mt-2">
                  {liquidation.specialist.type}
                </Badge>
              )}
              {hasTeam && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                    <Users className="h-4 w-4" />
                    Líder de equipo
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {teamMembers?.map(m => m.name).join(', ')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Period Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Creada</p>
                <p className="font-medium">{new Date(liquidation.created_at).toLocaleDateString('es-ES')}</p>
              </div>
              {liquidation.sent_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Enviada</p>
                  <p className="font-medium">{new Date(liquidation.sent_at).toLocaleDateString('es-ES')}</p>
                </div>
              )}
              {liquidation.paid_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Pagada</p>
                  <p className="font-medium">{new Date(liquidation.paid_at).toLocaleDateString('es-ES')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Resumen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{liquidation.liquidation_items?.length || 0}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(liquidation.calculated_total ?? liquidation.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Process Timeline */}
        <LiquidationProcessTimeline 
          liquidation={liquidation}
          signature={latestSignature}
          onResendEmail={hasSpecialistEmail && canAccessFinance() ? handleSendEmail : undefined}
          isSending={isSending}
        />

        {/* Team Summary - Only shown if specialist is a team leader */}
        {hasTeam && teamData && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Users className="h-5 w-5" />
                Resumen de Equipo - {formatPeriod(liquidation.period_year, liquidation.period_month)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Leader's liquidation */}
                <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div>
                    <p className="font-medium">{liquidation.specialist?.name}</p>
                    <p className="text-sm text-muted-foreground">Líder de equipo</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg">{formatCurrency(liquidation.calculated_total)}</p>
                    <Badge variant="outline" className="mt-1">{liquidation.code}</Badge>
                  </div>
                </div>

                {/* Team members' liquidations */}
                {teamData.members.map((memberLiq: any) => (
                  <div 
                    key={memberLiq.id} 
                    className="flex items-center justify-between p-3 bg-background rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/liquidaciones/${memberLiq.id}`)}
                  >
                    <div>
                      <p className="font-medium">{memberLiq.specialist?.name}</p>
                      <p className="text-sm text-muted-foreground">Miembro del equipo</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">{formatCurrency(memberLiq.calculated_total)}</p>
                      <Badge variant="outline" className="mt-1">{memberLiq.code}</Badge>
                    </div>
                  </div>
                ))}

                {/* Missing liquidations for team members */}
                {teamMembers?.filter(m => !teamData.members.find((liq: any) => liq.specialist_id === m.id)).map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-dashed opacity-60">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">Miembro del equipo</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground italic">Sin liquidación este período</p>
                    </div>
                  </div>
                ))}

                {/* Team Total */}
                <div className="flex items-center justify-between p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                  <div>
                    <p className="font-bold text-lg">Total Equipo</p>
                    <p className="text-sm text-muted-foreground">
                      {1 + (teamData.members?.length || 0)} liquidación(es)
                    </p>
                  </div>
                  <p className="font-bold text-2xl text-blue-700 dark:text-blue-400">
                    {formatCurrency(teamData.teamTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items Tables - Separated by Specialist when team exists */}
        {hasTeam && teamData ? (
          <>
            {/* Leader's Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Trabajos de {liquidation.specialist?.name}</CardTitle>
                  <Badge variant="outline" className="text-blue-600 border-blue-300">Líder de equipo</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {isEditable && canAccessFinance() && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setAddRequestsModalOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Añadir Solicitudes
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsAddingManualConcept(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Añadir Concepto
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Formulario inline para concepto manual */}
                {isAddingManualConcept && isEditable && canAccessFinance() && (
                  <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg mb-4">
                    <div className="flex-1">
                      <Label className="text-xs">Concepto</Label>
                      <Input
                        placeholder="Descripción del concepto"
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Importe (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        
                        placeholder="0.00"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                      />
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => addManualConceptMutation.mutate()}
                      disabled={addManualConceptMutation.isPending}
                    >
                      {addManualConceptMutation.isPending ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        setIsAddingManualConcept(false);
                        setManualDescription('');
                        setManualAmount('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {liquidation.liquidation_items && liquidation.liquidation_items.length > 0 ? (
                  <>
                    <GroupedLiquidationItemsTable
                      items={liquidation.liquidation_items}
                      isEditable={isEditable}
                      canEdit={canAccessFinance()}
                      onRemoveItem={setItemToRemove}
                      commissionDetails={linkedCommissionDetails}
                    />
                    <div className="flex justify-end mt-4 pt-4 border-t">
                      <div className="text-right">
                        <span className="text-muted-foreground mr-4">Subtotal:</span>
                        <span className="font-semibold text-lg">{formatCurrency(liquidation.calculated_total)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No hay items para este especialista</p>
                )}
              </CardContent>
            </Card>

            {/* Team Members' Items */}
            {teamData.members.map((memberLiq: any) => (
              <Card key={memberLiq.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Trabajos de {memberLiq.specialist?.name}</CardTitle>
                    <Badge variant="outline">Miembro del equipo</Badge>
                  </div>
                  <Badge variant="secondary">{memberLiq.code}</Badge>
                </CardHeader>
                <CardContent>
                  {memberLiq.liquidation_items && memberLiq.liquidation_items.length > 0 ? (
                    <>
                      <GroupedLiquidationItemsTable
                        items={memberLiq.liquidation_items}
                        isEditable={false}
                        canEdit={false}
                      />
                      <div className="flex justify-end mt-4 pt-4 border-t">
                        <div className="text-right">
                          <span className="text-muted-foreground mr-4">Subtotal:</span>
                          <span className="font-semibold text-lg">{formatCurrency(memberLiq.calculated_total)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No hay items para este especialista</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          /* Single table for non-team liquidations */
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Trabajos incluidos</CardTitle>
              {isEditable && canAccessFinance() && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAddRequestsModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Solicitudes
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsAddingManualConcept(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Concepto
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Formulario inline para concepto manual */}
              {isAddingManualConcept && isEditable && canAccessFinance() && (
                <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg mb-4">
                  <div className="flex-1">
                    <Label className="text-xs">Concepto</Label>
                    <Input
                      placeholder="Descripción del concepto"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Importe (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      
                      placeholder="0.00"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                    />
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => addManualConceptMutation.mutate()}
                    disabled={addManualConceptMutation.isPending}
                  >
                    {addManualConceptMutation.isPending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setIsAddingManualConcept(false);
                      setManualDescription('');
                      setManualAmount('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {liquidation.liquidation_items && liquidation.liquidation_items.length > 0 ? (
                <GroupedLiquidationItemsTable
                  items={liquidation.liquidation_items}
                  isEditable={isEditable}
                  canEdit={canAccessFinance()}
                  onRemoveItem={setItemToRemove}
                  commissionDetails={linkedCommissionDetails || undefined}
                />
              ) : (
                <p className="text-center text-muted-foreground py-8">No hay items en esta liquidación</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Available Commissions Section */}
        {canAccessFinance() && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4" />
                Comisiones disponibles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!availableCommissions || availableCommissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay comisiones pendientes para este especialista
                </p>
              ) : (
                <div className="space-y-3">
                  {availableCommissions.map((commission: any) => {
                    const typeLabel = commission.commission_type === 'am' ? 'AM' : commission.commission_type === 'pm' ? 'PM' : 'Venta';
                    const invoiceCodes = (commission as any)._invoice_codes as string[] | undefined;
                    let originLabel = '';
                    // Prioritize invoice codes
                    if (invoiceCodes?.length) {
                      originLabel = invoiceCodes.length === 1
                        ? `Factura Nº ${invoiceCodes[0]}`
                        : `Facturas ${invoiceCodes.join(', ')}`;
                    } else if (commission.budget) {
                      originLabel = `${commission.budget.code} - ${commission.budget.title}`;
                    } else if (commission.contract) {
                      originLabel = `${commission.contract.code} - ${commission.contract.title}`;
                    }
                    const isSelected = selectedCommissionIds.includes(commission.id);

                    return (
                      <div
                        key={commission.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedCommissionIds(prev =>
                            isSelected ? prev.filter(id => id !== commission.id) : [...prev, commission.id]
                          );
                        }}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">Comisión {typeLabel}{originLabel ? ` — ${originLabel}` : ''}</p>
                          <p className="text-xs text-muted-foreground">
                            {commission.commission_percentage}% sobre {formatCurrency(commission.base_amount)}
                          </p>
                        </div>
                        <span className="font-semibold text-sm whitespace-nowrap">
                          {formatCurrency(commission.commission_amount)}
                        </span>
                      </div>
                    );
                  })}
                  {isEditable ? (
                    selectedCommissionIds.length > 0 && (
                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          onClick={() => addCommissionsMutation.mutate()}
                          disabled={addCommissionsMutation.isPending}
                        >
                          {addCommissionsMutation.isPending ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Añadir {selectedCommissionIds.length} comisión(es)
                        </Button>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground pt-2">Solo se pueden añadir en liquidaciones en borrador o validadas</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending Requests Section */}
        {isEditable && canAccessFinance() && (
          <PendingRequestsSection
            specialistId={liquidation.specialist_id}
            liquidationId={liquidation.id}
            periodYear={liquidation.period_year}
            periodMonth={liquidation.period_month}
            onAddRequest={() => setAddRequestsModalOpen(true)}
            onRequestAdded={() => {
              queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
            }}
          />
        )}

        {/* Specialist Invoice Upload - Para todos los estados */}
        {canAccessFinance() && (
          <SpecialistInvoiceUpload
            liquidationId={liquidation.id}
            liquidationCode={liquidation.code}
            currentInvoiceUrl={liquidation.specialist_invoice_url}
            currentStatus={liquidation.status}
            liquidationSubtotal={liquidation.subtotal}
            onUploadSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
              queryClient.invalidateQueries({ queryKey: ['liquidations'] });
            }}
          />
        )}

        {/* Notes */}
        {liquidation.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{liquidation.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {canAccessFinance() && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            {isEditable && hasSpecialistEmail && (
              <Button onClick={handleSendEmail} disabled={isSending}>
                <Mail className="h-4 w-4 mr-2" />
                {isSending ? 'Enviando...' : 'Enviar por Email'}
              </Button>
            )}
            {canMarkAsPaid && (
              <Button 
                onClick={() => setMarkPaidDialogOpen(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Marcar como Pagada
              </Button>
            )}
            {isEditable && (
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar liquidación"
        description={`¿Estás seguro de que deseas eliminar la liquidación ${liquidation.code}? Esta acción no se puede deshacer.`}
        onConfirm={() => deleteMutation.mutate()}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />

      <ConfirmDialog
        open={!!itemToRemove}
        onOpenChange={(open) => !open && setItemToRemove(null)}
        title="Eliminar solicitud de la liquidación"
        description={`¿Estás seguro de que deseas eliminar "${itemToRemove?.description}" de esta liquidación? La solicitud quedará disponible para incluir en otras liquidaciones.`}
        onConfirm={() => itemToRemove && removeItemMutation.mutate({ itemId: itemToRemove.id, requestId: itemToRemove.requestId })}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />

      <ConfirmDialog
        open={markPaidDialogOpen}
        onOpenChange={setMarkPaidDialogOpen}
        title="Marcar liquidación como pagada"
        description={`¿Confirmas que la liquidación ${liquidation.code} por ${formatCurrency(liquidation.calculated_total ?? liquidation.total_amount)} ha sido pagada?`}
        onConfirm={() => markAsPaidMutation.mutate()}
        confirmText="Confirmar Pago"
        cancelText="Cancelar"
      />

      <AddRequestsToLiquidationModal
        open={addRequestsModalOpen}
        onOpenChange={setAddRequestsModalOpen}
        liquidationId={liquidation.id}
        specialistId={liquidation.specialist_id}
        periodYear={liquidation.period_year}
        periodMonth={liquidation.period_month}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
        }}
      />

      <SpecialistInvoiceImportModal
        open={importInvoiceModalOpen}
        onOpenChange={setImportInvoiceModalOpen}
        preselectedLiquidationId={liquidation.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
          queryClient.invalidateQueries({ queryKey: ['liquidations'] });
        }}
      />
    </AppLayout>
  );
}
