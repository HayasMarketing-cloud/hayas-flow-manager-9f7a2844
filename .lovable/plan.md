
# Plan: Agregar funcionalidad de eliminar facturas

## Resumen

Implementar la capacidad de eliminar registros de facturas desde la vista de tabla y tarjetas, con un dialogo de confirmacion para evitar eliminaciones accidentales.

## Cambios a implementar

### 1. Modificar la vista de tabla (InvoiceTableView.tsx)

Agregar un boton de eliminar en la columna de acciones:
- Icono de papelera (Trash2) junto a los botones de ver/editar
- Solo visible para usuarios con permisos de finanzas
- Llamara a una funcion `onDelete` pasada como prop

### 2. Modificar la vista de tarjetas (InvoiceCard.tsx)

Agregar un boton de eliminar:
- Boton con estilo destructivo
- Solo visible para usuarios con permisos

### 3. Modificar la pagina principal (Facturas.tsx)

Agregar la logica de eliminacion:
- Estado para controlar el dialogo de confirmacion (`deleteDialogOpen`)
- Estado para la factura a eliminar (`invoiceToDelete`)
- Mutation de React Query para ejecutar el DELETE en la base de datos
- Dialogo de confirmacion usando `ConfirmDialog` existente
- Invalidar la query de facturas tras eliminar exitosamente
- Mostrar toast de exito o error

### 4. Comportamiento esperado

1. Usuario hace clic en el icono de papelera
2. Se abre dialogo: "¿Eliminar factura FAC-2025-0001?"
3. Descripcion: "Esta accion no se puede deshacer. Si la factura tiene solicitudes asociadas, estas quedaran sin factura asignada."
4. Boton "Eliminar" en rojo, boton "Cancelar"
5. Al confirmar: DELETE en base de datos, cierre de dialogo, toast de exito
6. Lista se refresca automaticamente

## Consideraciones de seguridad

- La eliminacion solo estara disponible para usuarios con rol de finanzas o admin
- Las restricciones de base de datos ya estan configuradas:
  - `invoice_items` se eliminan automaticamente (CASCADE)
  - `requests.billed_invoice_id` se pone a NULL automaticamente (SET NULL)

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Facturas.tsx` | Agregar estado, mutation y dialogo de confirmacion |
| `src/components/invoices/InvoiceTableView.tsx` | Agregar boton eliminar y prop onDelete |
| `src/components/invoices/InvoiceCard.tsx` | Agregar boton eliminar |

## Detalles tecnicos

### Mutation de eliminacion

```typescript
const deleteMutation = useMutation({
  mutationFn: async (invoiceId: string) => {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    toast.success('Factura eliminada correctamente');
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  },
  onError: (error) => {
    toast.error('Error al eliminar: ' + error.message);
  }
});
```

### Props adicionales en InvoiceTableView

```typescript
interface InvoiceTableViewProps {
  // ... props existentes
  onDelete?: (invoice: any) => void;
}
```

### Dialogo de confirmacion

Usara el componente `ConfirmDialog` existente con `variant="destructive"`.
