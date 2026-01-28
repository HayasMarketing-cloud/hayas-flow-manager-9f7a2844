
# Plan: Añadir conceptos manuales en el detalle de liquidación

## Situación Actual

La funcionalidad de añadir líneas manuales (concepto + importe) **ya existe** en el sistema, pero solo está disponible en el **modal de creación/edición** (`LiquidationFormModal.tsx`). La página de **detalle de liquidación** (`LiquidacionDetalle.tsx`) solo tiene el botón "Añadir Solicitudes".

La tabla `liquidation_items` ya soporta items manuales porque el campo `financial_request_id` es **nullable** (opcional).

## Cambios a Realizar

### 1. Añadir sección de "Conceptos Manuales" en LiquidacionDetalle.tsx

**Ubicación**: Junto al botón "Añadir Solicitudes", añadir otro botón "Añadir Concepto" que abra un pequeño formulario inline o un modal simple.

**Implementación**:

| Elemento | Descripción |
|----------|-------------|
| Estado local | `newConceptDescription`, `newConceptAmount`, `isAddingConcept` |
| Formulario inline | Descripción (texto) + Importe (número) + botón Añadir |
| Mutation | Insertar en `liquidation_items` con `financial_request_id = null` |
| Actualización | Recalcular subtotal de la liquidación |

### 2. Interfaz propuesta

```
┌─────────────────────────────────────────────────────────┐
│ Conceptos de la Liquidación                             │
│                                                         │
│ [+ Añadir Solicitudes] [+ Añadir Concepto Manual]       │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Concepto: [__________________] Importe: [____] [+] │ │  ← Solo visible al pulsar "Añadir Concepto"
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ | Código | Descripción | Cliente | ... | Total |        │
│ |--------|-------------|---------|-----|-------|        │
│ | REQ-XX | Trabajo A   | Cliente | ... | 120€  |        │
│ | -      | Bonus extra | -       | ... | 50€   |  ← Item manual (sin código)
└─────────────────────────────────────────────────────────┘
```

### 3. Código a añadir

**Estados nuevos:**
```typescript
const [isAddingManualConcept, setIsAddingManualConcept] = useState(false);
const [manualDescription, setManualDescription] = useState('');
const [manualAmount, setManualAmount] = useState<number | ''>('');
```

**Mutation para añadir concepto manual:**
```typescript
const addManualConceptMutation = useMutation({
  mutationFn: async () => {
    const { error } = await supabase
      .from('liquidation_items')
      .insert({
        liquidation_id: id,
        description: manualDescription,
        quantity: 1,
        unit_price: manualAmount,
        total: manualAmount,
        financial_request_id: null, // Item manual sin request
      });
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['liquidation', id] });
    setManualDescription('');
    setManualAmount('');
    setIsAddingManualConcept(false);
    toast.success('Concepto añadido');
  },
});
```

**UI del formulario inline:**
```tsx
{isAddingManualConcept && isEditable && (
  <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg">
    <div className="flex-1">
      <Label className="text-xs">Concepto</Label>
      <Input
        placeholder="Descripción del concepto"
        value={manualDescription}
        onChange={(e) => setManualDescription(e.target.value)}
      />
    </div>
    <div className="w-32">
      <Label className="text-xs">Importe (€)</Label>
      <Input
        type="number"
        step="0.01"
        placeholder="0.00"
        value={manualAmount}
        onChange={(e) => setManualAmount(e.target.value ? parseFloat(e.target.value) : '')}
      />
    </div>
    <Button size="sm" onClick={() => addManualConceptMutation.mutate()}>
      <Plus className="h-4 w-4" />
    </Button>
    <Button size="sm" variant="ghost" onClick={() => setIsAddingManualConcept(false)}>
      <X className="h-4 w-4" />
    </Button>
  </div>
)}
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/LiquidacionDetalle.tsx` | Añadir estados, mutation, botón y formulario inline para conceptos manuales |

## Resultado Esperado

- Botón "Añadir Concepto Manual" junto a "Añadir Solicitudes"
- Al pulsar, aparece formulario inline con campos Concepto + Importe
- Los conceptos manuales aparecen en la tabla sin código de request
- Solo visible cuando la liquidación está en estado editable (borrador)
- Solo para usuarios con permisos de finanzas
