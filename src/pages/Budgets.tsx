import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

const Budgets = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Presupuestos</h1>
            <p className="text-muted-foreground">Gestiona tus presupuestos</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Presupuesto
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Presupuestos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center text-muted-foreground">
              Funcionalidad de presupuestos próximamente
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Budgets;
