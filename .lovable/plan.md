# Plan: Fee mensual con vigencia editable + refactor borrador de facturas

## Contexto

Las facturas borrador (junio 2026) no coinciden con las reales porque `generate-draft-invoices` solo suma `sale_amount` de requests completados, sin contemplar contratos con **fee mensual fijo pactado** (Asendia Spain 1.410€, Formato Educativo HS Management 280€, NOVA PRAXIS 450€, Raúl Parrón 350€, PID 55€).

## Decisiones confirmadas

- Sin nuevo campo `billing_model` en `contracts` — modelo derivado de `contract_services`.
- **Fee mensual con vigencia editable**: cada línea fija añade `valid_from` y `valid_to` (ambos NULL al alta; el usuario los rellena en cada contrato).
- Antonio Foruria es **variable puro** (horas × precio/hora coincide para coste y precio, como Asendia HQ HubSpot Requests).
- **Único contrato mixto**: Formato Educativo (línea fija 280€ + línea horaria heredada → se fusionará).
- En la factura, **líneas separadas**: una por componente fijo + una consolidada variable.
- Una factura por contrato.

## Cambios

### 1. Migration: extender `contract_services` con vigencia

```sql
ALTER TABLE public.contract_services
  ADD COLUMN valid_from date,
  ADD COLUMN valid_to date;
```

- `valid_from` (NULL = sin restricción de inicio).
- `valid_to` (NULL = indefinido).
- Solo relevante para líneas `price_rule_type='fixed' AND billing_frequency='monthly'`.

### 2. UI: `ContractServicesEditor`

Cuando la línea es `fixed + monthly`, añadir dos date pickers:
- "Inicio fee" (`valid_from`)
- "Fin fee" (`valid_to`, opcional)

Ocultos para líneas horarias u otras frecuencias. Ambos vacíos por defecto — el usuario rellena por contrato.

### 3. Refactor `generate-draft-invoices/index.ts`

Para cada contrato `active` y mes objetivo (Y, M):

**A) Componente fijo** — para cada línea con `price_rule_type='fixed' AND billing_frequency='monthly'`:
- Vigente si: `(valid_from IS NULL OR valid_from <= último día del mes)` Y `(valid_to IS NULL OR valid_to >= primer día del mes)`.
- Genera 1 `invoice_item` por línea: `"{servicio o descripción} – {Mes Año}"`, `unit_price = price_value * quantity`.

**B) Componente variable** (lógica actual):
- Suma `sale_amount` de `financial_requests` completados no facturados del mes.
- Genera 1 `invoice_item` consolidado: `"{contract.title} – consumo {Mes Año} ({Xh})"`.
- Marca `billed_invoice_id` en esos requests (las líneas fijas NO marcan requests).

**Reglas:**
- Si fijo > 0 OR variable > 0 → crear factura.
- Si no hay líneas fijas vigentes y no hay requests → no se crea factura.

### 4. Data seeding (insert tool)

Crear línea `fixed/monthly` por retainer, con `valid_from`/`valid_to` en NULL (el usuario los rellenará desde UI):

| Cliente | Contrato | Importe |
|---|---|---|
| Asendia Spain | CON-2025-004 | 1.410 € |
| Formato Educativo | CON-2025-002 | 280 € |
| NOVA PRAXIS | CON-2026-002 | 450 € |
| Raúl Parrón | CON-2026-004 | 350 € |
| PID Medioambiental | CON-2025-005 | 55 € |

Verificar `enable_auto_requests` en Asendia Spain: si genera requests con tarifa horaria que se sumarían además al fijo, desactivarlo para evitar duplicado.

### 5. Fusión Formato Educativo (único caso mixto)

```sql
-- Mover línea horaria de CON-2025-003 → CON-2025-002
UPDATE contract_services SET contract_id='<CON-2025-002>' WHERE contract_id='<CON-2025-003>';
UPDATE financial_requests SET contract_id='<CON-2025-002>' WHERE contract_id='<CON-2025-003>';
UPDATE operational_requests SET contract_id='<CON-2025-002>' WHERE contract_id='<CON-2025-003>';
UPDATE contracts SET title='HS Management + Mantenimiento HubSpot' WHERE id='<CON-2025-002>';
UPDATE contracts SET status='expired' WHERE id='<CON-2025-003>';
```

CON-2025-002 quedará: 1 línea fija 280€/mes + 1 línea horaria 55€/h. La factura mensual mostrará ambas líneas.

## Orden de implementación

1. Migration: añadir `valid_from`/`valid_to` a `contract_services`.
2. UI: extender `ContractServicesEditor` con date pickers condicionales.
3. Insert tool: crear líneas fijas para los 5 retainers (valid_from/to en NULL) + fusión Formato Educativo.
4. Refactor edge function `generate-draft-invoices`.
5. Dry-run junio 2026 y comparar con facturas reales.

## Validación esperada (junio 2026)

- Antonio Foruria 1.540 € (variable puro)
- ASENDIA HQ HubSpot Requests 770 € (variable, no 561)
- Formato Educativo 280 € fijo + variable horaria
- Asendia Spain 1.410 € (fijo, no suma horas)
- NOVA PRAXIS 450 €, Raúl Parrón 350 €, PID 55 € (fijos)
- Presupuestos con hitos del mes (lógica actual intacta)

## Fuera de alcance

- `create-b2brouter-invoice` (ya usa `sale_amount` desde `invoice_items`).
- `generate-monthly-requests` (ortogonal).
- Lógica de presupuestos / `payment_plan` / `estimated_invoice_date`.