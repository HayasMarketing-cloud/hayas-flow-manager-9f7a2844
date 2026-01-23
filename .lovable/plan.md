
# Plan: Destacar el nombre del cliente en RequestCard con un badge mejorado

## Contexto actual

En `src/components/requests/RequestCard.tsx` (líneas 42-47), el nombre del cliente se muestra como texto simple con un icono:

```tsx
{request.client && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Building2 className="h-4 w-4 flex-shrink-0" />
    <span className="truncate">{request.client.name}</span>
  </div>
)}
```

## Propuesta de diseño

Cambiar el nombre del cliente a un badge/pastilla con mejor visibilidad:
- Usar el componente `Badge` existente en el proyecto
- Aplicar una variante `outline` con fondo suave azul/slate para destacar sin ser intrusivo
- Incluir el icono `Building2` dentro del badge
- Mantener el texto truncado para nombres largos

## Cambios técnicos

| Archivo | Cambio |
|---------|--------|
| `src/components/requests/RequestCard.tsx` | Importar `Badge` y rediseñar la sección del cliente |

### Código propuesto

```tsx
{request.client && (
  <Badge 
    variant="outline" 
    className="bg-slate-50 text-slate-700 border-slate-200 font-medium text-sm py-1 px-2.5 max-w-full"
  >
    <Building2 className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
    <span className="truncate">{request.client.name}</span>
  </Badge>
)}
```

## Resultado visual esperado

- El nombre del cliente aparecerá en una pastilla con fondo gris claro/azulado
- El icono del edificio estará integrado dentro del badge
- Mayor contraste visual que lo diferencia del resto del texto
- Consistente con el estilo de badges usado en otros componentes del proyecto (como en `ContractCard`)
