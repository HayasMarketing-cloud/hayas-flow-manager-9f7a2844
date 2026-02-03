
## Plan: Edición Masiva de Precio Unitario (unit_price)

### Resumen
Añadir funcionalidad de edición masiva para actualizar el campo `unit_price` (precio unitario/precio al cliente) de múltiples requests seleccionados, recalculando automáticamente el `sale_amount` (importe de venta).

---

### Análisis del patrón existente

La edición masiva de `cost_rate` ya implementa este patrón:
- Campo de input numérico en la barra de acciones masivas
- Botón "Aplicar" que llama a `confirmBulkEdit`
- `bulkUpdateMutation` con caso especial que:
  1. Itera sobre los requests seleccionados
  2. Actualiza el campo Y recalcula el campo derivado (`cost_to_agency = cost_rate × hours`)

---

### Lógica de cálculo

Para requests con `sale_type = 'fixed'`:
```text
sale_amount = unit_price × quantity
```

**Comportamiento de la edición masiva:**
- Al cambiar `unit_price`, recalcular `sale_amount` para cada request usando su `quantity` individual
- Solo afecta a requests que tengan `sale_type = 'fixed'`
- Los requests con `sale_type = 'hourly'` mantienen su `sale_amount` basado en `sale_hours × sale_rate`

---

### Cambios a realizar

#### 1. Modificar `bulkUpdateMutation` en Solicitudes.tsx

Añadir caso especial para `unit_price`:

```typescript
// Special handling for unit_price: recalculate sale_amount based on quantity
if (field === 'unit_price') {
  const selectedRequests = requests?.filter(r => selectedIds.includes(r.id)) || [];
  
  for (const request of selectedRequests) {
    const quantity = request.quantity || 1;
    const newSaleAmount = value * quantity;
    
    const { error } = await supabase
      .from('financial_requests')
      .update({ 
        unit_price: value,
        sale_amount: newSaleAmount,
        sale_type: 'fixed' // Asegurar que el tipo es correcto
      })
      .eq('id', request.id);
    
    if (error) throw error;
  }
}
```

#### 2. Añadir campo de input en la barra de edición masiva

Añadir después del campo "Tarifa/hora" (línea ~741):

```tsx
{/* Precio unitario (unit_price) */}
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Precio unit.:</span>
  <Input
    id="bulk-unit-price-input"
    type="number"
    placeholder="0.00"
    className="w-[100px] h-8"
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        const value = parseFloat((e.target as HTMLInputElement).value);
        if (!isNaN(value) && value >= 0) {
          confirmBulkEdit('unit_price', value, `${value.toFixed(2)} € (recalcula importe venta)`);
        }
      }
    }}
  />
  <Button
    variant="secondary"
    size="sm"
    className="h-8 px-2"
    onClick={() => {
      const input = document.getElementById('bulk-unit-price-input') as HTMLInputElement;
      const value = parseFloat(input?.value || '');
      if (!isNaN(value) && value >= 0) {
        confirmBulkEdit('unit_price', value, `${value.toFixed(2)} € (recalcula importe venta)`);
      } else {
        toast.error('Introduce un precio válido');
      }
    }}
  >
    Aplicar
  </Button>
</div>
```

---

### Flujo visual

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  3 requests seleccionados                                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Estado: [Cambiar... ▼]   Fecha: [📅]                                     │
│                                                                            │
│  Tarifa/hora: [ 30.00 ] [Aplicar]                                         │
│                                                                            │
│  Precio unit.: [ 150.00 ] [Aplicar]  ← NUEVO                              │
│                                                                            │
│  ─────────────────────────────────────────────────────────────            │
│                                                                            │
│  [Añadir a Liquidación] [Añadir a Facturación] [Eliminar]  [Limpiar]     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Solicitudes.tsx` | Añadir caso `unit_price` en mutation + input en UI |

---

### Consideraciones

1. **Recálculo automático**: Al actualizar `unit_price`, el `sale_amount` se recalcula automáticamente multiplicando por `quantity` de cada request
2. **Forzar `sale_type = 'fixed'`**: La edición masiva de `unit_price` establece automáticamente el tipo de venta a `fixed` para garantizar consistencia
3. **Compatibilidad**: Los requests que ya tenían `sale_type = 'hourly'` se convertirán a `fixed` al aplicar esta edición masiva (esto es el comportamiento deseado si estás asignando precio unitario)

---

### Beneficios

- Permite corregir rápidamente los 49 requests que tienen `sale_amount = 0` por falta de precio
- Workflow idéntico al de edición de tarifa por hora (consistente con UX existente)
- Recalcula automáticamente el importe de venta sin intervención manual adicional
