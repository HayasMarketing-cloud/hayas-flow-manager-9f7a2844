## Plantillas recurrentes + Precio al Cliente contextual

### Modelo

- **Contrato** = qué se factura al cliente (fees fijos vigentes + líneas horarias facturables tipo Antonio Foruria / Asendia HQ).
- **Request** = trabajo real del especialista (horas + coste). Puede marcarse como **plantilla recurrente** para que se clone cada mes.
- **Precio al Cliente** en la request solo aparece cuando aporta valor (no en retainers fijos).

### 1. Migración DB

```sql
ALTER TABLE financial_requests
  ADD COLUMN is_recurring_template boolean NOT NULL DEFAULT false,
  ADD COLUMN recurrence_active boolean NOT NULL DEFAULT true,
  ADD COLUMN template_source_id uuid REFERENCES financial_requests(id),
  ADD COLUMN bill_separately boolean NOT NULL DEFAULT false;

CREATE INDEX idx_fr_recurring_templates
  ON financial_requests(contract_id, is_recurring_template, recurrence_active)
  WHERE is_recurring_template = true;
```

- `is_recurring_template`: request maestra (no se factura ni ejecuta).
- `recurrence_active`: permite pausar sin borrar.
- `template_source_id`: trazabilidad del clon a la plantilla.
- `bill_separately`: escape hatch para facturar una request aparte del fee fijo del contrato.

### 2. Backend — Edge functions

**`generate-monthly-requests`** — refactor: pasa a leer `financial_requests` plantilla en vez de `contract_services`.

```
SELECT * FROM financial_requests
WHERE is_recurring_template=true
  AND recurrence_active=true
  AND contract.status='active'
  [AND contract_id = :contract_id]   -- modo manual
```

Por cada plantilla: clona campos (specialist, service, hours, cost_rate, fixed_cost, cost_to_agency, sale_amount, sale_rate, project_type, notes, bill_separately), sobrescribe `status='draft'`, `work_month/year=M/Y`, `title='{plantilla.title} - {mes año}'`, `template_source_id=plantilla.id`, `is_recurring_template=false`, `code=''`. Duplicate guard por `template_source_id + work_month + work_year`. Crea proyecto operacional y milestones agrupando por contrato (lógica existente).

**`generate-draft-invoices`** — simplificación: elimina la rama del flag `bills_variable_requests`. Factura = líneas fijas vigentes del contrato + `sale_amount` de requests del mes donde `is_recurring_template=false`. Como las plantillas de retainers tendrán `sale_amount=0`, sus clones no inflan la factura.

### 3. UI — `RequestFormModal` y vistas

**A) Bloque "Recurrencia"** (solo si la request tiene `contract_id`):
- Toggle "Hacer recurrente cada mes" → `is_recurring_template`.
- Si activa: toggle "Recurrencia activa" → `recurrence_active`.
- Banner explicativo: "Esta request se clonará automáticamente cada mes el día 1".

**B) Bloque "Precio al Cliente" condicional**:

Cargar contrato + contract_services al abrir el modal. Reglas:

```
caso A — Contrato con línea fixed/monthly vigente:
  Ocultar bloque. Mostrar aviso:
  "Incluido en el fee mensual del contrato ({fee}€/mes). 
   sale_amount = 0."
  Botón discreto "Facturar esta request aparte" → activa bill_separately
  y revela el bloque editable.

caso B — Contrato con contract_service hourly_to_client del mismo servicio:
  Mostrar bloque readonly. Auto-derivar:
    sale_type = 'hourly'
    sale_rate = contract_service.price_value
    sale_amount = hours * sale_rate
  Aviso: "Tarifa heredada del contrato ({rate}€/h)".

caso C — Request vinculada a budget_id:
  Comportamiento actual (auto-rellena de la línea del budget).

caso D — Sin contrato ni budget:
  Bloque editable normal (manual).
```

**C) Badges y listados**:
- `RequestCard` / `RequestTableView`: badge "Plantilla" si `is_recurring_template`, badge "Pausada" si `recurrence_active=false`.
- Si la request tiene `template_source_id`, mostrar link "Generada desde plantilla" en el detalle.

**D) `ContractFormModal`**: ocultar campos `enable_auto_requests` y `bills_variable_requests` (deprecated; columnas se quedan por rollback).

### 4. Datos (insert tool, post-migración)

Crear 5 requests plantilla en CON-2025-004 (Asendia Spain) clonando las de mayo 2026:

| Especialista | Servicio | hours | cost_type | cost_rate | fixed_cost | cost_to_agency |
|---|---|---|---|---|---|---|
| Agustín Alzamora | Creación de post para Blog | 6 | hourly | 30 | – | 180 |
| Tomás White | Gestión CRM e Email Marketing | 2 | hourly | 30 | – | 60 |
| Fátima Barrouz | Gestión de Redes Sociales | – | fixed | – | 200 | 200 |
| Iolanda Carbone | Gestión y coordinación proyecto | 1 | hourly | 30 | – | 30 |
| Sandra Vásquez | Creación/Edición de documentos | 1 | hourly | 30 | – | 30 |

Para todas: `is_recurring_template=true`, `recurrence_active=true`, `sale_amount=0`, `sale_rate=0`, `work_month=NULL`, `work_year=NULL`, `status='draft'`, título sin "- mayo de 2026".

### 5. Validación

1. Dry-run `generate-monthly-requests` para junio 2026 con `contract_id=CON-2025-004` → comprobar 5 requests draft + proyecto + milestones.
2. Dry-run `generate-draft-invoices` junio 2026 → Asendia Spain debe salir **1.410€** (no se suman los 500€ de coste).
3. Abrir una request clonada y verificar que el bloque "Precio al Cliente" muestra el aviso de fee incluido y no es editable.

### Fuera de alcance

- Plantillas para otros retainers puros (NOVA, Parrón, PID, Formato Educativo HS Management): no se trackea trabajo recurrente de especialista; siguen como están.
- Antonio Foruria / Asendia HQ HubSpot Requests: requests manuales mes a mes (caso B), tarifa heredada del contrato.
- Drop de columnas `enable_auto_requests` / `bills_variable_requests`: se dejan en DB.

### Orden de implementación

1. Migración (4 columnas nuevas + índice).
2. Refactor `generate-monthly-requests`.
3. Refactor `generate-draft-invoices` (quitar rama del flag).
4. UI: bloque Recurrencia, Precio al Cliente condicional, badges, limpieza ContractFormModal.
5. Insert tool: 5 plantillas Asendia Spain.
6. Validación junio 2026.
