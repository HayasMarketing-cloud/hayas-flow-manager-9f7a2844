

# Plan: Registro de Cobros con Conciliación de Múltiples Facturas

## Situación Actual

El sistema permite seleccionar múltiples facturas y marcarlas como "Cobradas" simultáneamente, pero:
- No se guarda referencia de la transferencia/cobro
- No hay trazabilidad del pago recibido
- No se puede consultar "qué facturas se pagaron con X transferencia"

## Propuesta: Nueva Tabla de Cobros (Payments)

Crear una entidad `payments` que represente cada abono/transferencia recibida, y vincular las facturas a ese pago.

### Nuevo Modelo de Datos

```text
┌─────────────┐     ┌─────────────────────────┐     ┌─────────────┐
│   Invoice   │◄────│   invoice_payments      │────►│   Payment   │
│             │ N:1 │   invoice_id            │ 1:N │             │
│             │     │   payment_id            │     │ amount      │
│             │     │   allocated_amount      │     │ reference   │
└─────────────┘     └─────────────────────────┘     │ payment_date│
                                                     └─────────────┘
```

### Nueva Tabla: payments

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| code | varchar | Código autogenerado (PAG-2026-001) |
| payment_date | date | Fecha del cobro/transferencia |
| amount | numeric | Importe total recibido |
| reference | text | Referencia bancaria/concepto |
| payment_method | enum | bank_transfer, credit_card, etc. |
| bank_account | text | Cuenta bancaria (opcional) |
| notes | text | Notas adicionales |
| created_at | timestamp | Fecha de registro |

### Nueva Tabla: invoice_payments

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| invoice_id | uuid | FK → invoices |
| payment_id | uuid | FK → payments |
| allocated_amount | numeric | Importe asignado de este pago a esta factura |
| created_at | timestamp | Fecha de creación |

---

## Flujo de Usuario Propuesto

### 1. Seleccionar Facturas

El usuario selecciona múltiples facturas pendientes de cobro en la tabla (como ya funciona ahora).

### 2. Registrar Cobro

Al hacer clic en "Registrar Cobro", se abre un modal mejorado:

```text
┌─────────────────────────────────────────────────────────────┐
│ Registrar Cobro                                             │
├─────────────────────────────────────────────────────────────┤
│ Facturas a conciliar:                                       │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 2025/152  │ Asendia HQ │ CON-2025-001 │ 1.207,50 €   │   │
│ │ 2025/153  │ Asendia HQ │ PRE-2025-204 │ 2.100,00 €   │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ Total facturas:          3.307,50 €                         │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ Datos del Cobro                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Fecha de cobro *        [02/02/2026        ]                │
│                                                             │
│ Importe recibido *      [3307.50           ] EUR            │
│                                                             │
│ Referencia bancaria     [TRF-ASENDIA-FEB26 ]                │
│                                                             │
│ Método de pago          [Transferencia ▼   ]                │
│                                                             │
│ Notas                   [                  ]                │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ Balance:                                                    │
│   Importe recibido:     3.307,50 €                          │
│   Total facturas:       3.307,50 €                          │
│   Diferencia:           0,00 € ✅                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│            [Cancelar]              [Registrar Cobro]        │
└─────────────────────────────────────────────────────────────┘
```

### 3. Resultado

- Se crea un registro en `payments` con el código PAG-2026-001
- Se crean N registros en `invoice_payments` vinculando cada factura
- Las facturas se marcan como `paid` con la fecha del cobro
- Se puede consultar el cobro y ver todas las facturas asociadas

---

## Vista de Cobros (Opcional - Fase 2)

Una página "Cobros" donde ver:
- Historial de todos los cobros recibidos
- Facturas asociadas a cada cobro
- Filtros por fecha, cliente, referencia

---

## Cambios por Archivo

### Base de Datos
| Cambio | Descripción |
|--------|-------------|
| Nueva tabla | `payments` - Registro de cobros recibidos |
| Nueva tabla | `invoice_payments` - Relación N:M con importes |
| Nueva secuencia | Para código PAG-YYYY-XXX |

### Nuevos Componentes
| Archivo | Descripción |
|---------|-------------|
| `src/hooks/usePayments.tsx` | Hook para gestionar pagos |
| `src/components/invoices/PaymentRegistrationModal.tsx` | Modal mejorado con datos de pago |

### Componentes a Modificar
| Archivo | Cambio |
|---------|--------|
| `BulkPaymentModal.tsx` | Reemplazar por PaymentRegistrationModal (o mejorar) |
| `Facturas.tsx` | Usar el nuevo modal |

---

## Sección Técnica

### SQL: Nuevas Tablas

```sql
-- Tabla de cobros
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reference TEXT,
  payment_method payment_method DEFAULT 'bank_transfer',
  bank_account TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relación N:M con facturas
CREATE TABLE invoice_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(invoice_id, payment_id)
);

-- Secuencia para códigos de pago
INSERT INTO sequences (name, prefix, year, current_value)
VALUES ('payment', 'PAG', EXTRACT(YEAR FROM NOW()), 0);
```

### RLS Policies

```sql
-- Payments: Finance and admin can manage
CREATE POLICY "Finance and admin can manage payments"
  ON payments FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finanzas'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finanzas'));

-- Invoice_payments: same as invoices
CREATE POLICY "Finance and admin can manage invoice_payments"
  ON invoice_payments FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finanzas'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finanzas'));
```

### Lógica del Modal

```typescript
interface PaymentRegistration {
  payment_date: string;
  amount: number;
  reference?: string;
  payment_method: 'bank_transfer' | 'credit_card' | 'stripe' | 'sdd';
  notes?: string;
  invoice_ids: string[];
}

// Al registrar:
// 1. Crear payment con código generado
// 2. Crear invoice_payments para cada factura
// 3. Actualizar invoices.status = 'paid' y paid_at
```

---

## Resumen de Cambios

| Área | Tipo | Descripción |
|------|------|-------------|
| DB | Nueva tabla | `payments` - Registro de cobros |
| DB | Nueva tabla | `invoice_payments` - Vínculo N:M con facturas |
| DB | Nueva secuencia | PAG-YYYY-XXX |
| UI | Nuevo modal | Registro de cobro con referencia y método |
| Lógica | Modificar | Vincular facturas al cobro y marcarlas como pagadas |

