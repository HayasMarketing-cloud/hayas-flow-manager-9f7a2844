
## Plan: Formulario de Request Simplificado con Tarifas Automáticas

### Análisis de Impacto en Datos Existentes

Tras revisar la base de datos actual, se han identificado estos patrones:

#### Datos actuales de requests

| Categoría | Cantidad | Descripción |
|-----------|----------|-------------|
| Requests con sale_type=fixed, cost_type=hourly | 105 | Mayoría - vienen de presupuestos o contratos |
| Requests con sale_type=fixed, cost_type=fixed | 23 | Proyectos con coste fijo |
| Requests con sale_type=hourly, cost_type=hourly | 23 | Vienen de contratos con facturación por hora |
| Sin sale_amount (0 o null) | 49 | **PROBLEMA**: falta precio de venta |
| Con cost_to_agency calculado | 142 | La mayoría tiene coste calculado |

#### Problema identificado: Requests sin precio de venta

Se encontraron 49 requests con `sale_amount = 0`:
- **REQ-2026-148**: `sale_type=hourly`, tiene `sale_rate=70` pero `sale_hours=null` → sale_amount=0
- **REQ-2026-145**: `sale_type=fixed`, tiene `unit_price=null` → sale_amount=0
- Varios de presupuestos antiguos con `unit_price=0` en los items originales

**Estos datos ya existen** y el cambio propuesto no los afecta directamente. El problema de sale_amount=0 viene de:
1. Requests creados manualmente sin rellenar el precio
2. Budget items sin precio unitario definido
3. Requests hourly sin horas de venta asignadas

#### Impacto del cambio propuesto

| Componente | Impacto | Acción necesaria |
|------------|---------|------------------|
| Requests existentes | **Ninguno** | Los datos existentes no se modifican |
| useApproveBudget | **Ninguno** | Ya calcula sale_amount desde budget_items.total |
| generate-monthly-requests | **Ninguno** | Ya usa contract_services.price_value |
| AddRequestsToLiquidationModal | **Ninguno** | Lee cost_to_agency existente |
| AddToInvoiceModal | **Ninguno** | Lee sale_amount existente |
| useEntityPnL | **Ninguno** | Lee campos calculados existentes |

**Conclusión**: El cambio solo afecta a la CREACIÓN de nuevos requests manuales. Los flujos automáticos (desde presupuestos y contratos) ya funcionan correctamente.

---

### Solución: Simplificar solo la creación manual

El formulario de creación de request se simplifica eliminando los campos de tarifa, que se calcularán automáticamente. El formulario de edición mantiene todos los campos para correcciones.

#### Comportamiento por modo

| Campo | Crear | Editar |
|-------|-------|--------|
| Tipo de venta (hourly/fixed) | Visible | Visible |
| Horas a facturar (sale_hours) | Visible si hourly | Visible si hourly |
| Tarifa hora (sale_rate) | **Oculto** - auto-calculado | Visible |
| Precio unitario (unit_price) | Visible si fixed | Visible si fixed |
| Tipo de coste (hourly/fixed) | Visible | Visible |
| Horas especialista (hours) | Visible si hourly | Visible si hourly |
| Tarifa hora coste (cost_rate) | **Oculto** - auto-calculado | Visible |
| Coste fijo (fixed_cost) | Visible si fixed | Visible si fixed |

---

### Cambios a realizar

#### 1. Migración de base de datos

Añadir campo `default_hourly_rate` a la tabla `clients`:

```sql
ALTER TABLE clients 
ADD COLUMN default_hourly_rate numeric DEFAULT NULL;

COMMENT ON COLUMN clients.default_hourly_rate IS 
  'Tarifa por hora por defecto para facturación. Se usa cuando no hay precio definido en contrato.';

-- Poblar el dato para clientes Asendia
UPDATE clients 
SET default_hourly_rate = 70 
WHERE name ILIKE '%ASENDIA%';
```

#### 2. Nuevo hook: useDefaultRates.tsx

Hook que calcula las tarifas sugeridas según esta jerarquía:

**Tarifa de venta (sale_rate)**:
1. `contract_services.price_value` (si hay contrato + servicio + especialista y `price_rule_type = 'hourly'`)
2. `clients.default_hourly_rate` (tarifa por defecto del cliente)
3. Fallback: 50€/h

**Tarifa de coste (cost_rate)**:
1. `specialists.hourly_rate` (ya existe y está poblado para la mayoría)
2. Fallback: 30€/h

```typescript
interface RateSuggestion {
  saleRate: number;
  saleRateSource: 'contract' | 'client' | 'fallback';
  costRate: number;
  costRateSource: 'specialist' | 'fallback';
}

export const useDefaultRates = (
  clientId: string | null,
  contractId: string | null,
  serviceId: string | null,
  specialistId: string | null
): UseQueryResult<RateSuggestion>
```

#### 3. Modificar RequestFormModal.tsx

- Añadir prop `mode` que ya existe (`'create' | 'edit' | 'view'`)
- En modo **create**: 
  - Ocultar campos `sale_rate` y `cost_rate`
  - Mostrar mensaje informativo: "Se aplicará tarifa de X€/h de [origen]"
  - Calcular y guardar automáticamente al submit
- En modo **edit**: 
  - Mostrar todos los campos como ahora
  - Permitir modificar tarifas manualmente

Lógica de submit en modo create:
```typescript
// Si es hourly y no hay sale_rate, usar la sugerida
if (data.sale_type === 'hourly' && !data.sale_rate) {
  data.sale_rate = defaultRates.saleRate;
}
if (data.cost_type === 'hourly' && !data.cost_rate) {
  data.cost_rate = defaultRates.costRate;
}
```

#### 4. Gestión de tarifa por defecto del cliente

**SimplifiedClientForm.tsx**: Añadir campo "Tarifa hora por defecto"
```typescript
default_hourly_rate: z.coerce.number().min(0).optional().nullable(),
```

**ClienteDetalle.tsx**: Mostrar la tarifa configurada en el resumen del cliente

---

### Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `src/hooks/useDefaultRates.tsx` | Hook que calcula tarifas sugeridas según jerarquía |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/modals/RequestFormModal.tsx` | Ocultar campos tarifa en modo create, mostrar en edit |
| `src/components/forms/SimplifiedClientForm.tsx` | Añadir campo default_hourly_rate |
| `src/pages/ClienteDetalle.tsx` | Mostrar tarifa por defecto del cliente |

---

### Verificación de especialistas

Los especialistas activos ya tienen `hourly_rate` definido:

| Especialista | Tarifa |
|--------------|--------|
| Ebelyn Toapanta | 30€ |
| Iolanda Carbone | 30€ |
| Sandra Vásquez | 30€ |
| Styng Arias | 50€ |
| WOLFESTONE | 0€ (partner externo) |
| César Bela | 0€ (necesita actualizar) |

**Nota**: Algunos especialistas tienen tarifa 0€. El sistema usará el fallback de 30€/h para estos casos.

---

### Flujo visual en el formulario

**Modo CREAR (simplificado)**:
```text
┌─────────────────────────────────────────────────────────────┐
│  CREAR NUEVO REQUEST                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Cliente: [ASENDIA HQ                           ▼]         │
│  Especialista: [Iolanda Carbone                 ▼]         │
│                                                             │
│  ── Precio al Cliente ─────────────────────────────────────│
│                                                             │
│  Tipo: (•) Por hora  ( ) Precio fijo                       │
│                                                             │
│  Horas a facturar: [ 2 ]                                   │
│                                                             │
│  (i) Se aplicará tarifa de 70€/h de ASENDIA HQ             │
│  Importe estimado: 140,00 €                                │
│                                                             │
│  ── Coste para la Agencia ─────────────────────────────────│
│                                                             │
│  Tipo: (•) Por hora  ( ) Coste fijo                        │
│                                                             │
│  Horas del especialista: [ 2 ]                             │
│                                                             │
│  (i) Se aplicará tarifa de 30€/h de Iolanda Carbone        │
│  Coste estimado: 60,00 €                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Modo EDITAR (completo)**:
```text
┌─────────────────────────────────────────────────────────────┐
│  EDITAR REQUEST REQ-2026-148                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ── Precio al Cliente ─────────────────────────────────────│
│                                                             │
│  Tipo: (•) Por hora  ( ) Precio fijo                       │
│                                                             │
│  Horas a facturar: [ 2 ]                                   │
│  Tarifa por hora:  [ 70,00 ] €  ← VISIBLE y editable       │
│                                                             │
│  Importe venta: 140,00 €                                   │
│                                                             │
│  ── Coste para la Agencia ─────────────────────────────────│
│                                                             │
│  Tipo: (•) Por hora  ( ) Coste fijo                        │
│                                                             │
│  Horas especialista: [ 2 ]                                 │
│  Tarifa por hora:    [ 30,00 ] €  ← VISIBLE y editable     │
│                                                             │
│  Coste total: 60,00 €                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Beneficios

1. **Creación más rápida**: Solo hay que introducir las horas, no las tarifas
2. **Menos errores**: Las tarifas correctas se aplican automáticamente
3. **Flexibilidad total**: Siempre se puede editar posteriormente
4. **Datos centralizados**: Tarifas en cliente y especialista, no dispersas
5. **Sin impacto en datos existentes**: Los requests actuales no se modifican
6. **Compatible con flujos automáticos**: Presupuestos y contratos siguen funcionando igual
