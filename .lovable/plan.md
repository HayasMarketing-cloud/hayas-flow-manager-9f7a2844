

## Plan: Añadir Campos URL y Notas Inline en Tareas

### Objetivo
Mostrar los campos **URL de contexto** y **Notas** de forma visible y editable inline en las tareas, sin necesidad de expandir. Estos campos aparecerán en una segunda línea para evitar sobrecargar la fila principal.

---

### Diseño Visual Propuesto

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ☐ [▸] Nombre de la tarea          [Estado ▼]   📅 28/02/2026   [🗑]             │
│       [🔗 Enlace: drive.google.com...]   [📝 Notas: Revisar con cliente...]     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Segunda línea:**
- **URL de contexto**: Se muestra como tarjeta/badge clickable con icono de enlace. Si está vacía, muestra "Añadir enlace" como placeholder clickable.
- **Notas**: Se muestra como texto truncado con icono. Si está vacío, muestra "Añadir notas" como placeholder.

Al hacer clic en cualquiera de estos campos, se activa la edición inline.

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/operations/InlineTaskItem.tsx` | Añadir segunda línea siempre visible con campos URL y Notas inline editables |

---

### Cambios en InlineTaskItem.tsx

#### 1. Añadir Segunda Línea Siempre Visible

Después de la fila principal (línea 225), añadir una segunda línea que muestre:

```typescript
{/* Segunda línea - URL y Notas inline */}
<div className="flex items-center gap-4 px-4 pb-2 ml-8">
  {/* URL de contexto como tarjeta */}
  <div className="flex-1">
    {editingField === 'context_url' ? (
      <Input
        value={localContextUrl}
        onChange={(e) => setLocalContextUrl(e.target.value)}
        onBlur={handleContextUrlBlur}
        onKeyDown={(e) => e.key === 'Escape' && setEditingField(null)}
        placeholder="https://..."
        className="h-7 text-xs"
        autoFocus
      />
    ) : task.context_url ? (
      <a
        href={task.context_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md 
                   bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3 w-3" />
        <span className="truncate max-w-[150px]">
          {new URL(task.context_url).hostname}
        </span>
      </a>
    ) : (
      <button
        onClick={() => setEditingField('context_url')}
        className="text-xs text-muted-foreground hover:text-foreground 
                   flex items-center gap-1"
      >
        <ExternalLink className="h-3 w-3" />
        Añadir enlace
      </button>
    )}
  </div>

  {/* Notas inline */}
  <div className="flex-1">
    {editingField === 'notes' ? (
      <Input
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={handleNotesBlur}
        onKeyDown={(e) => e.key === 'Escape' && setEditingField(null)}
        placeholder="Notas..."
        className="h-7 text-xs"
        autoFocus
      />
    ) : task.notes ? (
      <span
        onClick={() => setEditingField('notes')}
        className="text-xs text-muted-foreground truncate block cursor-text 
                   hover:bg-accent/50 px-1 py-0.5 rounded flex items-center gap-1"
      >
        <MessageSquare className="h-3 w-3 shrink-0" />
        <span className="truncate">{task.notes}</span>
      </span>
    ) : (
      <button
        onClick={() => setEditingField('notes')}
        className="text-xs text-muted-foreground hover:text-foreground 
                   flex items-center gap-1"
      >
        <MessageSquare className="h-3 w-3" />
        Añadir notas
      </button>
    )}
  </div>
</div>
```

#### 2. Quitar Indicadores de la Primera Línea

- Eliminar el icono `<MessageSquare>` que indicaba que hay notas (líneas 199-202)
- Quitar el botón de `ExternalLink` para context_url (líneas 204-214)

Ya que ahora estos campos son visibles en la segunda línea.

#### 3. Handlers para Edición

Añadir manejador de teclado para los nuevos campos inline:

```typescript
const handleContextUrlKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleContextUrlBlur();
    setEditingField(null);
  } else if (e.key === 'Escape') {
    setLocalContextUrl(task.context_url || '');
    setEditingField(null);
  }
};

const handleNotesKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleNotesBlur();
    setEditingField(null);
  } else if (e.key === 'Escape') {
    setLocalNotes(task.notes || '');
    setEditingField(null);
  }
};
```

---

### Comportamiento de URL como Tarjeta

Cuando hay una URL guardada:
- Se muestra como badge/tarjeta azul claro
- Muestra el dominio (ej: `drive.google.com`) truncado
- Icono de enlace externo
- Al hacer clic, abre la URL en nueva pestaña
- Al hacer clic en botón editar (o doble clic), permite editar la URL

---

### Resultado Esperado

1. **Segunda línea siempre visible** bajo cada tarea con:
   - Campo URL de contexto (tarjeta clickable o "Añadir enlace")
   - Campo Notas (texto truncado o "Añadir notas")

2. **Edición inline** al hacer clic en cualquiera de los placeholders

3. **URL como tarjeta** cuando tiene valor, mostrando el dominio y permitiendo abrir el enlace

4. **Estilo coherente** con los demás campos inline (especialista, deadline, estado)

