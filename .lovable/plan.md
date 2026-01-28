

## Plan: Habilitar subida de factura para liquidaciones no aceptadas y auto-aceptar si coincide el importe

### Problema actual

El botón de subir factura no aparece porque el sistema solo permite subir facturas a liquidaciones con estados:
- `accepted`
- `invoice_received` 
- `pending_payment`
- `paid`

Si la liquidación está en `draft`, `validated` o `sent`, no se muestra la opción de subir factura.

---

### Cambios propuestos

#### 1. Modificar `SpecialistInvoiceUpload.tsx`

**Archivo:** `src/components/liquidations/SpecialistInvoiceUpload.tsx`

**Línea 31 - Cambiar condición `canUpload`:**

```typescript
// ANTES: Solo estados avanzados
const canUpload = ['accepted', 'invoice_received', 'pending_payment', 'paid'].includes(currentStatus);

// DESPUÉS: Permitir todos los estados excepto pagado
const canUpload = ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'].includes(currentStatus);
```

**Líneas 68-75 - Actualizar lógica de cambio de estado al subir:**

Si la liquidación NO está aceptada y se sube una factura, se actualizará automáticamente a `accepted` + `invoice_received` (pasando por ambos estados lógicamente).

---

#### 2. Modificar `SpecialistInvoiceImportModal.tsx`

**Archivo:** `src/components/liquidations/SpecialistInvoiceImportModal.tsx`

**Línea 88 - Ampliar query de liquidaciones candidatas:**

```typescript
// ANTES
.in('status', ['accepted', 'invoice_received', 'pending_payment'])

// DESPUÉS - Incluir liquidaciones pendientes de aceptar
.in('status', ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'])
```

**Líneas 263-279 - Modificar lógica de `handleConfirm`:**

Añadir lógica inteligente:

1. Si el estado es `draft`, `validated` o `sent`:
   - Comparar `subtotal` de la factura con el `total_amount` de la liquidación
   - Si coinciden (tolerancia ±1€), actualizar estado a `invoice_received` directamente (implica aceptación automática)
   - Si no coinciden, solo actualizar a `invoice_received` pero mostrar advertencia

2. Si el estado ya es `accepted`:
   - Comportamiento actual (solo cambiar a `invoice_received`)

---

### Flujo propuesto

```text
Factura subida
      │
      ▼
¿Estado actual de liquidación?
      │
      ├── draft / validated / sent
      │         │
      │         ▼
      │   ¿Importe neto factura ≈ total liquidación?
      │         │
      │         ├── SÍ → Estado = 'invoice_received' + mensaje "Aceptada automáticamente"
      │         │
      │         └── NO → Estado = 'invoice_received' + advertencia de discrepancia
      │
      └── accepted
               │
               ▼
         Estado = 'invoice_received' (comportamiento actual)
```

---

### Comparación de importes

Se usará el campo `subtotal` de la factura extraída (base imponible antes de impuestos) comparado con `subtotal` de la liquidación:

```typescript
// Tolerancia de 1€ para redondeos
const amountsMatch = Math.abs(extractedData.subtotal - selectedLiquidation.subtotal) <= 1;
```

Usamos `subtotal` porque es el "neto" real del trabajo, sin incluir IVA ni retenciones IRPF.

---

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/liquidations/SpecialistInvoiceUpload.tsx` | Ampliar `canUpload` y lógica de estado |
| `src/components/liquidations/SpecialistInvoiceImportModal.tsx` | Ampliar query de estados + lógica de auto-aceptación |

---

### Detalles técnicos de implementación

#### En `SpecialistInvoiceUpload.tsx`:

```typescript
// Línea 31
const canUpload = !['paid'].includes(currentStatus); // Todo excepto pagado

// Líneas 68-80 - Nueva lógica
const updateData: { specialist_invoice_url: string; status?: LiquidationStatus } = {
  specialist_invoice_url: publicUrlData.publicUrl,
};

// Si está en estados previos a aceptación, pasar directamente a invoice_received
if (['draft', 'validated', 'sent'].includes(currentStatus)) {
  updateData.status = 'invoice_received';
} else if (currentStatus === 'accepted') {
  updateData.status = 'invoice_received';
}
```

#### En `SpecialistInvoiceImportModal.tsx`:

```typescript
// Línea 88 - Query ampliada
.in('status', ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'])

// Líneas 263-290 - Lógica mejorada en handleConfirm
const selectedLiq = liquidations?.find(l => l.id === selectedLiquidationId);
const updateData: { specialist_invoice_url: string; status?: LiquidationStatus } = {
  specialist_invoice_url: publicUrlData.publicUrl,
};

// Determinar nuevo estado
if (['draft', 'validated', 'sent'].includes(selectedLiq?.status || '')) {
  // Verificar si importes coinciden
  const amountsMatch = Math.abs((extractedData?.subtotal || 0) - (selectedLiq?.total_amount || 0)) <= 1;
  
  updateData.status = 'invoice_received';
  
  if (amountsMatch) {
    toast.success('Liquidación aceptada automáticamente - importes coinciden');
  } else {
    toast.warning(`Atención: El importe de la factura (${formatCurrency(extractedData?.subtotal || 0)}) difiere de la liquidación (${formatCurrency(selectedLiq?.total_amount || 0)})`);
  }
} else if (selectedLiq?.status === 'accepted') {
  updateData.status = 'invoice_received';
}
```

---

### Resultado esperado

1. **Visibilidad del botón**: El botón de subir factura aparecerá para todas las liquidaciones excepto las ya pagadas
2. **Subida sin restricciones**: Se podrá subir factura aunque la liquidación no esté aceptada
3. **Auto-aceptación inteligente**: Si el importe neto coincide, la liquidación pasará automáticamente a `invoice_received` (lo que implica aceptación)
4. **Advertencia de discrepancias**: Si los importes no coinciden, se mostrará un aviso pero se permitirá continuar

