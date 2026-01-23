
# Plan: Carga y Control de Facturas Emitidas

## Resumen

Vamos a implementar un sistema de control de facturas emitidas que permita:
1. Cargar las 19 facturas históricas desde diciembre
2. Visualizar y descargar copias de cada factura (PDF)
3. Cambiar estados de factura (enviada, pagada, vencida, etc.)
4. Seguimiento completo de cobros

---

## 1. Configurar Storage para Copias de Facturas

### Backend - Crear Bucket de Storage

Se creará un bucket llamado `invoice-files` para almacenar copias de facturas (PDFs).

```sql
-- Crear bucket para archivos de facturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-files', 'invoice-files', true);

-- Política para que roles finanzas/admin puedan subir
CREATE POLICY "Finance and admin can upload invoice files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoice-files'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finanzas'))
);

-- Política para ver archivos
CREATE POLICY "Authenticated users can view invoice files"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-files' AND auth.uid() IS NOT NULL);
```

---

## 2. Crear Modal de Carga de Factura Histórica

### Nuevo Componente: `InvoiceUploadModal.tsx`

Un formulario simplificado para cargar facturas ya emitidas:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Código | Texto | Número de factura emitida (ej: FAC-2024-001) |
| Cliente | Select | Selector de cliente existente |
| Fecha factura | Date | Fecha de emisión |
| Fecha vencimiento | Date | Fecha límite de pago |
| Subtotal | Número | Importe base sin IVA |
| % IVA | Número | Porcentaje de IVA (default 21%) |
| Estado | Select | draft/sent/paid/overdue |
| Copia factura | File | PDF de la factura emitida |
| Notas | Texto | Observaciones adicionales |

**Cálculos automáticos:**
- IVA = Subtotal × (% IVA / 100)
- Total = Subtotal + IVA

---

## 3. Modificar Vista de Facturas

### Cambios en `InvoiceTableView.tsx`

Añadir columna para ver/descargar copia de factura:

```
| Código | Cliente | Fecha | Venc. | Subtotal | IVA | Total | Estado | [📎 PDF] | Acciones |
```

- Icono de PDF que abre la copia en nueva pestaña
- Badge visual si no tiene copia adjunta

### Cambios en `InvoiceCard.tsx`

- Añadir botón "Ver Copia" si `pdf_url` existe
- Mostrar icono de advertencia si no tiene copia

---

## 4. Implementar Cambio de Estado de Factura

### Nueva Funcionalidad

Permitir cambiar el estado de las facturas directamente:

| Estado actual | Acciones disponibles |
|---------------|----------------------|
| draft | → sent, cancelled |
| sent | → paid, overdue, cancelled |
| paid | (sin cambios, estado final) |
| overdue | → paid, cancelled |
| cancelled | (sin cambios, estado final) |

### UI para Cambio de Estado

- Dropdown de acciones en cada factura
- Botón "Marcar como Pagada" destacado para facturas `sent`
- Al marcar como `paid`, se guarda `paid_at` automáticamente

---

## 5. Mejorar Modal de Visualización

### Modo "view" en `InvoiceFormModal.tsx`

Cuando se abre en modo vista, mostrar:
- Todos los datos de la factura (readonly)
- Botón para ver/descargar copia PDF
- Dropdown para cambiar estado
- Historial de fechas (`created_at`, `sent_at`, `paid_at`)

---

## 6. Flujo para Cargar las 19 Facturas

### Opción A: Carga Manual (Recomendada)

1. Usuario accede a Facturas
2. Clic en "Nueva Factura" o "Importar Factura"
3. Completa datos y sube PDF
4. Guarda factura

### Opción B: Carga Masiva

Si tienes los datos en Excel/CSV, podría implementarse un importador. 

**¿Qué formato tienes los datos de las 19 facturas?**
- ¿Excel/CSV?
- ¿PDFs individuales?
- ¿Datos estructurados o solo las copias?

---

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| Migración SQL | Crear | Storage bucket + políticas |
| `InvoiceUploadModal.tsx` | Crear | Modal simplificado para facturas históricas |
| `InvoiceTableView.tsx` | Modificar | Añadir columna PDF y acciones de estado |
| `InvoiceCard.tsx` | Modificar | Añadir botón ver PDF y cambio de estado |
| `InvoiceFormModal.tsx` | Modificar | Mejorar modo vista con acciones |
| `InvoiceStatusActions.tsx` | Crear | Componente para cambiar estado de factura |
| `Facturas.tsx` | Modificar | Añadir botón "Importar Factura" |

---

## Resultado Esperado

1. **Control total** de las 19 facturas emitidas
2. **Acceso rápido** a copias PDF de cada factura
3. **Seguimiento** de estados: enviada → pagada
4. **Alertas** para facturas vencidas
5. **Búsqueda y filtros** por cliente, estado, período
6. **Exportación Excel** para contabilidad

---

## Sección Técnica

### Estructura de Storage

```
invoice-files/
├── {invoice_id}/
│   └── factura.pdf
```

### Upload de Archivo

```typescript
const uploadInvoicePDF = async (invoiceId: string, file: File) => {
  const filePath = `${invoiceId}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('invoice-files')
    .upload(filePath, file, { upsert: true });
  
  if (!error) {
    const { data: { publicUrl } } = supabase.storage
      .from('invoice-files')
      .getPublicUrl(filePath);
    
    // Actualizar factura con URL del PDF
    await supabase
      .from('invoices')
      .update({ pdf_url: publicUrl })
      .eq('id', invoiceId);
  }
};
```

### Mutación para Cambiar Estado

```typescript
const updateStatus = useMutation({
  mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
    const updates: any = { status };
    
    if (status === 'sent') {
      updates.sent_at = new Date().toISOString();
    } else if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
  }
});
```
