
# Plan: Permitir edición de subtotal en facturas sin líneas de factura

## Problema identificado

Cuando se edita una factura importada desde PDF:
- El subtotal muestra 0,00 € aunque la factura tiene un valor real (106.28 € en el ejemplo)
- Las facturas importadas guardan el `subtotal` directamente en la tabla `invoices`, pero no crean registros en `invoice_items`
- El modal calcula el subtotal únicamente sumando los items de la lista, que está vacía para facturas importadas

## Solución propuesta

Añadir un campo editable de "Subtotal manual" que permita:
1. Cargar el subtotal existente de la factura cuando se edita
2. Permitir modificar el subtotal directamente cuando no hay líneas de factura
3. El IVA y total se recalcularán automáticamente basándose en este subtotal

## Cambios a realizar

### 1. Modificar InvoiceFormModal.tsx

**Nuevo estado para subtotal manual:**
- Añadir estado `manualSubtotal` para almacenar el subtotal directo
- Cargar el valor de `invoice.subtotal` al editar una factura existente

**Lógica de cálculo híbrida:**
- Si hay líneas de factura: usar la suma de los items (comportamiento actual)
- Si no hay líneas: usar el subtotal manual

**UI para editar subtotal:**
- Añadir un campo de entrada numérico para el subtotal
- Mostrarlo solo cuando no hay líneas de factura (para facturas importadas)
- O mostrarlo siempre como alternativa para edición directa

**Actualizar la mutación de guardado:**
- Usar el subtotal correcto (calculado o manual) al guardar

---

## Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/modals/InvoiceFormModal.tsx` | Añadir estado y campo editable para subtotal manual, modificar lógica de cálculo |

---

## Detalles técnicos

**Nuevo estado:**
```typescript
const [manualSubtotal, setManualSubtotal] = useState<number>(0);
```

**Cálculo del subtotal efectivo:**
```typescript
// Si hay items, usar la suma de items; si no, usar el subtotal manual
const effectiveSubtotal = invoiceItems.length > 0 
  ? invoiceItems.reduce((sum, item) => sum + item.total, 0)
  : manualSubtotal;
```

**Cargar subtotal al editar:**
```typescript
useEffect(() => {
  if (invoice && mode !== 'create') {
    setManualSubtotal(invoice.subtotal || 0);
    // ... resto del reset
  }
}, [invoice, mode]);
```

**Campo editable en el formulario:**
- Se mostrará un input de subtotal cuando `invoiceItems.length === 0`
- Permitirá al usuario ingresar/modificar el importe base
