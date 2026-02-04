
## Plan: Mostrar Checkboxes en Todos los Milestones y Tareas

### Problema Identificado

Analizando el código y la captura, el problema es que los checkboxes en milestones y tareas están **condicionados** a la existencia del prop `onSelectChange`:

**`MilestoneTrackingRowNested.tsx` líneas 178-184:**
```typescript
<TableCell className="w-10">
  {onSelectChange && (   // ← CONDICIONAL - checkbox NO se muestra si onSelectChange es undefined
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onSelectChange?.()}
    />
  )}
</TableCell>
```

**`TaskTrackingRow.tsx` líneas 56-64:**
```typescript
<TableCell className="w-10">
  {onSelectChange && (   // ← MISMO PROBLEMA
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onSelectChange?.()}
    />
  )}
</TableCell>
```

El checkbox del proyecto SÍ aparece porque recibe el prop `onSelectChange` correctamente. Pero para milestones y tareas, el checkbox no aparece cuando `onSelectChange` es `undefined`.

---

### Solución

**Mostrar siempre el checkbox**, independientemente de si hay callback. El checkbox estará visible pero deshabilitado si no hay callback (aunque en nuestro caso siempre habrá callback porque la tabla principal lo pasa).

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/operations/MilestoneTrackingRowNested.tsx` | Líneas 178-184: Quitar condicional, mostrar siempre el Checkbox |
| `src/components/operations/TaskTrackingRow.tsx` | Líneas 56-64: Quitar condicional, mostrar siempre el Checkbox |

---

### Cambios Específicos

**MilestoneTrackingRowNested.tsx (líneas 178-185):**
```typescript
// ANTES:
<TableCell className="w-10">
  {onSelectChange && (
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onSelectChange?.()}
    />
  )}
</TableCell>

// DESPUÉS:
<TableCell className="w-10">
  <Checkbox
    checked={isSelected}
    onCheckedChange={() => onSelectChange?.()}
  />
</TableCell>
```

**TaskTrackingRow.tsx (líneas 56-64):**
```typescript
// ANTES:
<TableCell className="w-10">
  {onSelectChange && (
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onSelectChange?.()}
    />
  )}
</TableCell>

// DESPUÉS:
<TableCell className="w-10">
  <Checkbox
    checked={isSelected}
    onCheckedChange={() => onSelectChange?.()}
  />
</TableCell>
```

---

### Resultado Esperado

- Todos los milestones mostrarán un checkbox a la izquierda
- Todas las tareas (cuando se expande un milestone) mostrarán un checkbox a la izquierda
- Los checkboxes serán clickables para selección múltiple
- La barra de acciones masivas aparecerá cuando haya elementos seleccionados
