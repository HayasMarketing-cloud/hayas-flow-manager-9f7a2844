

# Plan: Consolidar Vista de Liquidaciones de Equipo en Lista/Tabla

## Análisis del Problema

Actualmente:
- Cada especialista tiene su propia liquidación individual en la BD
- En el **detalle** de Daniela ya se muestra la vista consolidada (Daniela + Sandra)
- En el **listado** aparecen como 2 entradas separadas

El usuario quiere consistencia: ver una sola entrada para el equipo en el listado.

## Opciones Evaluadas

| Opción | Descripción | Complejidad | Recomendación |
|--------|-------------|-------------|---------------|
| **A. Filtrar + Consolidar** | Ocultar miembros del listado, mostrar total del equipo en el líder | Media | RECOMENDADA |
| B. Agrupación visual | Mostrar ambas pero agrupadas/indentadas bajo el líder | Media-Alta | Alternativa |
| C. Consolidar en BD | Una sola liquidación por equipo | Alta | NO recomendada |

## Solución Recomendada: Opción A

### Concepto
1. **Filtrar**: Ocultar del listado las liquidaciones de especialistas que tienen `team_leader_id` (son miembros de un equipo)
2. **Enriquecer**: Para los líderes, calcular y mostrar el total del equipo (líder + miembros)
3. **Indicar visualmente**: Añadir badge "Equipo" y mostrar desglose (ej: "512,50€ + 840,00€ = 1.352,50€")
4. **Navegación**: Al hacer click, ir al detalle que ya muestra las tablas separadas

### Ventajas
- Mantiene integridad de datos (cada especialista conserva su liquidación para auditoría)
- Aprovecha la vista de detalle ya implementada
- Mínimos cambios en estructura de datos
- Clara distinción visual entre liquidaciones individuales y de equipo

## Diseño Visual

### Card de Equipo
```
┌─────────────────────────────────────────────────────┐
│ Daniela Puntriano          [Equipo] [Borrador]     │
│ Dic 2025 • LIQ-2026-009                            │
│                                                     │
│ Firma: Pendiente                                    │
│ Miembros: Sandra Vásquez                           │
│ ─────────────────────────────────────────────────  │
│                       Total Equipo: 1.352,50 €     │
│                                                     │
│ [Ver]  [Editar]  [Enviar]                          │
└─────────────────────────────────────────────────────┘
```

### Fila de Tabla para Equipo
```
| ☑ | LIQ-2026-009 | Daniela Puntriano [Equipo] | Dic 2025 | 1.352,50€ | Borrador | Pendiente | [👁] [✏] [📧] |
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Liquidaciones.tsx` | Enriquecer query con team_leader_id, agregar lógica de consolidación |
| `src/components/liquidations/LiquidationCard.tsx` | Mostrar badge "Equipo", total consolidado, lista de miembros |
| `src/components/liquidations/LiquidationTableView.tsx` | Mostrar badge "Equipo", total consolidado |
| `src/hooks/useTeamMembers.ts` | Crear nuevo hook `useTeamLiquidationsForList` optimizado para listado |

## Implementación Detallada

### 1. Crear Hook para Datos de Equipo en Lista

Nuevo hook o modificar `useTeamMembers.ts`:

```typescript
/**
 * Get consolidated liquidation data for list view
 * Returns liquidations with team totals calculated and member liquidations filtered out
 */
export const useConsolidatedLiquidations = (liquidations: any[]) => {
  // 1. Identificar qué especialistas son miembros de equipo (tienen team_leader_id)
  // 2. Identificar qué especialistas son líderes (tienen miembros apuntando a ellos)
  // 3. Para cada líder:
  //    - Encontrar liquidaciones de sus miembros en el mismo período
  //    - Calcular total consolidado
  //    - Añadir metadata de equipo
  // 4. Filtrar liquidaciones de miembros del resultado final
  
  return {
    consolidatedLiquidations, // Sin miembros, con totales de equipo
    teamLeaderIds,            // Set de IDs que son líderes
  };
};
```

### 2. Modificar Query en Liquidaciones.tsx

Expandir la query para incluir información del especialista:

```typescript
const { data: liquidations, isLoading } = useQuery({
  queryKey: ['liquidations', filters],
  queryFn: async () => {
    let query = supabase
      .from('liquidations')
      .select(`
        *,
        specialist:specialists(id, name, email, team_leader_id),
        liquidation_items(id, total),
        liquidation_signatures(...)
      `)
      // ... existing filters

    const { data, error } = await query;
    if (error) throw error;
    
    // Post-process para consolidar equipos
    return consolidateTeamLiquidations(data);
  },
});
```

### 3. Función de Consolidación

```typescript
const consolidateTeamLiquidations = async (liquidations: any[]) => {
  // Identificar miembros de equipo (tienen team_leader_id)
  const memberLiquidations = liquidations.filter(
    l => l.specialist?.team_leader_id
  );
  
  // Identificar líderes (especialistas cuyos IDs aparecen como team_leader_id)
  const leaderIds = new Set(
    memberLiquidations.map(l => l.specialist.team_leader_id)
  );
  
  // Para cada liquidación de líder, encontrar y sumar las de sus miembros
  const enrichedLiquidations = liquidations.map(liq => {
    const isLeader = leaderIds.has(liq.specialist_id);
    
    if (!isLeader) return { ...liq, is_team: false };
    
    // Encontrar liquidaciones de miembros para el mismo período
    const memberLiqs = memberLiquidations.filter(ml => 
      ml.specialist.team_leader_id === liq.specialist_id &&
      ml.period_month === liq.period_month &&
      ml.period_year === liq.period_year
    );
    
    // Calcular total de equipo
    const memberTotal = memberLiqs.reduce(
      (sum, ml) => sum + (ml.calculated_total || 0), 0
    );
    const teamTotal = (liq.calculated_total || 0) + memberTotal;
    
    return {
      ...liq,
      is_team: true,
      team_total: teamTotal,
      leader_total: liq.calculated_total,
      team_members: memberLiqs.map(ml => ({
        id: ml.specialist_id,
        name: ml.specialist.name,
        total: ml.calculated_total,
        liquidation_id: ml.id,
      })),
    };
  });
  
  // Filtrar liquidaciones de miembros (no mostrar por separado)
  return enrichedLiquidations.filter(
    l => !l.specialist?.team_leader_id
  );
};
```

### 4. Actualizar LiquidationCard.tsx

```typescript
export const LiquidationCard = ({ liquidation, ... }) => {
  const isTeamLiquidation = liquidation.is_team;
  const displayTotal = isTeamLiquidation 
    ? liquidation.team_total 
    : liquidation.calculated_total;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {liquidation.specialist?.name}
              </CardTitle>
              {isTeamLiquidation && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  <Users className="h-3 w-3 mr-1" />
                  Equipo
                </Badge>
              )}
            </div>
            {/* Period badge */}
          </div>
          <LiquidationStatusBadge status={liquidation.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team members info */}
        {isTeamLiquidation && liquidation.team_members?.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Miembros:</span>{' '}
            {liquidation.team_members.map(m => m.name).join(', ')}
          </div>
        )}

        {/* Total display */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {isTeamLiquidation ? 'Total Equipo:' : 'Total:'}
          </span>
          <div className="text-right">
            <span className="text-lg font-bold">
              {formatCurrency(displayTotal)}
            </span>
            {isTeamLiquidation && (
              <div className="text-xs text-muted-foreground">
                ({formatCurrency(liquidation.leader_total)} + 
                {formatCurrency(liquidation.team_total - liquidation.leader_total)})
              </div>
            )}
          </div>
        </div>
        {/* Action buttons */}
      </CardContent>
    </Card>
  );
};
```

### 5. Actualizar LiquidationTableView.tsx

Añadir badge de equipo y mostrar total consolidado:

```typescript
<TableCell>
  <div className="flex items-center gap-2">
    {liquidation.specialist?.name || 'N/A'}
    {liquidation.is_team && (
      <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
        <Users className="h-3 w-3 mr-1" />
        Equipo
      </Badge>
    )}
  </div>
</TableCell>
<TableCell className="text-right">
  <div>
    <span className="font-semibold">
      {formatCurrency(liquidation.is_team ? liquidation.team_total : liquidation.calculated_total)}
    </span>
    {liquidation.is_team && (
      <Tooltip>
        <TooltipTrigger>
          <Info className="h-3 w-3 ml-1 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          Líder: {formatCurrency(liquidation.leader_total)}<br/>
          Miembros: {formatCurrency(liquidation.team_total - liquidation.leader_total)}
        </TooltipContent>
      </Tooltip>
    )}
  </div>
</TableCell>
```

## Comportamiento Esperado

### Lista de Liquidaciones (Cards/Tabla)
1. **Liquidaciones individuales**: Se muestran como siempre
2. **Liquidaciones de líderes de equipo**: 
   - Muestran badge "Equipo"
   - Total consolidado (líder + miembros)
   - Desglose al hover o debajo
3. **Liquidaciones de miembros de equipo**: NO aparecen (están incluidas en la del líder)

### Al hacer click en "Ver"
- Navega a `/liquidaciones/{id}` del líder
- El detalle ya muestra las tablas separadas (Daniela / Sandra)

### Filtros
- Filtrar por "Daniela" muestra su liquidación consolidada de equipo
- Filtrar por "Sandra" NO muestra resultados (su liquidación está oculta del listado)
- ¿Alternativa?: Mostrar la del equipo cuando se filtra por un miembro

## Consideraciones de UX

1. **Tooltip/Info**: Permitir ver desglose sin entrar al detalle
2. **Navegación directa a miembro**: En el tooltip/info, links a liquidaciones individuales para auditoría
3. **Exportación Excel**: Decidir si exportar consolidado o desglosado

## Notas Técnicas

- Los datos de liquidaciones individuales se mantienen en BD para auditoría
- La consolidación es solo a nivel de presentación en el listado
- El detalle ya maneja la visualización separada correctamente
- La selección múltiple para "Marcar como pagadas" debería marcar todas las del equipo

