## Objetivo

Añadir en `ClienteDetalle.tsx` un bloque con **Contratos, Presupuestos y Proyectos** del cliente, reutilizando componentes existentes. Edición inline con modal.

## Viabilidad

Todo lo necesario ya existe:
- `ContractTableView`, `BudgetTableView` reutilizables con props.
- `ContractFormModal`, `BudgetFormModal`, `OperationalProjectFormModal` soportan `initialData` y crear con cliente preasignado.
- Las queries ya filtran por `client_id`. RLS ya filtra por cliente asignado.
- 0 cambios en BBDD.

## Diseño

Debajo del bloque actual de **Contactos**, una `Card` con `Tabs` de 3 pestañas (Contratos / Presupuestos / Proyectos). Cada pestaña:
- Header: buscador + filtro de estado + botón "Nuevo …" (preasigna `client_id`).
- Tabla reutilizada.
- Acciones por fila: **Editar inline con modal** + un enlace pequeño "Ver detalle →" para profundizar.

## Implementación

1. **Extraer** la tabla actual de proyectos de `OperationalProjects.tsx` a `src/components/operations/OperationalProjectsTableView.tsx` (props: `projects`, `onEdit`, `onView`, `onDelete`).

2. **Crear** 3 contenedores en `src/components/clients/`:
   - `ClientContractsTab.tsx` — query `contracts` por `client_id`, search + status local, render `ContractTableView`, gestiona modal `ContractFormModal` para crear/editar inline.
   - `ClientBudgetsTab.tsx` — análogo con `BudgetTableView` + `BudgetFormModal`.
   - `ClientProjectsTab.tsx` — análogo con `OperationalProjectsTableView` + `OperationalProjectFormModal`.

   Cada uno acepta `clientId: string` y `canEdit: boolean`. Las acciones de editar abren el modal con `initialData` de la fila. "Nuevo" abre el modal con `initialData={{ client_id: clientId }}` para preasignar cliente.

3. **Integrar** en `ClienteDetalle.tsx`:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-lg">Actividad del cliente</CardTitle>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="contracts">
      <TabsList>
        <TabsTrigger value="contracts">Contratos</TabsTrigger>
        <TabsTrigger value="budgets">Presupuestos</TabsTrigger>
        <TabsTrigger value="projects">Proyectos</TabsTrigger>
      </TabsList>
      <TabsContent value="contracts"><ClientContractsTab clientId={id!} canEdit={canEdit} /></TabsContent>
      <TabsContent value="budgets"><ClientBudgetsTab clientId={id!} canEdit={canEdit} /></TabsContent>
      <TabsContent value="projects"><ClientProjectsTab clientId={id!} canEdit={canEdit} /></TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

4. **Modales**: verificar que aceptan `initialData={{ client_id }}` para crear con cliente preasignado. Si alguno no lo soporta, añadir esa rama mínima.

## Eficiencia

- Lazy: cada tab solo monta su query al activarse (TanStack Query cachea por `[entidad, clientId]`).
- Reutilización máxima: ~80 líneas por contenedor + un refactor menor para la tabla de proyectos.
- Sin duplicar lógica de filtros (search/status local por tab).
- Sin cambios en backend.

## QA

- Cliente Asendia Spain: 3 pestañas con los contratos/presupuestos/proyectos correctos.
- Buscar y filtrar por estado funciona en cada tab.
- "Editar" abre modal con datos cargados, guarda y refresca la tabla.
- "Nuevo" abre modal con cliente preasignado y bloqueado.
- AM/PM solo ve clientes asignados (RLS).

## Fuera de alcance

- Páginas `/contratos`, `/presupuestos`, `/proyectos` no se tocan.
- No se añaden filtros nuevos más allá de search + estado.
- No se añade exportación desde estas pestañas (lo tienen las páginas principales).
