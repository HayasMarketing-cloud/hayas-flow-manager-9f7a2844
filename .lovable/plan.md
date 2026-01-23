

# Plan: Carga Automática de Facturas mediante IA

## Objetivo
Reemplazar el formulario manual por un sistema que extraiga automáticamente los datos de las facturas al subir los PDFs, usando inteligencia artificial.

---

## Flujo de Usuario Propuesto

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. Usuario sube PDF(s) de factura(s)                           │
├─────────────────────────────────────────────────────────────────┤
│  2. Sistema procesa PDF con IA y extrae:                        │
│     • Número de factura                                         │
│     • Nombre del cliente → Match con clientes existentes        │
│     • Fecha de emisión y vencimiento                            │
│     • Subtotal, IVA, Total                                      │
├─────────────────────────────────────────────────────────────────┤
│  3. Usuario revisa datos extraídos en una tabla                 │
│     • Puede corregir cliente si no hizo match                   │
│     • Puede ajustar importes si hay errores                     │
├─────────────────────────────────────────────────────────────────┤
│  4. Usuario confirma y se guardan las facturas                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquitectura Técnica

### 1. Nueva Edge Function: `extract-invoice-data`

Procesa PDFs y extrae datos usando Gemini (modelo multimodal que puede leer PDFs/imágenes).

**Entrada:**
- PDF en base64 o URL de storage

**Proceso:**
1. Convertir PDF a imagen o extraer texto
2. Enviar a Gemini con prompt estructurado
3. Recibir JSON con datos extraídos
4. Intentar match automático de cliente

**Salida:**
```json
{
  "invoice_code": "FAC-2024-019",
  "client_name": "Asendia Spain",
  "client_id": "18366e37-01ca-4bce-bea9-78b63452d703",
  "client_matched": true,
  "invoice_date": "2025-01-15",
  "due_date": "2025-02-15",
  "subtotal": 1500.00,
  "tax_rate": 21,
  "tax_amount": 315.00,
  "total_amount": 1815.00,
  "line_items": [
    {"description": "Consultoría SEO", "quantity": 1, "unit_price": 1500}
  ]
}
```

### 2. Nuevo Componente: `InvoiceUploadModal.tsx` (Rediseñado)

**Fase 1: Subida de archivos**
- Zona de arrastrar y soltar para múltiples PDFs
- Barra de progreso para cada archivo
- Indicador de procesamiento con IA

**Fase 2: Revisión de datos extraídos**
- Tabla con todos los datos extraídos
- Indicadores visuales:
  - ✅ Verde: Cliente identificado automáticamente
  - ⚠️ Amarillo: Requiere selección manual de cliente
  - ❌ Rojo: Error en extracción
- Campos editables para correcciones
- Selector de estado para cada factura

**Fase 3: Confirmación**
- Resumen de facturas a importar
- Botón para guardar todas

---

## Componentes a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/functions/extract-invoice-data/index.ts` | Crear | Edge function con IA para extraer datos de PDF |
| `src/components/invoices/InvoiceUploadModal.tsx` | Rediseñar | Nuevo flujo: subir → procesar → revisar → guardar |
| `src/components/invoices/ExtractedInvoiceRow.tsx` | Crear | Fila editable para cada factura extraída |
| `src/components/invoices/InvoiceUploadProgress.tsx` | Crear | Indicador de progreso de procesamiento |

---

## Detalles de la Edge Function

### Prompt para Gemini

```text
Analiza esta factura y extrae los siguientes datos en formato JSON:
- invoice_code: número o código de la factura
- client_name: nombre del cliente facturado
- invoice_date: fecha de emisión (formato YYYY-MM-DD)
- due_date: fecha de vencimiento si aparece (formato YYYY-MM-DD)
- subtotal: importe base imponible (sin IVA)
- tax_rate: porcentaje de IVA aplicado
- tax_amount: importe del IVA
- total_amount: importe total con IVA
- line_items: array de líneas de factura con description, quantity, unit_price

Responde SOLO con el JSON, sin explicaciones.
```

### Matching de Cliente

```typescript
const matchClient = (extractedName: string, clients: Client[]) => {
  // Normalizar nombres
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[.,\s]+/g, ' ')
    .trim();
  
  const normalizedExtracted = normalize(extractedName);
  
  // Buscar coincidencia exacta o parcial
  for (const client of clients) {
    if (normalize(client.name).includes(normalizedExtracted) || 
        normalizedExtracted.includes(normalize(client.name))) {
      return { client_id: client.id, confidence: 'high' };
    }
  }
  
  // Sin match
  return { client_id: null, confidence: 'none' };
};
```

---

## UI del Modal Rediseñado

### Estado 1: Subida de PDFs

```text
┌────────────────────────────────────────────────────┐
│  Importar Facturas                           [X]   │
├────────────────────────────────────────────────────┤
│                                                    │
│    ┌──────────────────────────────────────────┐    │
│    │     📄                                   │    │
│    │     Arrastra tus facturas aquí           │    │
│    │     o haz clic para seleccionar          │    │
│    │     (PDF, hasta 10 archivos)             │    │
│    └──────────────────────────────────────────┘    │
│                                                    │
│  Archivos seleccionados:                           │
│  ├─ factura-001.pdf  [Procesando... ⏳]            │
│  ├─ factura-002.pdf  [En cola]                     │
│  └─ factura-003.pdf  [En cola]                     │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Estado 2: Revisión de Datos

```text
┌────────────────────────────────────────────────────────────────────┐
│  Revisar Datos Extraídos                                     [X]   │
├────────────────────────────────────────────────────────────────────┤
│  Se extrajeron 3 facturas. Revisa los datos antes de guardar.     │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Código     │ Cliente         │ Fecha   │ Subtotal │ Total     │ │
│ ├────────────┼─────────────────┼─────────┼──────────┼───────────┤ │
│ │ FAC-001 ✅ │ Asendia Spain ▼│ 15/01/25│  1.500 € │  1.815 €  │ │
│ │ FAC-002 ✅ │ ASENDIA HQ    ▼│ 18/01/25│  2.000 € │  2.420 €  │ │
│ │ FAC-003 ⚠️ │ [Seleccionar] ▼│ 20/01/25│  3.500 € │  4.235 €  │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ⚠️ 1 factura requiere selección manual de cliente                │
│                                                                    │
│                              [Cancelar]  [Importar 3 Facturas]     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Pasos de Implementación

### Paso 1: Crear Edge Function
- Recibe PDF en base64
- Usa Lovable AI (Gemini) para extraer datos
- Retorna JSON estructurado

### Paso 2: Actualizar Modal
- Zona de drag & drop para múltiples archivos
- Llamar a edge function por cada PDF
- Mostrar progreso de procesamiento

### Paso 3: Vista de Revisión
- Tabla con datos extraídos
- Selectores de cliente para facturas sin match
- Campos editables para correcciones

### Paso 4: Guardado Masivo
- Crear todas las facturas en una transacción
- Subir PDFs a storage
- Asociar pdf_url a cada factura

---

## Consideraciones Técnicas

### Límites y Validaciones
- Máximo 10 PDFs por lote
- Tamaño máximo: 10MB por archivo
- Timeout de edge function: 30 segundos por PDF

### Manejo de Errores
- Si la IA no puede extraer datos → Mostrar error y permitir entrada manual
- Si no hace match de cliente → Requerir selección manual
- Validar importes antes de guardar

### Secrets Requeridos
El proyecto ya tiene configurado Lovable AI, por lo que no se necesitan secrets adicionales para acceder a Gemini.

