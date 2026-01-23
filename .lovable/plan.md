
# Plan: Corregir recálculo de total al modificar el IVA

## Problema detectado

Al modificar el porcentaje de IVA en el editor de facturas, el total no se recalcula automáticamente en tiempo real.

**Causa raíz:** El campo de IVA usa `register('tax_rate', { valueAsNumber: true })` junto con `watch('tax_rate')` para el cálculo. Sin embargo, hay un problema de sincronización donde:
1. `register` con `valueAsNumber` a veces no actualiza el estado inmediatamente
2. El re-render no se dispara correctamente hasta que el campo pierde el foco

## Solución

Cambiar el campo de IVA de un input "no controlado" (con `register`) a un input "controlado" (con `value` y `onChange` + `setValue`), similar a como se maneja el campo `manualSubtotal`.

## Cambio a realizar

### Archivo: `src/components/modals/InvoiceFormModal.tsx`

**Modificar el input de IVA (líneas 627-632):**

```typescript
// Antes - Input no controlado
<Input
  type="number"
  step="0.01"
  {...register('tax_rate', { valueAsNumber: true })}
  disabled={disabled}
/>

// Después - Input controlado
<Input
  type="number"
  step="0.01"
  value={watch('tax_rate') ?? ''}
  onChange={(e) => {
    const val = e.target.value;
    setValue('tax_rate', val === '' ? 0 : parseFloat(val) || 0);
  }}
  disabled={disabled}
/>
```

## Beneficio

Con este cambio:
- Al escribir cualquier número en el campo de IVA, se llamará a `setValue` que actualiza el estado del formulario
- El `watch('tax_rate')` en las líneas de cálculo detectará el cambio inmediatamente
- El componente se re-renderizará y mostrará el IVA y Total actualizados en tiempo real

## Resumen

| Archivo | Cambio |
|---------|--------|
| `src/components/modals/InvoiceFormModal.tsx` | Convertir el input de IVA a controlado con `value` y `onChange` |
