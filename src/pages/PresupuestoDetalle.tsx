import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Copy, FileText } from 'lucide-react';
import { useBudgetDetail } from '@/hooks/useBudgetDetail';
import { BudgetStatusBadge } from '@/components/budgets/BudgetStatusBadge';
import { formatCurrency } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function PresupuestoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useBudgetDetail(id);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const duplicateMutation = useMutation({
    mutationFn: async (budget: any) => {
      const { data: newBudget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          title: `${budget.title} (Copia)`,
          client_id: budget.client_id,
          description: budget.description,
          valid_until: budget.valid_until,
          total_amount: budget.total_amount,
          status: 'pending',
          created_by: user?.id,
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      const { data: items, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          budget_id: newBudget.id,
          service_id: item.service_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          notes: item.notes,
        }));

        const { error: insertError } = await supabase
          .from('budget_items')
          .insert(itemsToInsert);

        if (insertError) throw insertError;
      }

      return newBudget;
    },
    onSuccess: (newBudget) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Presupuesto duplicado correctamente');
      navigate(`/presupuestos/${newBudget.id}`);
    },
    onError: (error: any) => {
      toast.error('Error al duplicar presupuesto: ' + error.message);
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Cargando..." description="">
        <div className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout title="Error" description="No se pudo cargar el presupuesto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Presupuesto no encontrado</p>
          <Button onClick={() => navigate('/presupuestos')} className="mt-4">
            Volver a Presupuestos
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { budget, items, requests, projects } = data;

  // Agrupar items por categoría
  const itemsByCategory = items.reduce((acc: any, item: any) => {
    const category = item.service?.category || 'Sin categoría';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  // Calcular métricas
  const totalPresupuestado = budget.total_amount || 0;
  const totalConSolicitudes = requests.reduce((sum: number, req: any) => {
    return sum + (req.cost_to_agency || 0) * req.quantity;
  }, 0);
  const totalFacturado = requests.reduce((sum: number, req: any) => {
    if (req.billed_invoice) {
      return sum + (req.cost_to_agency || 0) * req.quantity;
    }
    return sum;
  }, 0);
  const pendienteFacturar = totalPresupuestado - totalFacturado;

  return (
    <AppLayout 
      title={budget.title} 
      description={`Presupuesto ${budget.client?.name || ''}`}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/presupuestos')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Presupuestos
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => duplicateMutation.mutate(budget)}
              disabled={duplicateMutation.isPending}
            >
              <Copy className="h-4 w-4 mr-2" />
              Usar como Plantilla
            </Button>
            {budget.status === 'pending' && (
              <Button onClick={() => setEditModalOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="economico">Detalle Económico</TabsTrigger>
            <TabsTrigger value="operacion">Operación</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Título</p>
                    <p className="text-lg font-semibold">{budget.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="text-lg font-semibold">{budget.client?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado</p>
                    <BudgetStatusBadge status={budget.status} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Válido hasta</p>
                    <p className="text-lg">
                      {budget.valid_until
                        ? format(new Date(budget.valid_until), 'dd MMMM yyyy', { locale: es })
                        : 'No especificado'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de creación</p>
                    <p className="text-lg">
                      {format(new Date(budget.created_at), 'dd MMMM yyyy', { locale: es })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monto Total</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(totalPresupuestado)}
                    </p>
                  </div>
                </div>

                {budget.description && (
                  <div className="pt-4 border-t space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Objetivo de campaña / Resumen
                      </p>
                      <p className="text-base whitespace-pre-wrap">{budget.description}</p>
                    </div>

                    {budget.accepted_document_url && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Documento aceptado por el cliente</p>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <a
                            href={budget.accepted_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="h-4 w-4" />
                            Ver documento
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="economico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Líneas del Presupuesto</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(itemsByCategory).map(([category, categoryItems]: [string, any]) => {
                  const subtotal = categoryItems.reduce((sum: number, item: any) => sum + item.total, 0);
                  return (
                    <div key={category} className="mb-6 last:mb-0">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-lg">{category}</h4>
                        <span className="text-sm font-medium text-muted-foreground">
                          Subtotal: {formatCurrency(subtotal)}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-center">Cantidad</TableHead>
                            <TableHead className="text-right">Precio Unit.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryItems.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.service?.name || 'Sin servicio'}
                              </TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.unit_price)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(item.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas Económicas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Presupuestado</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalPresupuestado)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Con Solicitudes Creadas</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalConSolicitudes)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Facturado</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalFacturado)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Pendiente de Facturar</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(pendienteFacturar)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {requests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Solicitudes Financieras Generadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Servicio</TableHead>
                        <TableHead>Especialista</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-mono text-sm">{request.code}</TableCell>
                          <TableCell>{request.title}</TableCell>
                          <TableCell>{request.service?.name}</TableCell>
                          <TableCell>{request.specialist?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={request.status === 'active' ? 'default' : 'secondary'}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency((request.cost_to_agency || 0) * request.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="operacion" className="space-y-6">
            {projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay proyectos operativos vinculados a este presupuesto
                  </p>
                </CardContent>
              </Card>
            ) : (
              projects.map((project: any) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{project.name}</CardTitle>
                      <Badge>{project.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
                    )}
                    {project.operational_requests && project.operational_requests.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Solicitudes Operativas</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Deadline</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {project.operational_requests.map((req: any) => (
                              <TableRow key={req.id}>
                                <TableCell>{req.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{req.status}</Badge>
                                </TableCell>
                                <TableCell>
                                  {req.deadline
                                    ? format(new Date(req.deadline), 'dd/MM/yyyy', { locale: es })
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BudgetFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        budget={budget}
        mode="edit"
      />
    </AppLayout>
  );
}
