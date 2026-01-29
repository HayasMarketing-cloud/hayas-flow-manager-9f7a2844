import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileCheck2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnassignedInvoices } from '@/hooks/useUnassignedInvoices';
import { ReconciliationRow } from '@/components/invoices/ReconciliationRow';
import { useUserRole } from '@/hooks/useUserRole';

export default function FacturasReconciliar() {
  const { data: unassignedInvoices, isLoading } = useUnassignedInvoices();
  const { canAccessFinance, loading: rolesLoading } = useUserRole();
  const canFinance = canAccessFinance();

  if (rolesLoading) {
    return (
      <AppLayout title="Reconciliar Facturas">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando permisos...</p>
        </div>
      </AppLayout>
    );
  }

  if (!canFinance) {
    return (
      <AppLayout title="Reconciliar Facturas">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">No tienes permisos para acceder a esta sección</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reconciliar Facturas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/facturas">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">Reconciliar Facturas</h2>
              <p className="text-muted-foreground">
                Asocia facturas importadas con solicitudes completadas
              </p>
            </div>
          </div>
          {unassignedInvoices && unassignedInvoices.length > 0 && (
            <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{unassignedInvoices.length} facturas sin asociar</span>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Cargando facturas...</p>
          </div>
        ) : !unassignedInvoices || unassignedInvoices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileCheck2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">¡Todas las facturas están reconciliadas!</h3>
              <p className="text-muted-foreground text-center max-w-md">
                No hay facturas pendientes de asociar con solicitudes. 
                Puedes volver a la lista de facturas.
              </p>
              <Link to="/facturas" className="mt-6">
                <Button>Volver a Facturas</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Expande cada factura para ver las solicitudes disponibles y asociarlas.
              El sistema sugiere automáticamente solicitudes cuyo importe coincide con el subtotal de la factura (±5%).
            </p>
            {unassignedInvoices.map((invoice) => (
              <ReconciliationRow key={invoice.id} invoice={invoice} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
