

# Plan: Comisiones Basadas en Facturas Emitidas

## Workflow Real Capturado

El flujo de comisiones AM/PM se basa en **facturas ya emitidas**, no en presupuestos estimados:

```
1. Emites una o varias facturas a un cliente
2. Seleccionas la(s) factura(s) 
3. El sistema sugiere el importe base (subtotal de las facturas)
4. Puedes editar el importe antes de calcular
5. Aplicas el porcentaje de comisión
6. Se genera la comisión para AM y/o PM
```

---

## Cambios en el Esquema de Base de Datos

### Nueva tabla: `sales_commissions`

```sql
CREATE TABLE public.sales_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo de comisión
  commission_type TEXT NOT NULL CHECK (commission_type IN ('sales', 'am', 'pm')),
  
  -- Beneficiario
  seller_user_id UUID NOT NULL,
  
  -- Origen de entidad (proyecto/presupuesto/contrato)
  contract_id UUID REFERENCES contracts(id),
  budget_id UUID REFERENCES budgets(id),
  
  -- NUEVO: Facturas sobre las que se calcula
  invoice_ids UUID[] DEFAULT '{}',  -- Array de IDs de facturas
  
  -- Cálculo
  base_amount NUMERIC NOT NULL DEFAULT 0,      -- Editable: puede diferir del subtotal
  commission_percentage NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Cambio clave**: Campo `invoice_ids` (array) para vincular comisiones con las facturas base.

---

## Interfaz de Nueva Comisión (Mejorada)

### Paso 1: Seleccionar tipo y beneficiario

```
┌──────────────────────────────────────────────────────────────────┐
│ Nueva Comisión                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Tipo de comisión:  [AM ▼]     Beneficiario:  [Iolanda ▼]        │
│                                                                  │
│ Origen (proyecto/presupuesto):  [ePAQ GO Translations ▼]        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Paso 2: Seleccionar facturas base

```
┌──────────────────────────────────────────────────────────────────┐
│ Facturas base para el cálculo:                                   │
├──────────────────────────────────────────────────────────────────┤
│ ☑ 2026/4 - Asendia Spain - 1.410,00 € (27 ene 2026)             │
│ ☑ 2026/7 - Asendia HQ - 280,00 € (25 ene 2026)                  │
│ ☐ 2026/8 - Asendia HQ - 1.403,62 € (24 ene 2026)                │
├──────────────────────────────────────────────────────────────────┤
│ Subtotal facturas seleccionadas: 1.690,00 €                      │
└──────────────────────────────────────────────────────────────────┘
```

### Paso 3: Calcular comisión (con importe editable)

```
┌──────────────────────────────────────────────────────────────────┐
│ Cálculo de comisión:                                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Importe base:    [ 1.690,00 ] €   ← Editable                    │
│ Porcentaje:      [    5,00 ] %    ← Editable                    │
│                    ────────────                                  │
│ Comisión:            84,50 €      ← Calculado automáticamente   │
│                                                                  │
│ Notas: [                                              ]          │
│                                                                  │
│ [Cancelar]                              [Guardar Comisión]       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Flujo para AM y PM Simultáneos

Cuando el proyecto tiene AM y PM distintos:

```
┌──────────────────────────────────────────────────────────────────┐
│ Generar comisiones para: ePAQ GO Translations                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ AM: Iolanda      PM: Rubén                                       │
│                                                                  │
│ Facturas seleccionadas: 1.690,00 €                               │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ ☑ Comisión AM (Iolanda)                                    │   │
│ │   Importe base: [ 1.690,00 ] €   Porcentaje: [ 5 ] %       │   │
│ │   Comisión: 84,50 €                                        │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ ☑ Comisión PM (Rubén)                                      │   │
│ │   Importe base: [ 1.690,00 ] €   Porcentaje: [ 5 ] %       │   │
│ │   Comisión: 84,50 €                                        │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ Total comisiones: 169,00 €                                       │
│                                                                  │
│ [Cancelar]                         [Generar 2 comisiones]        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

### 1. Crear migración SQL
Añadir campo `invoice_ids` a la tabla `sales_commissions`

### 2. `src/components/commissions/CommissionFormModal.tsx`
- Añadir selector múltiple de facturas
- Mostrar subtotal de facturas seleccionadas
- Permitir editar importe base antes de calcular
- Añadir campo `commission_type` (sales, am, pm)

### 3. `src/pages/Comisiones.tsx`
- Mostrar columna "Facturas" con códigos vinculados
- Filtro por tipo de comisión

### 4. Nueva feature: Generación conjunta AM+PM
- Botón "Generar comisiones AM/PM" desde el detalle de proyecto
- Seleccionar facturas una vez, generar ambas comisiones

---

## Beneficios del Enfoque

| Aspecto | Beneficio |
|---------|-----------|
| **Trazabilidad** | Cada comisión queda vinculada a facturas específicas |
| **Flexibilidad** | El importe base es editable (por si hay descuentos, ajustes, etc.) |
| **Auditoría** | Se puede ver qué facturas generaron qué comisiones |
| **Workflow real** | Coincide con cómo realmente se calculan las comisiones |
| **P&L preciso** | Las comisiones reflejan ingresos reales, no estimados |

---

## Resumen de Cambios

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| Migración SQL | Nuevo | Crear tabla `sales_commissions` con campo `invoice_ids` |
| `CommissionFormModal.tsx` | Modificar | Añadir selector de facturas e importe editable |
| `Comisiones.tsx` | Modificar | Mostrar facturas vinculadas y filtro por tipo |
| `useEntityPnL.tsx` | Modificar | Sumar comisiones al P&L del proyecto |

