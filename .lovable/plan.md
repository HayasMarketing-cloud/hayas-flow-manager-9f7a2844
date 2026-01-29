
# Plan: Corregir Maquetación de PDF de Liquidaciones

## Problema Detectado

Los subtotales de clientes y proyectos se muestran con los caracteres apilados verticalmente (cada carácter en una línea separada) porque la columna donde caen tiene solo **6px de ancho**.

| Estructura Actual | Problema |
|------------------|----------|
| `colSpan: 4` para descripción | Ocupa columnas 0-3 |
| Subtotal sin `colSpan` | Cae en columna 4 (6px) |
| Resultado | Texto apilado verticalmente |

## Solución

Cambiar la estructura de la tabla para que los subtotales usen la columna "Total" (columna 3) con ancho adecuado (28px):

| Fila | Col 0 | Col 1 | Col 2 | Col 3 | Col 4 |
|------|-------|-------|-------|-------|-------|
| **Cliente (header)** | Nombre (colSpan: 3) | - | - | Subtotal | - |
| **Proyecto (header)** | Nombre (colSpan: 3) | - | - | Subtotal | - |
| **Items** | Descripción | Cant. | P.Unit | Total | - |

### Cambios en `buildHierarchicalTableData`

**Filas de cabecera de Cliente (líneas 644-654):**
```typescript
// Antes
[
  { content: clientGroup.clientName, colSpan: 4, styles: {...} },
  { content: formatCurrency(clientGroup.subtotal), styles: {...} },
]

// Después  
[
  { content: clientGroup.clientName, colSpan: 3, styles: {...} },
  { content: formatCurrency(clientGroup.subtotal), styles: {..., halign: 'right' } },
  { content: '', styles: {...} },
]
```

**Filas de cabecera de Proyecto/Presupuesto (líneas 660-670):**
```typescript
// Antes
[
  { content: `   ${icon}${projectGroup.name}`, colSpan: 4, styles: {...} },
  { content: formatCurrency(projectGroup.subtotal), styles: {...} },
]

// Después
[
  { content: `   ${icon}${projectGroup.name}`, colSpan: 3, styles: {...} },
  { content: formatCurrency(projectGroup.subtotal), styles: {..., halign: 'right' } },
  { content: '', styles: {...} },
]
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/utils/pdf/liquidationPDFGenerator.ts` | Ajustar `colSpan` de 4 a 3 en las filas de cabecera y agregar celda vacía al final |

---

## Resultado Esperado

Después del cambio:

```text
┌────────────────────────────────────────────────────────┐
│ Descripción              │ Cant. │ Precio Unit. │ Total │
├──────────────────────────┼───────┼──────────────┼───────┤
│ ASENDIA HQ               │       │              │ 1.271,25 € │
├──────────────────────────┼───────┼──────────────┼───────┤
│   ▸ ePAQ GO Translations │       │              │ 125,00 € │
│      REQ-2025-097 - ...  │   1   │     25,00 €  │ 25,00 € │
│      REQ-2025-098 - ...  │   2   │     50,00 €  │ 50,00 € │
└──────────────────────────┴───────┴──────────────┴───────┘
```

Los subtotales ahora caerán en la columna "Total" (28px de ancho) en lugar de la columna vacía (6px), evitando el apilamiento vertical de caracteres.
