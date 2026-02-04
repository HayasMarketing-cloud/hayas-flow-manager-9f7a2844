

## Plan: Corregir Error de Filtro en Vista Tarjetas

### Problema Identificado

El error en producción:
```
invalid input value for enum operational_status: "not_completed"
```

**Causa:** El hook `useOperationalProjects.tsx` (usado en la vista de Tarjetas) pasa el valor `not_completed` directamente a Supabase, pero ese valor NO existe en el enum de la base de datos.

El enum `operational_status` solo tiene: `pending`, `in_progress`, `in_review`, `completed`

---

### Solución

Aplicar la misma lógica que ya funciona en `useProjectMilestones.tsx`:

**Archivo:** `src/hooks/useOperationalProjects.tsx`

**Cambio en líneas 58-60:**

```typescript
// ANTES:
if (filters?.status) {
  query = query.eq('status', filters.status as any);
}

// DESPUÉS:
if (filters?.status) {
  if (filters.status === 'not_completed') {
    query = query.neq('status', 'completed');
  } else {
    query = query.eq('status', filters.status as any);
  }
}
```

---

### Comportamiento Esperado

| Filtro seleccionado | Query a Supabase |
|--------------------|------------------|
| `not_completed` | `.neq('status', 'completed')` |
| `all` | Sin filtro de status |
| `pending` | `.eq('status', 'pending')` |
| `in_progress` | `.eq('status', 'in_progress')` |
| `completed` | `.eq('status', 'completed')` |

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useOperationalProjects.tsx` | Añadir lógica para manejar `not_completed` usando `.neq()` |

---

### Resultado

- ✅ Vista Tarjetas funcionará con el filtro "Activos (sin completados)"
- ✅ Mostrará proyectos con status: pending, in_progress, in_review
- ✅ Ocultará proyectos con status: completed

