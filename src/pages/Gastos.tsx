import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpenseRegistryTab } from '@/components/expenses/ExpenseRegistryTab';
import { ExpenseTrackerTab } from '@/components/expenses/ExpenseTrackerTab';
import { ExpenseAnalysisTab } from '@/components/expenses/ExpenseAnalysisTab';
import { CreditCard, CalendarCheck, PieChart } from 'lucide-react';

export default function Gastos() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gastos y Suscripciones</h1>
          <p className="text-muted-foreground">Gestiona tus gastos recurrentes, verifica facturas y analiza costes</p>
        </div>

        <Tabs defaultValue="registry">
          <TabsList>
            <TabsTrigger value="registry" className="gap-1"><CreditCard className="h-4 w-4" />Registro</TabsTrigger>
            <TabsTrigger value="tracker" className="gap-1"><CalendarCheck className="h-4 w-4" />Seguimiento</TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1"><PieChart className="h-4 w-4" />Análisis</TabsTrigger>
          </TabsList>
          <TabsContent value="registry"><ExpenseRegistryTab /></TabsContent>
          <TabsContent value="tracker"><ExpenseTrackerTab /></TabsContent>
          <TabsContent value="analysis"><ExpenseAnalysisTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
