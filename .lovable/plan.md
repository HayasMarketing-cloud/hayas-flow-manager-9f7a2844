
## Plan: Mostrar botón de subir factura para liquidaciones en estados tempranos

### Problema identificado

El componente `SpecialistInvoiceUpload` fue modificado correctamente para permitir uploads en estados `draft`, `validated`, `sent`, etc. (línea 31).

**Sin embargo**, en `LiquidacionDetalle.tsx` (línea 706) hay una condición adicional que impide que el componente se renderice:

```tsx
{canAccessFinance() && ['accepted', 'invoice_received', 'pending_payment', 'paid'].includes(liquidation.status) && (
```

Esta condición **solo muestra** el upload para estados `accepted` en adelante, ignorando la lógica interna del componente.

### Cambio requerido

**Archivo:** `src/pages/LiquidacionDetalle.tsx`

**Línea 706 - Modificar condición:**

| Antes | Después |
|-------|---------|
| `['accepted', 'invoice_received', 'pending_payment', 'paid'].includes(liquidation.status)` | `['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'].includes(liquidation.status)` |

Se excluye `paid` porque no tiene sentido subir factura a una liquidación ya pagada.

### Código corregido

```tsx
{/* Specialist Invoice Upload - Para todos los estados excepto pagado */}
{canAccessFinance() && ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'].includes(liquidation.status) && (
  <div className="space-y-3">
    <SpecialistInvoiceUpload
      liquidationId={liquidation.id}
      liquidationCode={liquidation.code}
      currentInvoiceUrl={liquidation.specialist_invoice_url}
      currentStatus={liquidation.status}
      onUploadSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
        queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      }}
    />
    {!liquidation.specialist_invoice_url && (
      <Button 
        variant="outline" 
        className="w-full" 
        onClick={() => setImportInvoiceModalOpen(true)}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Importar con IA
      </Button>
    )}
  </div>
)}
```

### Resultado esperado

Después de este cambio:

1. El componente "Factura del Especialista" aparecerá para liquidaciones en estado "Enviada" (sent), "Borrador" (draft), y "Validada" (validated)
2. Al subir una factura, el estado se actualizará automáticamente a `invoice_received`
3. El botón "Importar con IA" también será visible en estos estados
