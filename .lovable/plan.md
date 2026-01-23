

# Plan: Ocultar Secciones del Menu Segun Permisos de Rol

## Resumen
Actualizar el sidebar para que solo muestre las secciones del menu a las que cada rol tiene acceso real, basandose en la matriz de permisos definida.

## Analisis de la Matriz de Permisos

Segun el archivo `matriz-permisos-roles.csv`, estos son los accesos por modulo:

| Modulo | admin | finanzas | project_manager | account_manager | especialista |
|--------|-------|----------|-----------------|-----------------|--------------|
| Dashboard | Full | Finanzas | Operaciones | Cuentas | Mis tareas |
| Clientes | CRUD | Ver | Ver | Ver sus clientes | Ver sus clientes |
| Presupuestos | CRUD | Ver | Ver | Ver sus clientes | Ver |
| Contratos | CRUD | Ver | Ver | Ver sus clientes | Ver |
| Solicitudes | CRUD | CRUD | CRUD | Ver sus clientes | Ver propias |
| Facturas | CRUD | CRUD | **No** | Ver sus clientes | **No** |
| Liquidaciones | CRUD | CRUD | **No** | Ver especialistas | Ver propias |
| Proyectos | CRUD | Ver | CRUD | Ver sus clientes | Ver proyectos |
| Mis Tareas | Si | No | Si | Ver sus clientes | Actualizar |
| Especialistas | CRUD | Ver | Ver | Ver | Ver |
| Servicios | CRUD | Ver | Ver | Ver | Ver |
| Usuarios | CRUD | No | No | No | No |
| Comisiones | CRUD | CRUD | No | No | No |
| Reportes | CRUD | CRUD | No | No | No |

## Problemas Actuales en el Sidebar

El archivo `AppSidebar.tsx` tiene varios items sin restriccion de roles:

1. **Presupuestos** - Visible para todos, deberia ser para todos los roles (ok segun matriz)
2. **Dashboard** - Visible para todos (ok, pero redirige segun rol)
3. **Contratos** - Visible para todos (ok segun matriz - todos pueden ver)
4. **Clientes** - Visible para todos (ok segun matriz - todos pueden ver, aunque limitado)
5. **Facturas** - Tiene `requiredRoles` pero incluye `account_manager` pero NO project_manager (correcto)
6. **Liquidaciones** - Incluye `especialista` y `account_manager` pero NO project_manager (correcto)
7. **Comisiones** - Solo admin y finanzas (correcto)
8. **Reportes** - Solo admin y finanzas (correcto)
9. **Usuarios** - Solo admin (correcto)

### Items que NECESITAN correccion:

| Item | Actual | Deberia Ser |
|------|--------|-------------|
| Facturas | admin, finanzas, account_manager | Correcto (PM no tiene acceso) |
| Liquidaciones | admin, finanzas, account_manager, especialista | Correcto |
| Requests | admin, finanzas, project_manager, account_manager | Falta especialista (puede ver propias) |
| Mis Tareas | Sin restriccion | Excluir finanzas (matriz dice "No") |

## Cambios Propuestos

### Archivo: `src/components/layout/AppSidebar.tsx`

Actualizar las definiciones de `requiredRoles` para cada item:

```text
OPERATIONS:
- Requests: ['admin', 'finanzas', 'project_manager', 'account_manager', 'especialista']
- Presupuestos: todos (sin cambio)
- Proyectos: ['admin', 'project_manager', 'especialista', 'account_manager'] (sin cambio)
- Mis Tareas: ['admin', 'project_manager', 'account_manager', 'especialista'] (excluir finanzas)
- Notificaciones: todos (sin cambio)

FINANCE:
- Dashboard: todos (sin cambio)  
- Contratos: todos (sin cambio - todos pueden ver)
- Facturas: ['admin', 'finanzas', 'account_manager'] (sin cambio - PM no)
- Liquidaciones: ['admin', 'finanzas', 'account_manager', 'especialista'] (sin cambio)
- Comisiones: ['admin', 'finanzas'] (sin cambio)
- Reportes: ['admin', 'finanzas'] (sin cambio)

ADMIN:
- Clientes: todos (sin cambio - filtrado se hace en pagina)
- Servicios: todos (sin cambio)
- Especialistas: todos (sin cambio)
- Usuarios: ['admin'] (sin cambio)
```

## Cambios Especificos

### 1. Requests - Agregar especialista
Actualmente: `['admin', 'finanzas', 'project_manager', 'account_manager']`
Nuevo: `['admin', 'finanzas', 'project_manager', 'account_manager', 'especialista']`

El especialista puede ver sus propias solicitudes segun la matriz.

### 2. Mis Tareas - Excluir finanzas
Actualmente: Sin restriccion (visible para todos)
Nuevo: `['admin', 'project_manager', 'account_manager', 'especialista']`

Finanzas no tiene acceso a tareas segun la matriz.

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppSidebar.tsx` | Actualizar requiredRoles de Requests y Mis Tareas |

## Verificacion Post-Implementacion

Para cada rol, el menu deberia mostrar:

**admin**: Todo visible
**finanzas**: Todo excepto Mis Tareas, Proyectos, Usuarios
**project_manager**: Todo excepto Facturas, Liquidaciones, Comisiones, Reportes, Usuarios
**account_manager**: Todo excepto Comisiones, Reportes, Usuarios
**especialista**: Requests, Presupuestos, Proyectos, Mis Tareas, Notificaciones, Dashboard, Contratos, Liquidaciones, Clientes, Servicios, Especialistas

