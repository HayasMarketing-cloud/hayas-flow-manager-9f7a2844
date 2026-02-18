
## Mejora visual: Cliente más destacado en la card de Solicitudes

### Qué se va a cambiar

En `src/components/requests/RequestCard.tsx`, el badge del cliente actualmente usa `variant="outline"` con colores muy neutros (`bg-slate-50 text-slate-700 border-slate-200`), lo que lo hace poco diferenciable del resto del contenido.

Se va a rediseñar ese elemento para que el cliente destaque visualmente como el dato principal de identificación de la card, usando un fondo de color sólido con texto contrastado.

### Cambio concreto

**Antes** (líneas 54-62 de `RequestCard.tsx`):
```tsx
<Badge 
  variant="outline" 
  className="bg-slate-50 text-slate-700 border-slate-200 font-medium text-sm py-1 px-2.5 max-w-full"
>
  <Building2 className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
  <span className="truncate">{request.client.name}</span>
</Badge>
```

**Después** — fondo azul oscuro, texto blanco, tipografía más grande y semibold:
```tsx
<div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-1.5 max-w-full">
  <Building2 className="h-4 w-4 flex-shrink-0" />
  <span className="font-semibold text-sm truncate">{request.client.name}</span>
</div>
```

Esto usa los colores `primary` del tema (azul oscuro), que son los de mayor contraste disponibles y ya usados en botones de acción, por lo que el cliente "llama la atención" de manera coherente con el sistema de diseño existente.

### Archivos a modificar

| Archivo | Líneas | Cambio |
|---|---|---|
| `src/components/requests/RequestCard.tsx` | 54-62 | Reemplazar Badge por div con fondo primary |
