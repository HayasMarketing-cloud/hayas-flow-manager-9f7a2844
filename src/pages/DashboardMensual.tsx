import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardMensual() {
  return (
    <AppLayout 
      title="Dashboard Mensual" 
      description="Vista general de operaciones mensuales"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {["Clientes", "Servicios", "Contratos", "Presupuestos"].map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-1">
                En construcción
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
