

## Plan: Añadir columna "Origen" a la lista de Requests

### Objetivo
Agregar una nueva columna **"Origen"** en la tabla y tarjetas de Requests que muestre de forma visual si el request tiene un **Presupuesto** y/o **Proyecto Operativo** asociado, con enlaces directos a cada uno.

### Diseño visual

La columna mostrará iconos diferenciados:
- **📋 Presupuesto**: Icono de documento + código (PRE-XXXX) con enlace a `/presupuestos/{id}`
- **🗂️ Proyecto**: Icono de carpeta + nombre truncado con enlace a `/proyectos/{id}`

Cuando no hay asociación, se mostrará `---` en gris (patrón existente similar a Factura/Liquidación).

### Cambios a realizar

**1. Modificar la query de datos** (`src/pages/Solicitudes.tsx`)
- Añadir un JOIN con `operational_requests` para obtener el proyecto operativo asociado:
  ```
  operational_request:operational_requests(
    id,
    operational_project:operational_projects(id, name)
  )
  ```

**2. Crear componente OriginCell** (`src/components/requests/OriginCell.tsx`)
- Componente reutilizable que muestra:
  - Presupuesto (si existe `budget_id` y `budget.code`)
  - Proyecto Operativo (si existe relación via `operational_request`)
- Incluye tooltips con información detallada
- Enlaces clicables a las secciones correspondientes

**3. Actualizar RequestTableView** (`src/components/requests/RequestTableView.tsx`)
- Añadir header "Origen" después de "Especialista"
- Insertar celda con el nuevo componente `OriginCell`
- Actualizar `colSpan` para el mensaje de vacío

**4. Actualizar RequestCard** (`src/components/requests/RequestCard.tsx`)
- Añadir sección visual mostrando origen (presupuesto/proyecto) entre cliente y especialista

### Detalles técnicos

**Query modificada:**
```sql
SELECT *,
  client:clients(id, name, code),
  service:services(id, name),
  specialist:specialists(id, name, email),
  budget:budgets(id, title, code),
  invoice:invoices(id, code, status),
  liquidation:liquidations(id, code, status),
  operational_request:operational_requests!financial_request_id(
    id,
    operational_project:operational_projects(id, name)
  )
FROM financial_requests
```

**Componente OriginCell:**
- Props: `budgetId`, `budgetCode`, `operationalProject` (id + name)
- Usa `Tooltip` para mostrar información completa
- Iconos de Lucide: `FileSpreadsheet` para presupuesto, `FolderKanban` para proyecto
- Links con `useNavigate` a las rutas correspondientes

### Posición de la columna

La columna se ubicará después de "Especialista" y antes de "Estado":

| Código | Título | Cliente | Especialista | **Origen** | Estado | Flujo | ... |

