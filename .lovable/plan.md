

# Plan: Asociar Datos de Proyecto/Presupuesto/Contrato a Facturas

## Situación Actual

Las columnas **Proyecto**, **Presupuesto** y **Contrato** están creadas pero muestran "---" porque:
1. Las facturas no tienen `financial_requests` vinculadas (`billed_invoice_id`)
2. El sistema actual solo extrae: código, cliente, fechas e importes del PDF
3. No se extraen referencias a proyectos, presupuestos o contratos

---

## Datos Disponibles

| Fuente | Datos | Uso Potencial |
|--------|-------|---------------|
| **PDF de factura** | Líneas de servicio (descripciones) | Matching con nombres de proyectos/presupuestos |
| **Cliente detectado** | `client_id` | Filtrar contratos/presupuestos/proyectos del cliente |
| **Base de datos** | Contratos activos por cliente | Sugerir contrato si hay uno único activo |
| **Base de datos** | Presupuestos aprobados por cliente | Matching por nombre/período |
| **Base de datos** | Proyectos operativos activos | Matching por nombre de proyecto |

---

## Estrategias Propuestas

### Estrategia 1: Vinculación Manual con Sugerencias Inteligentes (Recomendada)

**Descripción:**
Añadir campos de selección de Contrato/Presupuesto/Proyecto en el modal de importación, con sugerencias automáticas basadas en:
- Cliente detectado
- Fechas de la factura
- Palabras clave en las líneas de factura

**Ventajas:**
- Control total del usuario
- Reducción de errores
- Se puede implementar incrementalmente

**Implementación:**
1. Añadir 3 selectores opcionales en `ExtractedInvoiceRow`
2. Pre-filtrar opciones por cliente
3. Destacar sugerencias más probables

---

### Estrategia 2: Extracción AI Mejorada del PDF

**Descripción:**
Modificar el prompt de Gemini para que extraiga también:
- Referencia a proyecto (si aparece en la factura)
- Código de presupuesto (si aparece)
- Nombre del contrato/acuerdo

Luego hacer matching fuzzy con los datos existentes.

**Ventajas:**
- Automatización máxima
- Funciona si las facturas mencionan el proyecto/contrato

**Desventajas:**
- Depende de que la información esté en el PDF
- Más complejo de implementar

---

### Estrategia 3: Vinculación Automática por Reglas de Negocio

**Descripción:**
Si un cliente tiene un único contrato activo, auto-asignarlo. 
Si hay un único presupuesto aprobado en el período de la factura, auto-asignarlo.

**Datos observados:**
| Cliente | Contratos Activos |
|---------|-------------------|
| ASENDIA HQ | 1 (HubSpot Requests) |
| Asendia Spain | 1 (Plan Marketing Digital) |
| Formato Educativo | 2 (HS Management, Mantenimiento) |

**Ventajas:**
- Simple de implementar
- Funciona bien para clientes con un solo contrato

---

## Plan de Implementación Recomendado

Combinar las 3 estrategias en orden de prioridad:

### Fase 1: Vinculación Manual con Pre-filtrado (Inmediata)

**Cambios en `ExtractedInvoiceRow.tsx`:**

1. Añadir 3 nuevos campos editables:
   - **Contrato** (Select) - Filtrado por `client_id` + estado "active"
   - **Presupuesto** (Select) - Filtrado por `client_id` + estado "approved"
   - **Proyecto** (Select) - Filtrado por `client_id` + estado != "completed"

2. Pasar datos adicionales al modal:
   ```typescript
   // En InvoiceUploadModal.tsx
   const { data: contracts } = useQuery({
     queryKey: ['contracts-active'],
     queryFn: async () => supabase.from('contracts').select('id, title, code, client_id').eq('status', 'active')
   });
   ```

3. Pre-seleccionar si hay único match:
   - Si cliente tiene 1 contrato activo → auto-seleccionar
   - Si tiene 1 presupuesto aprobado → sugerirlo

4. Guardar relación al importar:
   - Almacenar en campos nuevos de `invoices` o crear relación indirecta

### Fase 2: Extracción AI Mejorada (Posterior)

Modificar prompt de `extract-invoice-data`:

```typescript
{
  // ... existing fields ...
  "project_reference": "nombre o código del proyecto si aparece en la factura",
  "budget_reference": "código de presupuesto si aparece (ej: PRE-2025-XXX)",
  "contract_reference": "referencia al contrato o acuerdo si aparece"
}
```

Hacer matching fuzzy con base de datos después de la extracción.

---

## Cambios de Base de Datos Necesarios

**Opción A: Añadir campos directos a `invoices`**
```sql
ALTER TABLE invoices 
ADD COLUMN contract_id uuid REFERENCES contracts(id),
ADD COLUMN budget_id uuid REFERENCES budgets(id),
ADD COLUMN operational_project_id uuid REFERENCES operational_projects(id);
```

**Opción B: Mantener relación indirecta (actual)**
Las facturas se vinculan a través de `financial_requests.billed_invoice_id`, manteniendo el modelo actual donde las facturas agrupan solicitudes.

**Recomendación:** Opción B para mantener consistencia. La vinculación se haría:
1. Usuario selecciona contrato/presupuesto al importar
2. Sistema crea/vincula `financial_requests` correspondientes
3. Columnas de la tabla se llenan automáticamente

---

## Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/invoices/InvoiceUploadModal.tsx` | Añadir queries de contratos, presupuestos, proyectos |
| `src/components/invoices/ExtractedInvoiceRow.tsx` | Añadir 3 selectores con pre-filtrado por cliente |
| `supabase/functions/extract-invoice-data/index.ts` | (Fase 2) Mejorar prompt para extraer referencias |

---

## Vista Previa del Flujo

```text
┌─────────────────────────────────────────────────────────────────┐
│  Importar Facturas - Revisar Datos Extraídos                    │
├─────────────────────────────────────────────────────────────────┤
│ Código  │ Cliente         │ Contrato      │ Presupuesto │ Fecha │
├─────────────────────────────────────────────────────────────────┤
│ 2026/8  │ ▼ ASENDIA HQ    │ ▼ HubSpot Req │ ▼ (ninguno) │ 08/01 │
│         │                 │   ✓ sugerido  │             │       │
├─────────────────────────────────────────────────────────────────┤
│ 2026/9  │ ▼ CONNECTIF     │ ▼ (ninguno)   │ ▼ PRE-2026..│ 23/01 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportamiento:**
- Si el cliente tiene 1 contrato activo → se pre-selecciona con badge "sugerido"
- Si hay múltiples → dropdown vacío, usuario elige
- Si no hay ninguno → se muestra "---"

