
# Plan: Corrección de Maquetación del PDF de Liquidación

## Problemas Identificados

Analizando la imagen adjunta, encuentro estos errores de maquetación:

| # | Problema | Causa |
|---|----------|-------|
| 1 | **Cabecera "Proyecto/Presupuest o"** cortada en dos líneas | Columna de 40px es demasiado estrecha para el texto |
| 2 | **Cabecera "Cantida d"** cortada incorrectamente | Columna de 20px insuficiente |
| 3 | **Cabecera "Precio Unitario"** en dos líneas | Columna de 30px no permite el texto completo |
| 4 | **Subtotal sin espacio** - "Subtotal Daniela Puntriano241,00 €" | Falta separación entre texto y valor en el código |

---

## Solución Propuesta

### 1. Redistribuir Anchos de Columna

**Configuración actual (problematica):**
```
Columna 0 (Servicio/Cliente):    60px
Columna 1 (Proyecto/Presupuesto): 40px  ← MUY ESTRECHA
Columna 2 (Cantidad):             20px  ← MUY ESTRECHA  
Columna 3 (Precio Unitario):      30px  ← MUY ESTRECHA
Columna 4 (Total):                30px
Total:                           180px
```

**Nueva configuración optimizada:**
```
Columna 0 (Servicio/Cliente):    55px  (reducir ligeramente)
Columna 1 (Proyecto/Presup.):    45px  (+5px)
Columna 2 (Cant.):               18px  (usar abreviatura)
Columna 3 (Precio Unit.):        32px  (+2px, usar abreviatura)
Columna 4 (Total):               30px
Total:                          180px
```

### 2. Usar Nombres de Cabecera Abreviados

| Actual | Nuevo |
|--------|-------|
| Proyecto/Presupuesto | Proy./Presup. |
| Cantidad | Cant. |
| Precio Unitario | Precio Unit. |

### 3. Corregir Línea de Subtotal

**Código actual (línea ~150-151):**
```typescript
doc.text(`Subtotal ${data.specialist.name}:`, pageWidth - 75, currentY);
doc.text(formatCurrency(leaderTotal), pageWidth - 15, currentY, { align: 'right' });
```

**Problema:** El nombre queda pegado al importe porque comparten la misma coordenada X inicial.

**Solución:** Añadir espacio fijo con tabulación visual correcta.

---

## Archivos a Modificar

### `src/utils/pdf/liquidationPDFGenerator.ts`

#### Cambio 1: Cabeceras y anchos de columna (7 ubicaciones)

Todas las tablas `autoTable` usan la misma configuración. Cambiar:

```typescript
// ANTES
head: [['Servicio / Cliente', 'Proyecto/Presupuesto', 'Cantidad', 'Precio Unitario', 'Total']],
columnStyles: {
  0: { cellWidth: 60 },
  1: { cellWidth: 40 },
  2: { cellWidth: 20, halign: 'center' },
  3: { cellWidth: 30, halign: 'right' },
  4: { cellWidth: 30, halign: 'right' },
},

// DESPUÉS
head: [['Servicio / Cliente', 'Proy./Presup.', 'Cant.', 'Precio Unit.', 'Total']],
columnStyles: {
  0: { cellWidth: 55 },
  1: { cellWidth: 45 },
  2: { cellWidth: 18, halign: 'center' },
  3: { cellWidth: 32, halign: 'right' },
  4: { cellWidth: 30, halign: 'right' },
},
```

#### Cambio 2: Líneas de Subtotal (4 ubicaciones)

```typescript
// ANTES
doc.text(`Subtotal ${data.specialist.name}:`, pageWidth - 75, currentY);
doc.text(formatCurrency(leaderTotal), pageWidth - 15, currentY, { align: 'right' });

// DESPUÉS  
const subtotalLabel = `Subtotal ${data.specialist.name}:`;
doc.text(subtotalLabel, pageWidth - 80, currentY, { align: 'right' });
doc.text(formatCurrency(leaderTotal), pageWidth - 15, currentY, { align: 'right' });
```

O usar un espaciado consistente:
```typescript
doc.text(`Subtotal ${data.specialist.name}:  ${formatCurrency(leaderTotal)}`, pageWidth - 15, currentY, { align: 'right' });
```

---

## Ubicaciones Exactas a Modificar

| Línea | Descripción |
|-------|-------------|
| 122-143 | Tabla líder equipo (generateLiquidationPDF) |
| 148-151 | Subtotal líder |
| 172-194 | Tabla miembro equipo |
| 197-202 | Subtotal miembro |
| 219-241 | Tabla liquidación simple |
| 426-448 | Tabla líder (generateLiquidationPDFBase64) |
| 451-456 | Subtotal líder (Base64) |
| 474-496 | Tabla miembro (Base64) |
| 498-503 | Subtotal miembro (Base64) |
| 519-541 | Tabla liquidación simple (Base64) |

---

## Resultado Esperado

Después de los cambios:

```
+------------------+---------------+------+-------------+--------+
| Servicio/Cliente | Proy./Presup. | Cant.| Precio Unit.| Total  |
+------------------+---------------+------+-------------+--------+
| ASENDIA HQ       |               |      |             | 241,00€|
+------------------+---------------+------+-------------+--------+
| REQ-2025-046...  |       -       |  4   |    100,00€  | 100,00€|
+------------------+---------------+------+-------------+--------+

                        Subtotal Daniela Puntriano:  241,00 €
```

---

## Resumen de Cambios

| Tipo | Cantidad |
|------|----------|
| Tablas a modificar | 6 (3 en cada función) |
| Líneas de subtotal | 4 |
| Total líneas afectadas | ~60 |
| Archivos modificados | 1 |

La solución es genérica y aplica a todas las liquidaciones (individuales, de equipo, y en formato Base64 para email).
