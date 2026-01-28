
## Plan: Permitir a especialistas crear tareas y añadir campo de Google Drive

### Problema identificado

El error "new row violates row-level security policy for table tasks" ocurre porque las políticas actuales de INSERT en la tabla `tasks` son muy restrictivas:

| Política actual | Quién puede crear |
|-----------------|-------------------|
| "AM and PM can create tasks" | Solo owner/creador del proyecto operacional |
| "PM and admin can create tasks" | Solo roles admin o project_manager |

**Los especialistas asignados a un operational_request NO pueden crear tareas** bajo las políticas actuales.

### Solución propuesta

#### 1. Nueva política RLS para especialistas

Crear una nueva política que permita a los especialistas asignados a un `operational_request` crear tareas para ese mismo request:

```sql
CREATE POLICY "Assigned specialists can create tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  operational_request_id IN (
    SELECT orq.id 
    FROM operational_requests orq
    WHERE orq.assignee_specialist_id IN (
      SELECT s.id FROM specialists s WHERE s.user_id = auth.uid()
    )
  )
);
```

Esta política verifica que:
- El usuario tenga un perfil de especialista vinculado (`specialists.user_id = auth.uid()`)
- Ese especialista esté asignado al operational_request donde se crea la tarea

#### 2. Campo de Google Drive (ya existe)

El campo `context_url` ya está implementado en:
- **Base de datos**: Columna `context_url` en tabla `tasks`
- **UI**: Campo "URL de contexto" visible al expandir una tarea en `InlineTaskItem.tsx`

Solo necesitamos mejorar la UI para hacerlo más visible y específico para Google Drive:

**Archivo:** `src/components/operations/InlineTaskItem.tsx`

Cambiar el label y placeholder del campo para indicar que es para Google Drive:
- Label: "URL de contexto" → "Enlace Google Drive"
- Placeholder: "https://..." → "https://drive.google.com/..."
- Añadir icono de Drive junto al campo

### Resumen de cambios

| Tipo | Cambio |
|------|--------|
| **Base de datos** | Nueva política RLS para permitir a especialistas crear tareas en sus requests asignados |
| **UI** | Modificar `InlineTaskItem.tsx` para mostrar campo de Google Drive más claro |

### Resultado esperado

1. Los especialistas podrán crear tareas en los operational_requests donde están asignados
2. Los managers (AM/PM) seguirán pudiendo crear tareas si son owner/creador del proyecto
3. Cada tarea mostrará un campo claro para añadir un enlace de Google Drive
