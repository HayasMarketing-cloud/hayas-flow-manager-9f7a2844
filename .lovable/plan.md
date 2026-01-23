
# Plan: Proyectos como sección principal y mejora de cards

## Resumen
Se moverá "Proyectos" a la primera posición del menú lateral, se establecerá como página de inicio para usuarios autenticados, y se mejorará la información mostrada en las tarjetas de proyectos incluyendo progreso y cambiando "solicitudes" por "requests".

---

## Cambios a realizar

### 1. Menú lateral (Sidebar)
**Archivo:** `src/components/layout/AppSidebar.tsx`

- Reordenar `operationsItems` para que "Proyectos" sea el primer elemento:
  - Nuevo orden: Proyectos, Requests, Presupuestos, Mis Tareas, Notificaciones

### 2. Página de inicio
**Archivo:** `src/pages/Index.tsx`

- Cambiar redirección de usuarios autenticados:
  - Antes: `/dashboard-mensual`
  - Después: `/proyectos-operativos`

### 3. Mejoras en las cards de proyectos
**Archivo:** `src/pages/operations/OperationalProjects.tsx`

#### 3.1 Cambio de terminología
- Cambiar "solicitudes" por "requests" en el badge de conteo

#### 3.2 Información de progreso
- Modificar la query de `requestCounts` para obtener también los estados de cada operational_request
- Calcular progreso: porcentaje de milestones/requests completados
- Añadir barra de progreso visual con el porcentaje

#### 3.3 Elementos visuales nuevos en la card:
- Barra de progreso (Progress component)
- Texto "X de Y requests completados" o porcentaje

---

## Sección técnica

### Cambios en AppSidebar.tsx (líneas 26-32)
```typescript
const operationsItems: NavItem[] = [
  { title: 'Proyectos', url: '/proyectos-operativos', icon: Briefcase, requiredRoles: ['admin', 'project_manager', 'especialista', 'account_manager'] },
  { title: 'Requests', url: '/solicitudes', icon: FileCheck, requiredRoles: ['admin', 'finanzas', 'project_manager', 'account_manager', 'especialista'] },
  { title: 'Presupuestos', url: '/presupuestos', icon: Calculator },
  { title: 'Mis Tareas', url: '/mis-tareas', icon: CheckSquare, requiredRoles: ['admin', 'project_manager', 'account_manager', 'especialista'] },
  { title: 'Notificaciones', url: '/notificaciones', icon: Bell },
];
```

### Cambios en Index.tsx (línea 12)
```typescript
navigate(user ? '/proyectos-operativos' : '/auth', { replace: true });
```

### Cambios en OperationalProjects.tsx

#### Nueva query para progreso (reemplaza la query actual de `requestCounts`)
```typescript
const { data: requestStats } = useQuery({
  queryKey: ['operational-request-stats', projects?.map(p => p.id)],
  queryFn: async () => {
    if (!projects || projects.length === 0) return {};
    const { data, error } = await supabase
      .from('operational_requests')
      .select('id, operational_project_id, status')
      .in('operational_project_id', projects.map(p => p.id));
    if (error) throw error;
    
    const stats: Record<string, { total: number; completed: number }> = {};
    data?.forEach(r => {
      if (!stats[r.operational_project_id]) {
        stats[r.operational_project_id] = { total: 0, completed: 0 };
      }
      stats[r.operational_project_id].total++;
      if (r.status === 'completed') {
        stats[r.operational_project_id].completed++;
      }
    });
    return stats;
  },
  enabled: !!projects && projects.length > 0,
});
```

#### Nuevo UI en la card
```typescript
// Añadir import del componente Progress
import { Progress } from '@/components/ui/progress';

// En la card, reemplazar la sección actual de conteo:
const stats = requestStats?.[project.id] || { total: 0, completed: 0 };
const progressPercent = stats.total > 0 
  ? Math.round((stats.completed / stats.total) * 100) 
  : 0;

// Renderizado:
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">Progreso</span>
    <span className="font-medium">{progressPercent}%</span>
  </div>
  <Progress value={progressPercent} className="h-2" />
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">
      {stats.completed} de {stats.total} requests
    </span>
    <Badge variant="outline">
      {stats.total} requests
    </Badge>
  </div>
</div>
```

---

## Resultado esperado

1. Al iniciar sesión, el usuario será dirigido a la página de Proyectos
2. "Proyectos" aparecerá primero en el menú lateral de Operations
3. Las cards de proyectos mostrarán:
   - Barra de progreso visual
   - Porcentaje de completado
   - Conteo de requests completados vs totales
   - Terminología "requests" en lugar de "solicitudes"
