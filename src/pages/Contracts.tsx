import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

const Contracts = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contratos</h1>
            <p className="text-muted-foreground">Gestiona tus contratos</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Contrato
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center text-muted-foreground">
              Funcionalidad de contratos próximamente
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Contracts;
