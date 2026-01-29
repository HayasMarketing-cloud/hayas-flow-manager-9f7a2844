

# Plan: Mejorar Diseño de Títulos de Proyecto en PDF de Liquidaciones

## Análisis del Problema

El PDF de liquidación muestra caracteres extraños (`%Æ`, `%Ë`) delante de los nombres de proyectos y presupuestos, y el texto aparece con letras espaciadas de forma inusual.

**Síntomas observados:**
- `%Æ  S i n  p r o y e c t o / p r e s u p u e s t o`
- `%Æ  N e w s l e t t e r  Q 4  U S A`
- `%Ë  Switzerland without borders...`

**Causa probable:**
Los prefijos ASCII (`> `, `* `, `- `) que se añadieron en el último cambio podrían estar interactuando de forma extraña con jsPDF-autotable, especialmente cuando se combinan con espacios de indentación y ciertos caracteres especiales en los nombres.

---

## Solución Propuesta

### 1. Simplificar el formato de los títulos de proyecto
Eliminar los prefijos de símbolo y usar solo indentación visual con guiones simples, evitando cualquier carácter que pueda causar problemas de encoding.

### 2. Usar un formato más limpio y legible
En lugar de símbolos para diferenciar proyectos de presupuestos, usar texto descriptivo más claro:
- Proyectos: `[Proyecto] Nombre`
- Presupuestos: `[Presup.] Nombre`  
- Sin asignar: `Sin proy./presup.`

### 3. Aplicar formato con negrita y color en lugar de símbolos
Usar estilos de texto (fontStyle, textColor) para diferenciar visualmente sin necesidad de caracteres especiales.

---

## Cambios Técnicos

### Archivo: `src/utils/pdf/liquidationPDFGenerator.ts`

**Líneas 653-662 - Filas de proyecto/presupuesto:**

```typescript
// Actual
const prefix = projectGroup.type === 'project' ? '> ' : projectGroup.type === 'budget' ? '* ' : '- ';
tableData.push([
  { content: `   ${prefix}${projectGroup.name}`, styles: {...} },
  ...
]);

// Propuesto - Eliminar símbolos y usar texto limpio
let displayName = projectGroup.name;
if (projectGroup.type === 'project') {
  displayName = `[Proy.] ${projectGroup.name}`;
} else if (projectGroup.type === 'budget') {
  displayName = `[Presup.] ${projectGroup.name}`;
}
// Para "Sin proyecto/presupuesto" se mantiene el nombre tal cual

tableData.push([
  { content: `    ${displayName}`, styles: { 
    fontStyle: projectGroup.type !== 'none' ? 'italic' : 'normal', 
    fillColor: [245, 245, 245], 
    textColor: [80, 80, 80], 
    fontSize: 8 
  } },
  { content: '', styles: { fillColor: [245, 245, 245] } },
  { content: '', styles: { fillColor: [245, 245, 245] } },
  { content: formatCurrency(projectGroup.subtotal), styles: { 
    fillColor: [245, 245, 245], 
    halign: 'right', 
    textColor: [100, 100, 100], 
    fontSize: 8 
  } },
  { content: '', styles: { fillColor: [245, 245, 245] } },
]);
```

---

## Resultado Visual Esperado

```text
+------------------------------------------------------+-------+--------+-----------+
| Descripción                                          | Cant. | P.Unit | Total     |
+------------------------------------------------------+-------+--------+-----------+
| ASENDIA HQ                                           |       |        | 1.271,25€ |
+------------------------------------------------------+-------+--------+-----------+
|     [Proy.] ePAQ GO Translations                     |       |        |   125,00€ |
|         REQ-2025-097 - Gestión y coordinación...     |   1   | 25,00€ |    25,00€ |
|         REQ-2025-098 - Email Marketing...            |   2   | 50,00€ |    50,00€ |
+------------------------------------------------------+-------+--------+-----------+
|     [Presup.] Switzerland without borders            |       |        |   150,00€ |
|         REQ-2026-110 - Gestión y coordinación...     |   2   | 50,00€ |    50,00€ |
+------------------------------------------------------+-------+--------+-----------+
|     Sin proyecto/presupuesto                         |       |        |   141,00€ |
|         REQ-2026-080 - Gestión y coordinación...     |   1   |141,00€ |   141,00€ |
+------------------------------------------------------+-------+--------+-----------+
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/utils/pdf/liquidationPDFGenerator.ts` | Reemplazar prefijos de símbolo por etiquetas de texto `[Proy.]` y `[Presup.]` |

