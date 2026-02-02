
## Objetivo
Asegurar que las asociaciones de presupuesto se muestren correctamente en el listado de facturas después de guardar.

---

## Diagnóstico del problema

### Verificación de datos en base de datos:
He consultado la base de datos y confirmado:
- **Factura 2025/157**: ✅ Tiene asignación guardada (allocated_amount: 2241.81, budget: PRE-2026-001)
- **Factura 2026/8**: ❌ **NO tiene ninguna asignación guardada** (0 registros en `invoice_budget_allocations`)

### Conclusión:
La asignación que mencionas haber hecho **no se guardó en la base de datos**. Esto puede deberse a:

1. **No hiciste clic en "Guardar"** después de añadir la asignación en el editor
2. **Hubo un error silencioso** durante el guardado que no mostró mensaje
3. **El tipo de asociación no estaba seleccionado correctamente** (el RadioGroup en "Presupuesto(s)")

---

## Lo que debes hacer ahora

### Paso 1: Editar la factura 2026/8 de nuevo
1. Abre la factura 2026/8 en modo edición
2. Selecciona el RadioButton **"Presupuesto(s)"** en la sección de asociación
3. En el editor de asignaciones que aparece debajo, selecciona **PRE-2026-001** en el dropdown
4. Introduce el importe **1403.62** (o el que corresponda)
5. Haz clic en el botón **"+"** para añadir la asignación
6. **Importante**: Haz clic en el botón **"Guardar"** del formulario

### Paso 2: Verificar en el listado
Al volver al listado de facturas, la columna "Asociación" debería mostrar "PRE-2026-001" para ambas facturas.

---

## Posible mejora a implementar

Si después de seguir estos pasos sigue sin funcionar, podría haber un bug en:
- La lógica de guardado cuando `associationType = 'budgets'`
- Un error silencioso que no se está mostrando

En ese caso, implementaría:
1. **Logging adicional** en `useSaveInvoiceAllocations` para detectar errores
2. **Mensaje de confirmación** que muestre exactamente cuántas asignaciones se guardaron
3. **Verificación pre-guardado** de que hay asignaciones cuando se selecciona "Presupuesto(s)"

---

## ¿Quieres que pruebe la asociación de nuevo?
Si confirmas que sí guardaste correctamente pero sigue sin funcionar, procederé a:
1. Añadir logs detallados para depurar el problema
2. Verificar la lógica de RLS que pueda estar bloqueando la inserción
3. Revisar si hay algún error en la mutation de guardado
