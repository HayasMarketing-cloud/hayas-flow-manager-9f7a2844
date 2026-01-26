
# Plan: Subida de Factura del Especialista en Liquidaciones

## Resumen
Implementar la funcionalidad para que al subir un PDF de factura del especialista en una liquidación, el estado cambie automáticamente a "Factura recibida".

---

## Cambios a realizar

### 1. Migración de base de datos

#### 1.1 Añadir nuevo estado al enum `liquidation_status`
El estado `invoice_received` se añadirá entre `accepted` y `pending_payment` en el flujo.

```text
Flujo actual:    draft → validated → sent → accepted → pending_payment → paid
Flujo nuevo:     draft → validated → sent → accepted → invoice_received → pending_payment → paid
```

#### 1.2 Añadir columna para URL de factura
Nueva columna `specialist_invoice_url` en la tabla `liquidations` para guardar la referencia al PDF subido.

#### 1.3 Crear storage bucket
Bucket `liquidation-invoices` para almacenar las facturas de los especialistas.

---

### 2. Actualización de utilidades

**Archivo:** `src/lib/liquidation-utils.ts`

- Añadir el nuevo estado `invoice_received` a las funciones de color y etiqueta:
  - Color: `bg-cyan-500 text-white`
  - Etiqueta: `Factura recibida`

---

### 3. Componente de subida de factura

**Nuevo archivo:** `src/components/liquidations/SpecialistInvoiceUpload.tsx`

Componente que permite:
- Drag and drop o click para seleccionar PDF
- Solo acepta archivos PDF
- Muestra el archivo actual si ya existe
- Botón para eliminar/reemplazar factura
- Al subir, actualiza automáticamente el estado a `invoice_received`

---

### 4. Actualización del Timeline

**Archivo:** `src/components/liquidations/LiquidationProcessTimeline.tsx`

Añadir nuevo paso en el timeline:
- **Posición:** Entre "Aceptada" y "Pendiente de pago"
- **Icono:** Documento/Recibo
- **Estados:**
  - Pendiente: "Esperando factura del especialista"
  - Completado: "Factura recibida" con fecha y enlace al PDF

---

### 5. Actualización de la página de detalle

**Archivo:** `src/pages/LiquidacionDetalle.tsx`

- Añadir sección para subir factura cuando el estado es `accepted` o posterior
- Mostrar enlace para descargar/ver la factura si ya está subida
- Solo visible para usuarios con rol de finanzas

---

## Secciones tecnicas

### Migración SQL

```sql
-- Añadir nuevo valor al enum
ALTER TYPE liquidation_status ADD VALUE 'invoice_received' AFTER 'accepted';

-- Añadir columna para URL de factura
ALTER TABLE liquidations ADD COLUMN specialist_invoice_url text;

-- Crear bucket de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('liquidation-invoices', 'liquidation-invoices', true);

-- Políticas RLS para el bucket
CREATE POLICY "Finance can upload liquidation invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'liquidation-invoices' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Authenticated users can view liquidation invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'liquidation-invoices');

CREATE POLICY "Finance can delete liquidation invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'liquidation-invoices' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);
```

### Componente SpecialistInvoiceUpload

```text
Ubicación: src/components/liquidations/SpecialistInvoiceUpload.tsx

Props:
- liquidationId: string
- liquidationCode: string
- currentInvoiceUrl: string | null
- currentStatus: LiquidationStatus
- onUploadSuccess: () => void

Funcionalidad:
1. Área de drag-and-drop para PDF
2. Al soltar/seleccionar archivo:
   - Subir a storage: liquidation-invoices/{liquidationId}/factura-especialista.pdf
   - Obtener URL pública
   - Actualizar liquidation: specialist_invoice_url + status = 'invoice_received'
3. Si ya hay factura: mostrar enlace + botón reemplazar
```

### Actualización liquidation-utils.ts

```typescript
// Añadir a getLiquidationStatusColor
invoice_received: 'bg-cyan-500 text-white',

// Añadir a getLiquidationStatusLabel  
invoice_received: 'Factura recibida',
```

### Actualización Timeline (buildTimelineSteps)

```text
Nuevo paso después de "Aceptada":

{
  id: 'invoice_received',
  label: 'Factura del especialista',
  status: (según estado actual),
  date: (si tiene factura),
  description: 'Factura recibida del especialista'
}
```

---

## Flujo de usuario

1. El especialista firma y acepta la liquidación → estado `accepted`
2. El usuario de finanzas abre el detalle de la liquidación
3. Ve una sección nueva "Factura del especialista" con área de subida
4. Arrastra o selecciona el PDF de la factura
5. El sistema:
   - Sube el PDF al storage
   - Actualiza `specialist_invoice_url` con la URL
   - Cambia el estado a `invoice_received`
   - Muestra confirmación
6. El timeline se actualiza mostrando el paso completado
7. El usuario puede ver/descargar la factura subida

---

## Consideraciones

- Solo usuarios con rol `admin` o `finanzas` pueden subir facturas
- El especialista puede ver su factura pero no modificarla
- Se puede reemplazar una factura existente (mantiene el estado)
- El archivo se guarda como `{liquidationId}/factura-especialista.pdf` para fácil identificación
