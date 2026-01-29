
# Plan: Corregir PDF de Liquidaciones - Precios y Símbolos

## Problemas Detectados

### Problema 1: Subtotales con texto vertical
Los subtotales de clientes y proyectos siguen mostrándose con caracteres apilados. El cambio anterior de `colSpan: 4` a `colSpan: 3` no funcionó correctamente porque jsPDF-autotable no maneja bien las celdas con objetos de estilo cuando se usan colSpan.

### Problema 2: Símbolos extraños en nombres de proyectos
Los iconos Unicode no se renderizan correctamente:
- `▸` aparece como `%,`
- `◆` aparece como `%Ë`
- `○` aparece como `%Æ`

Estos caracteres Unicode no están soportados por la fuente Helvetica estándar de PDF.

---

## Solución

### Cambio 1: Eliminar colSpan y usar filas completas
En lugar de usar `colSpan`, crear las 5 celdas individuales con el contenido apropiado para que jsPDF-autotable maneje correctamente los anchos de columna.

### Cambio 2: Reemplazar iconos Unicode por texto ASCII
Usar prefijos de texto simples en lugar de caracteres Unicode:
- Proyectos: `▸` → `> ` 
- Presupuestos: `◆` → `* `
- Sin proyecto: `○` → `- `

---

## Cambios en `src/utils/pdf/liquidationPDFGenerator.ts`

### Función `buildHierarchicalTableData` (líneas 637-704)

**Filas de cliente (líneas 644-658):**
```typescript
// Antes - con colSpan problemático
tableData.push([
  { content: clientGroup.clientName, colSpan: 3, styles: {...} },
  { content: formatCurrency(clientGroup.subtotal), styles: {...} },
  { content: '', styles: {...} },
]);

// Después - 5 celdas individuales
tableData.push([
  { content: clientGroup.clientName, styles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [50, 50, 50] } },
  { content: '', styles: { fillColor: [230, 230, 230] } },
  { content: '', styles: { fillColor: [230, 230, 230] } },
  { content: formatCurrency(clientGroup.subtotal), styles: { fontStyle: 'bold', fillColor: [230, 230, 230], halign: 'right', textColor: [50, 50, 50] } },
  { content: '', styles: { fillColor: [230, 230, 230] } },
]);
```

**Filas de proyecto/presupuesto (líneas 663-678):**
```typescript
// Antes - iconos Unicode
const icon = projectGroup.type === 'project' ? '▸ ' : projectGroup.type === 'budget' ? '◆ ' : '○ ';

// Después - prefijos ASCII
const prefix = projectGroup.type === 'project' ? '> ' : projectGroup.type === 'budget' ? '* ' : '- ';

// Y cambiar estructura a 5 celdas individuales
tableData.push([
  { content: `   ${prefix}${projectGroup.name}`, styles: { fontStyle: 'normal', fillColor: [245, 245, 245], textColor: [80, 80, 80], fontSize: 8 } },
  { content: '', styles: { fillColor: [245, 245, 245] } },
  { content: '', styles: { fillColor: [245, 245, 245] } },
  { content: formatCurrency(projectGroup.subtotal), styles: { fillColor: [245, 245, 245], halign: 'right', textColor: [100, 100, 100], fontSize: 8 } },
  { content: '', styles: { fillColor: [245, 245, 245] } },
]);
```

---

## Resultado Esperado

```text
+---------------------------+-------+--------------+-----------+---+
| Descripción               | Cant. | Precio Unit. | Total     |   |
+---------------------------+-------+--------------+-----------+---+
| ASENDIA HQ                |       |              | 1.271,25€ |   |
+---------------------------+-------+--------------+-----------+---+
|    > ePAQ GO Translations |       |              | 125,00 €  |   |
|       REQ-2025-097 - ...  |   1   |    25,00 €   | 25,00 €   |   |
|       REQ-2025-098 - ...  |   2   |    50,00 €   | 50,00 €   |   |
+---------------------------+-------+--------------+-----------+---+
|    * Presupuesto ABC      |       |              | 200,00 €  |   |
+---------------------------+-------+--------------+-----------+---+
|    - Sin proyecto         |       |              | 50,00 €   |   |
+---------------------------+-------+--------------+-----------+---+
```

- Los subtotales aparecerán en la columna "Total" (28px) correctamente formateados en horizontal
- Los proyectos usarán `>`, los presupuestos `*` y los sin clasificar `-`

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/utils/pdf/liquidationPDFGenerator.ts` | Reemplazar colSpan por 5 celdas individuales y cambiar iconos Unicode por ASCII |
