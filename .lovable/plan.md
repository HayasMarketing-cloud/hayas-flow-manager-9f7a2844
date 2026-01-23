

# Plan: Acceso Filtrado para Account Manager y Project Manager

## Resumen
Implementar filtrado en el frontend para que los usuarios con rol **Account Manager (AM)** y **Project Manager (PM)** vean únicamente los clientes, contratos, presupuestos y proyectos operativos a los que están asignados, en lugar de ver todos los registros.

## Situacion Actual

La base de datos ya tiene las políticas de seguridad (RLS) correctamente configuradas que permiten:
- AM/PM ver presupuestos donde son `am_user_id` o `pm_user_id`
- AM ver contratos donde son `am_user_id`
- AM ver clientes asociados a sus contratos/presupuestos
- AM/PM ver proyectos de clientes asignados

Sin embargo, el frontend actualmente solo implementa filtrado especial para usuarios con rol "especialista", mostrando a AM/PM todos los registros sin restricción.

## Cambios Propuestos

### 1. Crear Hook Centralizado para Clientes Asignados
**Archivo nuevo**: `src/hooks/useAssignedClients.tsx`

Crear un hook reutilizable que obtenga los IDs de clientes asignados al usuario actual basándose en:
- Contratos donde es AM (`am_user_id`)
- Contratos donde es PM (`pm_user_id`)  
- Presupuestos donde es AM o PM

```text
┌─────────────────────────────────────────────┐
│         useAssignedClients()                │
├─────────────────────────────────────────────┤
│ Consulta contracts + budgets                │
│ Extrae client_ids unicos                    │
│ Retorna: { clientIds, isLoading }           │
└─────────────────────────────────────────────┘
```

### 2. Actualizar Pagina de Clientes
**Archivo**: `src/pages/Clientes.tsx`

- Detectar si el usuario es SOLO AM/PM (sin admin o finanzas)
- Usar el nuevo hook para obtener clientes asignados
- Filtrar la consulta para mostrar solo esos clientes
- Mantener funcionalidad actual para admin/finanzas

### 3. Actualizar Pagina de Contratos  
**Archivo**: `src/pages/Contratos.tsx`

- Detectar si el usuario es SOLO AM/PM
- Para AM: filtrar contratos donde `am_user_id = auth.uid()`
- Para PM: filtrar contratos donde `pm_user_id = auth.uid()`
- Mantener la logica actual de especialistas

### 4. Actualizar Pagina de Presupuestos
**Archivo**: `src/pages/Presupuestos.tsx`

- Detectar si el usuario es SOLO AM/PM
- Filtrar presupuestos donde el usuario es `am_user_id` o `pm_user_id`
- Mantener la logica actual de especialistas

### 5. Actualizar Pagina de Proyectos Operativos
**Archivo**: `src/pages/operations/OperationalProjects.tsx`

- Usar el hook de clientes asignados
- Filtrar proyectos cuyo `client_id` este en la lista de clientes asignados
- Agregar logica para detectar rol AM/PM

### 6. Actualizar Hook useUserRole
**Archivo**: `src/hooks/useUserRole.ts`

Agregar funciones helper adicionales:
- `isOnlyAccountManager()`: Usuario tiene solo rol AM (sin admin/finanzas)
- `isOnlyProjectManager()`: Usuario tiene solo rol PM (sin admin/finanzas)
- `shouldFilterByAssignment()`: Usuario necesita filtrado por asignacion

## Detalles Tecnicos

### Logica de Filtrado por Rol

```text
┌───────────────────────────────────────────────────────────────┐
│                    Matriz de Acceso                           │
├───────────────────────────────────────────────────────────────┤
│ Rol              │ Clientes  │ Contratos │ Presupuestos │ Proy│
├──────────────────┼───────────┼───────────┼──────────────┼─────┤
│ admin/finanzas   │ Todos     │ Todos     │ Todos        │Todos│
│ project_manager  │ Asignados │ Asignados │ Asignados    │Asig.│
│ account_manager  │ Asignados │ Asignados │ Asignados    │Asig.│
│ especialista     │ Solicitud │ Servicio  │ Items        │Asig.│
└───────────────────────────────────────────────────────────────┘
```

### Consulta para Obtener Clientes Asignados

```sql
-- IDs de clientes de contratos donde soy AM o PM
SELECT DISTINCT client_id FROM contracts 
WHERE am_user_id = auth.uid() OR pm_user_id = auth.uid()

UNION

-- IDs de clientes de presupuestos donde soy AM o PM  
SELECT DISTINCT client_id FROM budgets
WHERE am_user_id = auth.uid() OR pm_user_id = auth.uid()
```

### Flujo de Datos Actualizado

```text
Usuario AM/PM inicia sesion
         │
         ▼
┌─────────────────────┐
│  useUserRole()      │
│  Detecta rol AM/PM  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ useAssignedClients()│
│ Obtiene client_ids  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Paginas filtran     │
│ datos por client_id │
└─────────────────────┘
```

## Archivos a Modificar

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `src/hooks/useAssignedClients.tsx` | Crear | Hook para clientes asignados |
| `src/hooks/useUserRole.ts` | Modificar | Agregar helpers de filtrado |
| `src/pages/Clientes.tsx` | Modificar | Filtrar por clientes asignados |
| `src/pages/Contratos.tsx` | Modificar | Filtrar por AM/PM user_id |
| `src/pages/Presupuestos.tsx` | Modificar | Filtrar por AM/PM user_id |
| `src/pages/operations/OperationalProjects.tsx` | Modificar | Filtrar por clientes asignados |

## Consideraciones

- Los cambios son solo en frontend; las politicas RLS ya protegen los datos
- Los dropdowns de filtro (selector de cliente) tambien deben mostrar solo clientes asignados
- El boton "Nuevo" debe seguir visible para AM/PM en presupuestos y proyectos
- No afecta a usuarios con rol admin o finanzas

