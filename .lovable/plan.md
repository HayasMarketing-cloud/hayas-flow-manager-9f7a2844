
## Plan: Mostrar Requests Asociados en el Detalle de la Factura

### Objetivo
Añadir una tabla al final del detalle de la factura (en modo `view`) que muestre todas las solicitudes (`financial_requests`) asociadas a través del campo `billed_invoice_id`.

### Contexto
- Las solicitudes se vinculan a facturas mediante el campo `billed_invoice_id` en la tabla `financial_requests`
- Actualmente el modal `InvoiceFormModal` en modo `view` muestra la información de la factura pero no las solicitudes asociadas
- La factura 2026/14 tiene 18 requests asociados con un total de 1.225,00 €

---

### Cambios a Realizar

#### 1. Crear Hook `useInvoiceLinkedRequests`

**Archivo nuevo**: `src/hooks/useInvoiceLinkedRequests.tsx`

Hook que obtiene todas las solicitudes vinculadas a una factura específica:

```typescript
export const useInvoiceLinkedRequests = (invoiceId?: string) => {
  return useQuery({
    queryKey: ['invoice-linked-requests', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          id, code, title, sale_amount, status, completed_at,
          service:services(name),
          specialist:specialists(name)
        `)
        .eq('billed_invoice_id', invoiceId)
        .order('code');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!invoiceId,
  });
};
```

#### 2. Crear Componente `InvoiceLinkedRequestsTable`

**Archivo nuevo**: `src/components/invoices/InvoiceLinkedRequestsTable.tsx`

Componente de tabla con las columnas:
- Código
- Título
- Servicio
- Especialista
- Importe Venta
- Fecha Completado

Incluye:
- Suma total de importes en el footer
- Enlace clickable al código para navegar al detalle
- Estado vacío si no hay requests

#### 3. Modificar `InvoiceFormModal.tsx`

Añadir la sección de requests asociados justo antes del resumen de totales (línea ~942), visible solo en modo `view`:

```tsx
{/* Linked Requests - only in view mode */}
{mode === 'view' && invoice && (
  <InvoiceLinkedRequestsTable invoiceId={invoice.id} />
)}

{/* Summary */}
<Card className="p-4 space-y-2">
  ...
</Card>
```

---

### Diseño de la Tabla

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Solicitudes Vinculadas (18)                                                        │
├──────────────┬─────────────────────┬───────────────┬────────────┬──────────────────┤
│ Código       │ Título              │ Servicio      │ Especia.   │ Importe    │ Fech│
├──────────────┼─────────────────────┼───────────────┼────────────┼──────────────────┤
│ REQ-2025-058 │ Newsletter Setup    │ Traducción    │ Iolanda    │ 75,00 €    │ 15/0│
│ REQ-2025-059 │ Landing Review      │ Revisión      │ Sandra     │ 50,00 €    │ 16/0│
│ ...          │ ...                 │ ...           │ ...        │ ...        │ ... │
├──────────────┴─────────────────────┴───────────────┴────────────┼──────────────────┤
│                                                          Total: │ 1.225,00 €       │
└─────────────────────────────────────────────────────────────────┴──────────────────┘
```

---

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `src/hooks/useInvoiceLinkedRequests.tsx` | Hook para obtener requests por `billed_invoice_id` |
| `src/components/invoices/InvoiceLinkedRequestsTable.tsx` | Componente de tabla de requests |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/modals/InvoiceFormModal.tsx` | Importar y renderizar `InvoiceLinkedRequestsTable` en modo view |

---

### Detalles Técnicos

**Query SQL equivalente:**
```sql
SELECT 
  fr.id, fr.code, fr.title, fr.sale_amount, fr.status, fr.completed_at,
  s.name as service_name,
  sp.name as specialist_name
FROM financial_requests fr
LEFT JOIN services s ON fr.service_id = s.id
LEFT JOIN specialists sp ON fr.specialist_id = sp.id
WHERE fr.billed_invoice_id = '<invoice_id>'
ORDER BY fr.code;
```

**Cálculo del total:**
```typescript
const totalAmount = requests.reduce((sum, r) => sum + (r.sale_amount || 0), 0);
```

---

### Beneficios

1. **Trazabilidad completa**: Ver qué solicitudes componen una factura
2. **Verificación de importes**: Confirmar que la suma coincide con el subtotal
3. **Navegación rápida**: Click en el código para ir al detalle de la solicitud
4. **Consistencia visual**: Usa los mismos componentes de tabla del sistema
