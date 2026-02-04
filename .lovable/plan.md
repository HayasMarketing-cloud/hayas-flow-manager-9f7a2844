

## Plan: Corregir Checkboxes No Clickables en Vista Seguimiento

### Problema Identificado

Analizando la captura y el código, hay **dos problemas**:

1. **Los milestones que no tienen tareas muestran un círculo que parece ser un RadioButton (no Checkbox)** - Esto es porque no hay checkbox de selección visible; el círculo que se ve es posiblemente un artefacto visual del componente `Checkbox` de Radix que no tiene el handler correcto.

2. **La propagación de props de selección no está llegando correctamente** - En la imagen se ven círculos vacíos en milestones y tareas, pero no son clickables. El problema está en que el código actual usa `<Checkbox>` de Radix pero puede haber un problema con los estilos o el evento `onCheckedChange`.

---

### Análisis del Código Actual

**`MilestoneTrackingRowNested.tsx` líneas 178-184:**
```typescript
<TableCell className="w-10">
  {onSelectChange && (
    <Checkbox
      checked={isSelected}
      onCheckedChange={onSelectChange}  // ❌ Tipo incorrecto
    />
  )}
</TableCell>
```

**Problema:** El prop `onCheckedChange` espera una función `(checked: boolean | 'indeterminate') => void`, pero se está pasando `onSelectChange` que es `() => void`.

**`TaskTrackingRow.tsx` líneas 57-63:**
```typescript
<TableCell className="w-10">
  {onSelectChange && (
    <Checkbox
      checked={isSelected}
      onCheckedChange={onSelectChange}  // ❌ Mismo problema
    />
  )}
</TableCell>
```

---

### Solución

Corregir el tipo de la función callback en todos los componentes afectados:

#### 1. `MilestoneTrackingRowNested.tsx`

```typescript
// Cambiar línea 182
<Checkbox
  checked={isSelected}
  onCheckedChange={() => onSelectChange()}  // ✅ Wrapper function
/>
```

#### 2. `TaskTrackingRow.tsx`

```typescript
// Cambiar línea 61
<Checkbox
  checked={isSelected}
  onCheckedChange={() => onSelectChange()}  // ✅ Wrapper function
/>
```

#### 3. `ProjectTrackingRow.tsx`

```typescript
// Cambiar línea 90
<Checkbox
  checked={isSelected}
  onCheckedChange={() => onSelectChange()}  // ✅ Wrapper function
/>
```

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/operations/MilestoneTrackingRowNested.tsx` | Línea 182: Cambiar `onCheckedChange={onSelectChange}` a `onCheckedChange={() => onSelectChange?.()}` |
| `src/components/operations/TaskTrackingRow.tsx` | Línea 61: Cambiar `onCheckedChange={onSelectChange}` a `onCheckedChange={() => onSelectChange?.()}` |
| `src/components/operations/ProjectTrackingRow.tsx` | Línea 90: Cambiar `onCheckedChange={onSelectChange}` a `onCheckedChange={() => onSelectChange?.()}` |

---

### Cambios Específicos

**MilestoneTrackingRowNested.tsx (línea 180-183):**
```typescript
// ANTES:
<Checkbox
  checked={isSelected}
  onCheckedChange={onSelectChange}
/>

// DESPUÉS:
<Checkbox
  checked={isSelected}
  onCheckedChange={() => onSelectChange?.()}
/>
```

**TaskTrackingRow.tsx (línea 59-62):**
```typescript
// ANTES:
<Checkbox
  checked={isSelected}
  onCheckedChange={onSelectChange}
/>

// DESPUÉS:
<Checkbox
  checked={isSelected}
  onCheckedChange={() => onSelectChange?.()}
/>
```

**ProjectTrackingRow.tsx (línea 88-91):**
```typescript
// ANTES:
<Checkbox
  checked={isSelected}
  onCheckedChange={onSelectChange}
/>

// DESPUÉS:
<Checkbox
  checked={isSelected}
  onCheckedChange={() => onSelectChange?.()}
/>
```

---

### Resultado Esperado

Después de estos cambios:
- ✅ Checkboxes en filas de **proyectos** serán clickables
- ✅ Checkboxes en filas de **milestones** serán clickables  
- ✅ Checkboxes en filas de **tareas** serán clickables
- ✅ La barra de acciones masivas aparecerá al seleccionar cualquier elemento
- ✅ Se podrán aplicar cambios masivos de estado, especialista y deadline

