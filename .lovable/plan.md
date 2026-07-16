## Diagnóstico

El presupuesto existe correctamente en la base de datos:

- `PRE-2026-049`
- Cliente: `ASENDIA HQ`
- Creado por: `Iolanda Carbone`
- Estado: `Pendiente`
- Importe: `630,00 €`
- `created_by` = Iolanda
- `am_user_id` = vacío
- `pm_user_id` = vacío

La causa probable no es falta de permisos de Iolanda en el backend: la política de lectura permite ver presupuestos creados por ella. El problema está en el filtro del listado de `Presupuestos`: para usuarios AM/PM, el frontend primero calcula `assignedBudgetIds` usando solo presupuestos donde Iolanda está en `am_user_id` o `pm_user_id`. Como este presupuesto nuevo no guarda AM/PM, no entra en esa lista y luego el listado hace `.in('id', assignedBudgetIds)`, excluyéndolo aunque ella sea la creadora.

Esto explica que sea intermitente: los presupuestos donde el formulario deja AM/PM relleno aparecen; los que se crean sin AM/PM, aunque sean suyos, desaparecen del listado principal.

## Plan de corrección

1. **Corregir el listado de Presupuestos**
   - Cambiar la consulta de usuarios AM/PM para incluir presupuestos que cumplan cualquiera de estas condiciones:
     - `am_user_id = usuario actual`
     - `pm_user_id = usuario actual`
     - `created_by = usuario actual`
     - cliente asignado directamente o heredado por contrato/presupuesto cuando aplique
   - Evitar depender únicamente de `assignedBudgetIds` cuando el usuario es el creador.

2. **Corregir el hook de presupuestos asignados**
   - Actualizar `useUserBudgetIds` para incluir también `created_by = user.id`.
   - Mantener el filtro por AM/PM para no abrir acceso global.
   - Esto alinea el frontend con la política real del backend.

3. **Mejorar la creación desde el modal**
   - Si el usuario actual es account manager o project manager y crea un presupuesto sin seleccionar AM/PM, guardar automáticamente su usuario en el campo correspondiente:
     - account manager → `am_user_id`
     - project manager → `pm_user_id`
   - En el caso concreto de Iolanda, como tiene ambos roles, rellenar ambos si están vacíos para mantener coherencia con los presupuestos anteriores de Asendia.

4. **Revisar el caso desde ficha de cliente**
   - `ClientBudgetsTab` crea presupuestos con `client_id` preseleccionado. Aplicar la misma lógica del modal para que también queden asignados correctamente si se crean desde ahí.

5. **Validación**
   - Verificar que `PRE-2026-049` aparecería en el listado de Iolanda aunque no tenga AM/PM.
   - Revisar que no se amplía visibilidad a usuarios no asignados.
   - Confirmar que la solución cubre los próximos presupuestos, no solo este caso puntual.

## Cambio de datos opcional

Además del fix de código, conviene actualizar este presupuesto existente para asignar Iolanda como AM/PM, igual que los presupuestos previos de ASENDIA HQ. Esto no sustituye el fix: solo deja el registro actual consistente.