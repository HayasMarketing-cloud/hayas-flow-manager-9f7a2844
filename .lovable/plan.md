
# Plan: Añadir Función "Añadir a Liquidación" en Detalle de Solicitud

## Objetivo

Añadir un botón en la página de detalle de solicitud (`SolicitudDetalle.tsx`) que permita añadir directamente la solicitud actual a una liquidación, utilizando el modal existente `AddToLiquidationModal`.

## Ubicación del Botón

El botón se ubicará en la sección **"Estado de Facturación"** (líneas 542-569), junto a la información de Liquidación. Solo se mostrará cuando:

1. La solicitud **NO** tenga ya una liquidación asociada (`!request.liquidation_id`)
2. La solicitud tenga estado **completado** o esté lista para liquidar
3. El usuario tenga permisos de **finanzas** u **operaciones**

## Cambios a Implementar

### Archivo: `src/pages/SolicitudDetalle.tsx`

1. **Importar** el componente `AddToLiquidationModal`
2. **Añadir estado** para controlar la apertura del modal
3. **Añadir botón** "Añadir a Liquidación" en la sección "Estado de Facturación"

### Diseño Visual

```
┌────────────────────────────────────────────────────────────┐
│  Estado de Facturación                                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Factura          Liquidación                              │
│  📄 ---           📋 ---   [+ Añadir a Liquidación]        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Código a Modificar

### 1. Imports (línea ~1-42)

```typescript
import { AddToLiquidationModal } from '@/components/liquidations/AddToLiquidationModal';
import { Plus } from 'lucide-react';
```

### 2. Nuevo estado (línea ~56)

```typescript
const [addToLiquidationModalOpen, setAddToLiquidationModalOpen] = useState(false);
```

### 3. Actualizar sección "Estado de Facturación" (líneas 542-569)

```typescript
{/* Invoice & Liquidation Status */}
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium">Estado de Facturación</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">Factura</p>
        <FlowStatusCell
          type="invoice"
          linkedId={request.billed_invoice_id}
          linkedCode={request.invoice?.code}
          linkedStatus={request.invoice?.status}
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">Liquidación</p>
        <div className="flex items-center gap-2">
          <FlowStatusCell
            type="liquidation"
            linkedId={request.liquidation_id}
            linkedCode={request.liquidation?.code}
            linkedStatus={request.liquidation?.status}
          />
          {/* Botón para añadir a liquidación - solo si no tiene liquidación y usuario tiene permisos */}
          {!request.liquidation_id && canAccessFinance() && request.specialist_id && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setAddToLiquidationModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Añadir a Liquidación
            </Button>
          )}
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

### 4. Añadir Modal (antes del cierre de AppLayout)

```typescript
{/* Add to Liquidation Modal */}
<AddToLiquidationModal
  open={addToLiquidationModalOpen}
  onOpenChange={setAddToLiquidationModalOpen}
  requestIds={[request.id]}
  onSuccess={handleRefresh}
/>
```

## Condiciones de Visibilidad del Botón

| Condición | Valor | Descripción |
|-----------|-------|-------------|
| `!request.liquidation_id` | true | No tiene liquidación asociada |
| `canAccessFinance()` | true | Usuario tiene rol admin o finanzas |
| `request.specialist_id` | exists | Tiene especialista asignado |

## Comportamiento Esperado

1. Usuario abre el detalle de una solicitud sin liquidación
2. En la sección "Estado de Facturación", aparece el botón "Añadir a Liquidación"
3. Al hacer clic, se abre el modal `AddToLiquidationModal` con esta única solicitud
4. El modal permite crear nueva liquidación o añadir a una existente
5. Al completar, la página se refresca y muestra el código de liquidación vinculado

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/SolicitudDetalle.tsx` | Añadir import, estado, botón y modal |
