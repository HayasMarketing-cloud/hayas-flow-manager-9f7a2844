import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calculator, ClipboardList, Briefcase, ArrowRight } from 'lucide-react';

export default function GuiaRapida() {
  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Guía Rápida</h1>
          <p className="text-muted-foreground">Cómo usar los módulos principales de Flow Manager</p>
        </div>

        <Tabs defaultValue="contratos" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="contratos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="presupuestos" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Presupuestos</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Requests</span>
            </TabsTrigger>
            <TabsTrigger value="proyectos" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Proyectos</span>
            </TabsTrigger>
          </TabsList>

          {/* CONTRATOS */}
          <TabsContent value="contratos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Contratos
                </CardTitle>
                <CardDescription>Acuerdos de servicios recurrentes con clientes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">¿Qué son?</h3>
                  <p className="text-muted-foreground">
                    Los contratos representan acuerdos de servicios continuos que se facturan de forma recurrente (mensual, trimestral, etc.). 
                    Ideal para retainers, mantenimientos o servicios con frecuencia fija.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Flujo básico</h3>
                  <div className="flex flex-wrap items-center gap-2 p-4 bg-muted rounded-lg">
                    <Badge variant="outline">1. Crear</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">2. Activar</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">3. Generar Requests</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">4. Crear Proyecto</Badge>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Estados</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Borrador</Badge>
                    <Badge className="bg-primary text-primary-foreground">Activo</Badge>
                    <Badge className="bg-accent text-accent-foreground">Suspendido</Badge>
                    <Badge variant="destructive">Expirado</Badge>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">💡 Tip</h3>
                  <p className="text-sm text-muted-foreground">
                    Al crear un proyecto desde un contrato, se generan milestones automáticamente desde las plantillas de servicios configuradas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRESUPUESTOS */}
          <TabsContent value="presupuestos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Presupuestos
                </CardTitle>
                <CardDescription>Propuestas económicas para proyectos específicos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">¿Qué son?</h3>
                  <p className="text-muted-foreground">
                    Los presupuestos son cotizaciones para proyectos puntuales (one-shot). 
                    Contienen ítems de servicio con precio y cantidad que, al aprobarse, generan los requests correspondientes.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Flujo básico</h3>
                  <div className="flex flex-wrap items-center gap-2 p-4 bg-muted rounded-lg">
                    <Badge variant="outline">1. Crear</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">2. Enviar</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">3. Aprobar</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">4. Crear Proyecto</Badge>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Estados</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Pendiente</Badge>
                    <Badge variant="outline">Enviado</Badge>
                    <Badge className="bg-primary text-primary-foreground">Aprobado</Badge>
                    <Badge variant="destructive">Rechazado</Badge>
                    <Badge className="bg-accent text-accent-foreground">Facturado</Badge>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">💡 Tip</h3>
                  <p className="text-sm text-muted-foreground">
                    Al aprobar un presupuesto se generan automáticamente los Financial Requests. 
                    Después puedes crear el proyecto operativo desde la vista de detalle.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REQUESTS */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Requests
                </CardTitle>
                <CardDescription>Unidades de trabajo facturables y liquidables</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">¿Qué son?</h3>
                  <p className="text-muted-foreground">
                    Cada servicio vendido = 1 request. Son la unidad económica base del sistema, 
                    utilizados para facturar al cliente y liquidar al especialista.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Orígenes</h3>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary">Manual</Badge>
                      <span className="text-sm text-muted-foreground">Creado desde cero</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary">Presupuesto</Badge>
                      <span className="text-sm text-muted-foreground">Al aprobar presupuesto</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary">Contrato</Badge>
                      <span className="text-sm text-muted-foreground">Generación mensual</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Estados</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Borrador</Badge>
                    <Badge variant="outline">En Progreso</Badge>
                    <Badge className="bg-primary text-primary-foreground">Completado</Badge>
                    <Badge className="bg-accent text-accent-foreground">Facturado</Badge>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Campos clave</h3>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Precio venta / Costo agencia</span>
                      <span className="text-muted-foreground">→ Calcula el margen</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Especialista</span>
                      <span className="text-muted-foreground">→ Para liquidaciones</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Deadline</span>
                      <span className="text-muted-foreground">→ Fecha de entrega</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROYECTOS */}
          <TabsContent value="proyectos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Proyectos Operativos
                </CardTitle>
                <CardDescription>Gestión del trabajo y seguimiento de tareas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">¿Qué son?</h3>
                  <p className="text-muted-foreground">
                    Contenedor para organizar el trabajo operativo. 
                    Agrupa milestones (entregas) y tareas para seguimiento del equipo.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Estructura</h3>
                  <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                    <div>📁 Proyecto</div>
                    <div className="ml-4">└── 📌 Milestones (entregas)</div>
                    <div className="ml-8">└── ✅ Tareas</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Creación</h3>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary">Presupuesto</Badge>
                      <span className="text-sm text-muted-foreground">Desde presupuesto aprobado</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary">Contrato</Badge>
                      <span className="text-sm text-muted-foreground">Desde contrato activo</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary">Manual</Badge>
                      <span className="text-sm text-muted-foreground">Nuevo proyecto vacío</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Estados</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Pendiente</Badge>
                    <Badge variant="outline">En Progreso</Badge>
                    <Badge className="bg-accent text-accent-foreground">En Revisión</Badge>
                    <Badge className="bg-primary text-primary-foreground">Completado</Badge>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">💡 Vista Seguimiento</h3>
                  <p className="text-sm text-muted-foreground">
                    En el detalle del proyecto, usa la Vista Seguimiento para editar inline especialista, deadline y estado. 
                    Usa checkboxes para cambios masivos y el botón "+" para crear tareas rápidamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
