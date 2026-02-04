

## Plan: Automatización de Requests y Proyectos Recurrentes desde Contratos

### Resumen Ejecutivo

Automatizar la generación mensual de requests y proyectos operativos desde contratos activos con `enable_auto_requests = true`. El proceso se ejecutará automáticamente el día 1 de cada mes mediante un cron job.

---

### Estado Actual

| Componente | Estado |
|------------|--------|
| Campo `enable_auto_requests` | Ya existe en `contracts` |
| Edge function `generate-monthly-requests` | Existe pero es manual y no crea proyectos |
| Campo `work_month/work_year` en requests | No existe |
| Campo `work_month/work_year` en projects | No existe |
| Cron job para ejecución automática | No existe |
| Detección de duplicados | No existe |

---

### Impacto en lo Existente

**Bajo impacto** - Los cambios son aditivos:

1. **Base de datos**: Añadir 2 columnas a `financial_requests` y 2 a `operational_projects`
2. **Edge function**: Extender la existente para:
   - Ejecutarse sin `contract_id` (procesa todos los contratos activos)
   - Añadir campo `work_month/work_year`
   - Crear proyecto operativo automáticamente
   - Detectar duplicados para no regenerar
3. **Cron**: Configurar pg_cron para ejecutar el día 1

---

### Nuevo Campo: Mes de Trabajo

```text
financial_requests:
  + work_month (INTEGER, nullable) -- 1-12
  + work_year  (INTEGER, nullable) -- 2025, 2026...

operational_projects:
  + work_month (INTEGER, nullable) -- 1-12
  + work_year  (INTEGER, nullable) -- 2025, 2026...
```

**Comportamiento:**
- Requests/proyectos creados el 1 de febrero → `work_month = 2, work_year = 2026`
- Permite agrupar y filtrar por período de trabajo
- Alineado con `period_month/period_year` de liquidations e invoices

---

### Flujo de Ejecución Automática

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     DÍA 1 DE CADA MES (00:05)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Cron pg_cron invoca edge function                               │
│          │                                                          │
│          ▼                                                          │
│  2. Buscar contratos con:                                           │
│     • status = 'active'                                             │
│     • enable_auto_requests = true                                   │
│     • start_date <= hoy                                             │
│     • end_date IS NULL O end_date >= hoy                            │
│          │                                                          │
│          ▼                                                          │
│  3. Por cada contrato:                                              │
│     ┌────────────────────────────────────────────────────────┐      │
│     │ a. Verificar si ya existen requests para este mes      │      │
│     │    (work_month = mes actual, work_year = año actual)   │      │
│     │                                                        │      │
│     │ b. Si NO existen:                                      │      │
│     │    • Crear requests con work_month/work_year           │      │
│     │    • Crear proyecto operativo con work_month/work_year │      │
│     │    • Clonar milestones/tareas desde templates          │      │
│     └────────────────────────────────────────────────────────┘      │
│          │                                                          │
│          ▼                                                          │
│  4. Retornar resumen:                                               │
│     • Contratos procesados                                          │
│     • Requests generados                                            │
│     • Proyectos creados                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Detección de Duplicados

Para evitar regenerar requests del mismo mes:

```sql
-- Verificar si ya existen requests para el contrato + mes
SELECT COUNT(*) FROM financial_requests 
WHERE contract_id = $1 
  AND work_month = $2 
  AND work_year = $3;
```

Si `count > 0`, se omite ese contrato para ese mes.

---

### Cambios Técnicos

#### 1. Migración de Base de Datos

```sql
-- Añadir campos de período de trabajo a financial_requests
ALTER TABLE public.financial_requests 
  ADD COLUMN IF NOT EXISTS work_month INTEGER,
  ADD COLUMN IF NOT EXISTS work_year INTEGER;

-- Añadir campos de período de trabajo a operational_projects
ALTER TABLE public.operational_projects 
  ADD COLUMN IF NOT EXISTS work_month INTEGER,
  ADD COLUMN IF NOT EXISTS work_year INTEGER;

-- Índice para búsqueda rápida de duplicados
CREATE INDEX IF NOT EXISTS idx_requests_work_period 
  ON financial_requests(contract_id, work_month, work_year);

CREATE INDEX IF NOT EXISTS idx_projects_work_period 
  ON operational_projects(contract_id, work_month, work_year);
```

#### 2. Edge Function Actualizada

**Archivo:** `supabase/functions/generate-monthly-requests/index.ts`

**Cambios principales:**
- Soportar ejecución sin `contract_id` (procesa todos los activos)
- Añadir `work_month` y `work_year` a cada request creado
- Crear proyecto operativo con milestones y tareas
- Validar duplicados antes de crear
- Retornar estadísticas detalladas

**Pseudocódigo:**

```typescript
// Si no viene contract_id, buscar todos los contratos activos con auto_requests
const contracts = contract_id 
  ? [await getContract(contract_id)]
  : await getActiveAutoContracts();

const now = new Date();
const workMonth = now.getMonth() + 1;  // 1-12
const workYear = now.getFullYear();

for (const contract of contracts) {
  // Verificar duplicados
  const existing = await checkExistingRequests(contract.id, workMonth, workYear);
  if (existing > 0) continue;

  // Crear requests con work_month/work_year
  const requests = await createMonthlyRequests(contract, workMonth, workYear);
  
  // Crear proyecto operativo con milestones
  await createOperationalProject(contract, requests, workMonth, workYear);
}
```

#### 3. Configuración del Cron

```sql
-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Programar ejecución el día 1 de cada mes a las 00:05
SELECT cron.schedule(
  'generate-monthly-contract-requests',
  '5 0 1 * *',  -- Minuto 5, Hora 0, Día 1, Cualquier mes, Cualquier día semana
  $$
  SELECT net.http_post(
    url := 'https://zqaeokujqipntjhmbjgi.supabase.co/functions/v1/generate-monthly-requests',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ANON_KEY"}'::jsonb,
    body := '{"auto_mode": true}'::jsonb
  ) AS request_id;
  $$
);
```

#### 4. Actualizar UI de Contratos

**Archivo:** `src/components/contracts/ContractFormModal.tsx`

- Mostrar campos `work_month/work_year` en requests generados
- Indicador visual de "última generación" en contratos activos

#### 5. Filtros en Vistas

**Archivos afectados:**
- `src/pages/Solicitudes.tsx` - Añadir filtro por período de trabajo
- `src/pages/operations/OperationalProjects.tsx` - Añadir filtro por período

---

### Ejemplo de Uso Real

```text
Contrato: "Plan de Marketing Digital - ASENDIA Spain"
  └── enable_auto_requests: true
  └── Servicios mensuales:
       • Social Media Management
       • Content Creation

Día 1 de Febrero 2026:
  ├── CRON ejecuta edge function
  ├── Crea requests:
  │    • REQ-2026-045: "Social Media Management - febrero 2026"
  │    │    work_month: 2, work_year: 2026
  │    • REQ-2026-046: "Content Creation - febrero 2026"
  │         work_month: 2, work_year: 2026
  └── Crea proyecto:
       • "Plan de Marketing Digital - febrero 2026"
       • work_month: 2, work_year: 2026
       • Milestones clonados desde templates de servicios
```

---

### Archivos a Modificar/Crear

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| **Migración SQL** | Crear | Añadir `work_month/work_year` a tablas |
| `supabase/functions/generate-monthly-requests/index.ts` | Modificar | Lógica de auto-generación + proyectos |
| `src/components/contracts/ContractFormModal.tsx` | Modificar | UI para mostrar período |
| `src/pages/Solicitudes.tsx` | Modificar | Filtro por período de trabajo |
| `src/hooks/useRequestFilters.tsx` | Modificar | Añadir filtro work_month/work_year |

---

### Consideraciones Adicionales

1. **Ejecución manual**: El botón "Generar Requests" seguirá funcionando para generación bajo demanda
2. **Retrocompatibilidad**: Requests existentes tendrán `work_month = NULL` (no afecta funcionamiento)
3. **Zona horaria**: El cron usa UTC; considerar ajuste si es necesario
4. **Logs**: Añadir logging detallado para auditoría
5. **Notificaciones**: Opcionalmente enviar email al AM/PM cuando se generen automáticamente

---

### Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Generación duplicada | Verificación previa de existencia |
| Fallo del cron | Logs + alerta manual |
| Contrato expirado | Validar `end_date` antes de generar |

