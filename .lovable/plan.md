
# Plan: Corregir Email y PDF de Liquidaciones de Equipo

## Problema Identificado

Cuando se envía el email de una liquidación de equipo desde la vista de lista (`Liquidaciones.tsx`):

| Componente | Valor Correcto | Valor Actual |
|------------|----------------|--------------|
| Card (UI) | **1.352,50 €** (team_total) | 1.352,50 € |
| Email preview | **1.352,50 €** | 512,50 € (individual) |
| Email enviado | **1.352,50 €** | 512,50 € |
| PDF adjunto | Secciones separadas para líder y miembros | Solo items del líder |

El objeto `liquidation` consolidado tiene los datos del equipo (`is_team`, `team_total`, `team_members`, `member_liquidation_ids`) pero la función `confirmSendEmail` no los usa.

Además, en `LiquidacionDetalle.tsx`, aunque se pasa `teamData` al PDF correctamente, el `totalAmount` enviado al email sigue siendo el individual.

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/liquidations/EmailPreviewModal.tsx` | Mostrar total de equipo cuando `is_team=true` |
| `src/pages/Liquidaciones.tsx` | Modificar `confirmSendEmail` para obtener items de miembros y pasar `teamData` al PDF |
| `src/pages/LiquidacionDetalle.tsx` | Usar `teamData.teamTotal` para el email cuando es equipo |

## Cambios Detallados

### 1. EmailPreviewModal.tsx

Detectar si la liquidación es de equipo y mostrar el total consolidado:

```tsx
// Línea 47 - Cambiar la lógica del totalAmount
const isTeamLiquidation = liquidation.is_team && liquidation.team_total;
const totalAmount = isTeamLiquidation 
  ? liquidation.team_total 
  : (liquidation.calculated_total ?? liquidation.total_amount ?? 0);
```

Agregar indicador visual de equipo en la preview del email cuando corresponda:
- Mostrar badge "Equipo" junto al total
- Añadir desglose (ej: "512,50 € + 840,00 €")

### 2. Liquidaciones.tsx - confirmSendEmail

Modificar la función para manejar equipos:

```typescript
const confirmSendEmail = async () => {
  if (!liquidationToSend) return;
  const liquidation = liquidationToSend;
  setIsSendingEmail(true);
  setSendingLiquidationId(liquidation.id);

  try {
    // 1. Fetch leader's items
    const { data: leaderItems, error: itemsError } = await supabase
      .from('liquidation_items')
      .select(`*, financial_request:financial_requests(...)`)
      .eq('liquidation_id', liquidation.id);

    if (itemsError) throw itemsError;

    // 2. If team liquidation, fetch member items too
    let teamData = undefined;
    if (liquidation.is_team && liquidation.member_liquidation_ids?.length > 0) {
      const memberPromises = liquidation.team_members.map(async (member) => {
        const { data: memberItems } = await supabase
          .from('liquidation_items')
          .select(`*, financial_request:financial_requests(...)`)
          .eq('liquidation_id', member.liquidation_id);
        
        return {
          specialist: { name: member.name },
          liquidation_items: memberItems || [],
          calculated_total: member.total,
          code: '',
        };
      });

      const members = await Promise.all(memberPromises);
      teamData = {
        members,
        teamTotal: liquidation.team_total,
      };
    }

    // 3. Generate PDF with team data
    const pdfBase64 = await generateLiquidationPDFBase64({
      liquidation,
      items: leaderItems || [],
      specialist: liquidation.specialist,
      teamData,
    });

    // 4. Send email with correct total
    const totalForEmail = liquidation.is_team 
      ? liquidation.team_total 
      : (liquidation.calculated_total ?? liquidation.total_amount);

    await supabase.functions.invoke('send-liquidation-email', {
      body: {
        ...
        totalAmount: totalForEmail,
        ...
      },
    });

    // 5. Update status for ALL team liquidations
    if (liquidation.is_team && liquidation.member_liquidation_ids?.length > 0) {
      const allIds = [liquidation.id, ...liquidation.member_liquidation_ids];
      await supabase
        .from('liquidations')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', allIds);
    } else {
      await supabase
        .from('liquidations')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', liquidation.id);
    }
    
    ...
  }
};
```

### 3. LiquidacionDetalle.tsx

Corregir el `totalAmount` enviado al email (línea 522):

```typescript
// Antes:
totalAmount: liquidation.calculated_total ?? liquidation.total_amount,

// Después:
totalAmount: (hasTeam && teamData) 
  ? teamData.teamTotal 
  : (liquidation.calculated_total ?? liquidation.total_amount),
```

## Resultado Esperado

| Componente | Después del Fix |
|------------|-----------------|
| Card (UI) | 1.352,50 € (sin cambios) |
| Email preview | **1.352,50 €** con badge "Equipo" y desglose |
| Email enviado | **1.352,50 €** (total equipo) |
| PDF adjunto | Secciones separadas: Daniela (líder) + Sandra (miembro) + Total Equipo |

## Flujo de Firma

Cuando el líder de equipo firma (acepta/disputa), las liquidaciones de todos los miembros ya se actualizan automáticamente según la memoria del proyecto (`specialist-team-consolidation`).
