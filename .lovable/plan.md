
# Plan: Corregir visualizacion del campo Horas en el formulario de Request

## Problema Identificado

El campo "Horas" muestra "0" al editar/consultar un request, aunque el "Coste calculado" se muestra correctamente (120€ = 4h x 30€/h). Los datos en la base de datos estan correctos (hours = 4, cost_rate = 30, cost_to_agency = 120).

## Analisis Tecnico

Despues de revisar el codigo, identifique varios posibles puntos de fallo:

### 1. Problema con el Input controlado
En `RequestFormModal.tsx` lineas 920-922:
```tsx
{...field}
value={field.value ?? ''}
onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
```

El spread `{...field}` incluye `value` que luego se sobrescribe. Pero para inputs numericos, cuando `field.value` es `0` (numero), `0 ?? ''` devuelve `0`, lo cual es correcto.

### 2. Posible condicion de carrera en form.reset()
El `useEffect` (lineas 355-410) que hace `form.reset()` depende de `[open, initialData, form]`. Si `initialData.hours` es `null` o no llega correctamente, el campo se queda en su valor por defecto.

### 3. Conversion de tipos con Zod
El schema define `hours: z.coerce.number()` que fuerza la conversion a numero. Si el valor llega como string vacio o formato inesperado, podria convertirse a 0 o NaN.

## Solucion Propuesta

### Cambio 1: Mejorar la inicializacion del campo hours

Modificar el Input del campo `hours` para manejar mejor los valores numericos:

**Archivo:** `src/components/modals/RequestFormModal.tsx`

Cambiar de:
```tsx
<Input
  type="number"
  min="0"
  step="0.01"
  placeholder="0"
  {...field}
  value={field.value ?? ''}
  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
  disabled={isViewMode}
/>
```

A:
```tsx
<Input
  type="number"
  min="0"
  step="0.01"
  placeholder="0"
  name={field.name}
  ref={field.ref}
  onBlur={field.onBlur}
  value={field.value !== null && field.value !== undefined ? field.value : ''}
  onChange={(e) => {
    const val = e.target.value;
    field.onChange(val === '' ? null : parseFloat(val));
  }}
  disabled={isViewMode}
/>
```

Este cambio:
- Evita el spread completo de `{...field}` que puede causar conflictos
- Maneja explicitamente los casos de `null` y `undefined`
- Asegura que la conversion a numero sea correcta

### Cambio 2: Agregar log de depuracion temporal (opcional)

Para diagnosticar si el problema persiste, agregar un console.log en el useEffect:
```tsx
console.log('Initializing form with hours:', initialData?.hours);
```

### Cambio 3: Aplicar el mismo patron a cost_rate

Para consistencia, aplicar el mismo cambio al campo `cost_rate` (lineas 941-949).

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/modals/RequestFormModal.tsx` | Mejorar manejo de valores en campos numericos `hours` y `cost_rate` |

## Resultado Esperado

- El campo "Horas" mostrara el valor correcto (4) al editar el request
- El coste calculado seguira mostrando el valor correcto (120.00€)
- Sin cambios en el comportamiento al crear nuevos requests
