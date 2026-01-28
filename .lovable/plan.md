
# Plan: Mostrar Subida de Factura del Especialista en Todos los Estados

## Problema Detectado

El componente `SpecialistInvoiceUpload` no se muestra cuando la liquidación está en estado **"paid"** (Pagada) porque este estado no está incluido en la lista de estados permitidos.

### Código actual (línea 51 de `SpecialistInvoiceUpload.tsx`):
```typescript
const canUpload = ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'].includes(currentStatus);
```

El estado `paid` falta en esta lista, por lo que el componente devuelve `null` y no se renderiza.

---

## Solución

Modificar la lógica para que la subida de factura del especialista esté disponible en **todos los estados**, incluyendo `paid`.

### Opción A: Incluir `paid` en la lista (Recomendado)
Simplemente añadir `'paid'` al array de estados permitidos.

### Opción B: Eliminar la restricción completamente
Eliminar la variable `canUpload` y siempre mostrar el componente.

---

## Cambio a Implementar

**Archivo:** `src/components/liquidations/SpecialistInvoiceUpload.tsx`

**Cambio en línea 51:**
```typescript
// Antes
const canUpload = ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'].includes(currentStatus);

// Después - Incluir 'paid' para que esté disponible en todos los estados
const canUpload = ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment', 'paid'].includes(currentStatus);
```

Alternativamente, si queremos que siempre esté disponible sin importar el estado:
```typescript
// Opción simplificada - siempre permitir
const canUpload = true;
```

---

## Comportamiento Esperado

Después del cambio:
- ✅ El componente "Factura del Especialista" se mostrará en liquidaciones con estado **Pagada**
- ✅ Se podrá subir/ver/eliminar la factura del especialista
- ✅ La verificación con IA seguirá funcionando normalmente
- ✅ Admin y Finanzas podrán gestionar facturas de especialistas incluso después del pago

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/liquidations/SpecialistInvoiceUpload.tsx` | Añadir 'paid' al array `canUpload` |
