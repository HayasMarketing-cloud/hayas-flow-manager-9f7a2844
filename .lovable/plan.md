

## Plan: Filtro Inicial "Excluir Completados" en Vista de Seguimiento

### Objetivo

Añadir un filtro inicial preestablecido en la vista de seguimiento de proyectos operativos que muestre todos los proyectos **excepto** los completados por defecto. El usuario puede quitar este filtro para ver todos los proyectos o modificar la selección.

---

### Estado Actual

```typescript
// OperationalProjects.tsx línea 57
const [statusFilter, setStatusFilter] = useState<string>('all');
```

El dropdown de estado tiene estas opciones:
- Todos los estados
- Pendiente
- En Progreso  
- En Revisión
- Completado

**Problema:** No existe opción para "todos excepto completados".

---

### Solución Propuesta

#### 1. Nuevo Valor de Filtro: `not_completed`

Añadir una nueva opción en el dropdown que representa "Activos (sin completados)":

```text
┌──────────────────────────┐
│ ✓ Activos (sin completados) │  ← NUEVO (valor por defecto)
│   Todos los estados      │
│   Pendiente              │
│   En Progreso            │
│   En Revisión            │
│   Completado             │
└──────────────────────────┘
```

#### 2. Cambios en el Código

**Archivo:** `src/pages/operations/OperationalProjects.tsx`

**Cambio 1 - Valor inicial del estado:**
```typescript
// ANTES:
const [statusFilter, setStatusFilter] = useState<string>('all');

// DESPUÉS:
const [statusFilter, setStatusFilter] = useState<string>('not_completed');
```

**Cambio 2 - Añadir opción en el Select:**
```tsx
<Select value={statusFilter} onValueChange={setStatusFilter}>
  <SelectTrigger>
    <SelectValue placeholder="Todos los estados" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="not_completed">Activos (sin completados)</SelectItem>
    <SelectItem value="all">Todos los estados</SelectItem>
    <SelectItem value="pending">Pendiente</SelectItem>
    <SelectItem value="in_progress">En Progreso</SelectItem>
    <SelectItem value="in_review">En Revisión</SelectItem>
    <SelectItem value="completed">Completado</SelectItem>
  </SelectContent>
</Select>
```

**Cambio 3 - Actualizar lógica de filtros activos:**
```typescript
// Actualizar hasActiveFilters para considerar not_completed como "filtro activo"
const hasActiveFilters = !!(
  searchTerm || 
  clientFilter !== 'all' || 
  (statusFilter !== 'all' && statusFilter !== 'not_completed') || // Ajustar condición
  specialistFilter !== 'all' ||
  budgetFilter !== 'all' ||
  contractFilter !== 'all'
);
```

---

#### 3. Actualizar Hook de Milestones

**Archivo:** `src/hooks/useProjectMilestones.tsx`

Añadir soporte para el valor `not_completed`:

```typescript
// ANTES:
if (filters?.status) {
  query = query.eq('status', filters.status);
}

// DESPUÉS:
if (filters?.status) {
  if (filters.status === 'not_completed') {
    query = query.neq('status', 'completed');
  } else {
    query = query.eq('status', filters.status);
  }
}
```

---

#### 4. Actualizar Interface de Filtros

**Archivo:** `src/hooks/useProjectMilestones.tsx`

El tipo ya es `string`, así que no requiere cambio en la interface `MilestoneFilters`.

---

### Comportamiento Esperado

| Acción del Usuario | Resultado |
|-------------------|-----------|
| Carga inicial | Muestra proyectos Pendiente + En Progreso + En Revisión |
| Selecciona "Todos los estados" | Muestra todos incluyendo Completados |
| Selecciona "Pendiente" | Solo muestra Pendientes |
| Selecciona "Completado" | Solo muestra Completados |
| Selecciona "Activos (sin completados)" | Vuelve al filtro inicial |

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/operations/OperationalProjects.tsx` | Cambiar valor inicial, añadir opción dropdown, ajustar hasActiveFilters |
| `src/hooks/useProjectMilestones.tsx` | Añadir lógica para `not_completed` |

---

### Vista Previa del Dropdown

```text
Estado: [Activos (sin completados) ▼]
         ├── Activos (sin completados) ✓
         ├── Todos los estados
         ├── Pendiente
         ├── En Progreso
         ├── En Revisión
         └── Completado
```

