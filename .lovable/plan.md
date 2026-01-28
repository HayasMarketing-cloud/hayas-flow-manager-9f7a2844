

# Plan: Separar Tablas de Items por Especialista en Liquidaciones de Equipo

## Contexto

Cuando se visualiza la liquidación de un líder de equipo (como Daniela), actualmente se muestra una única tabla con los items de la liquidación del líder. El usuario solicita que se muestren **dos tablas separadas**:
1. Una tabla con los items/requests de Daniela (líder)
2. Una tabla con los items/requests de Sandra (miembro del equipo)

Esto debe aplicar tanto a la vista web como al PDF exportable.

## Diseño Visual Propuesto

```
┌────────────────────────────────────────────────────────────────┐
│  Trabajos de Daniela Puntriano                   Líder         │
│  ────────────────────────────────────────────────────────────  │
│  Código  │ Descripción   │ Cliente  │ Cant │ P.Unit │ Total   │
│  REQ-001 │ Diseño web    │ Acme     │ 1    │ 200€   │ 200€    │
│  REQ-002 │ SEO básico    │ Corp S.A │ 1    │ 150€   │ 150€    │
│  ────────────────────────────────────────────────────────────  │
│                                        Subtotal: 350,00 €      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Trabajos de Sandra Vásquez                      Miembro       │
│  ────────────────────────────────────────────────────────────  │
│  Código  │ Descripción   │ Cliente  │ Cant │ P.Unit │ Total   │
│  REQ-003 │ Contenido     │ Acme     │ 1    │ 100€   │ 100€    │
│  REQ-004 │ Redes social  │ Tech Ltd │ 1    │ 240€   │ 240€    │
│  ────────────────────────────────────────────────────────────  │
│                                        Subtotal: 340,00 €      │
└────────────────────────────────────────────────────────────────┘
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/LiquidacionDetalle.tsx` | Separar tabla de items por especialista cuando hay equipo |
| `src/utils/pdf/liquidationPDFGenerator.ts` | Generar secciones separadas por especialista en el PDF |
| `src/hooks/useTeamMembers.ts` | Ajustar para incluir datos necesarios (ya casi completo) |

## Implementación Detallada

### 1. Modificar LiquidacionDetalle.tsx (líneas 736-817)

**Antes**: Una única tabla con `liquidation.liquidation_items`

**Después**: 
- Si `hasTeam && teamData`, mostrar múltiples Cards/Tables:
  - Card 1: "Trabajos de {nombre líder}" con badge "Líder de equipo"
  - Card 2+: "Trabajos de {nombre miembro}" con badge "Miembro del equipo"
- Cada tabla muestra el subtotal del especialista
- Mantener funcionalidad de navegación a request y eliminar item (solo para items del líder)

```typescript
{/* Items Tables - Separated by Specialist when team exists */}
{hasTeam && teamData ? (
  <>
    {/* Leader's Items */}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Trabajos de {liquidation.specialist?.name}</CardTitle>
          <Badge variant="outline" className="text-blue-600">Líder de equipo</Badge>
        </div>
        {isEditable && canAccessFinance() && (
          <Button variant="outline" size="sm" onClick={() => setAddRequestsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Añadir Solicitudes
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Tabla con items del líder */}
        {/* Footer con subtotal: {formatCurrency(liquidation.calculated_total)} */}
      </CardContent>
    </Card>

    {/* Team Members' Items */}
    {teamData.members.map((memberLiq: any) => (
      <Card key={memberLiq.id}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Trabajos de {memberLiq.specialist?.name}</CardTitle>
            <Badge variant="outline">Miembro del equipo</Badge>
          </div>
          <Badge variant="secondary">{memberLiq.code}</Badge>
        </CardHeader>
        <CardContent>
          {/* Tabla con items del miembro (read-only, navegable) */}
          {/* Footer con subtotal: {formatCurrency(memberLiq.calculated_total)} */}
        </CardContent>
      </Card>
    ))}
  </>
) : (
  /* Tabla única actual para liquidaciones sin equipo */
)}
```

### 2. Modificar liquidationPDFGenerator.ts

Añadir soporte para datos de equipo en la interfaz y generación:

**Actualizar interfaz LiquidationData:**
```typescript
interface LiquidationData {
  liquidation: any;
  items: any[];
  specialist: any;
  pendingRequests?: PendingRequest[];
  companyInfo?: {...};
  // Nuevo campo para equipo
  teamData?: {
    members: {
      specialist: { name: string };
      liquidation_items: any[];
      calculated_total: number;
      code: string;
    }[];
    teamTotal: number;
  };
}
```

**Modificar generación de tablas:**
- Detectar si hay `teamData`
- Si hay equipo: generar sección por especialista
  - Título: "TRABAJOS DE {NOMBRE} - {TIPO}"
  - Tabla con items agrupados por cliente
  - Subtotal por especialista
- Al final: "TOTAL EQUIPO A PAGAR: X €"
- Si no hay equipo: mantener comportamiento actual

```typescript
// En generateLiquidationPDF y generateLiquidationPDFBase64:

if (data.teamData && data.teamData.members.length > 0) {
  // Sección del líder
  doc.setFont('helvetica', 'bold');
  doc.text(`TRABAJOS DE ${data.specialist.name.toUpperCase()} - LÍDER DE EQUIPO`, 15, startY);
  // ... tabla con items del líder y subtotal

  // Secciones de miembros
  data.teamData.members.forEach(member => {
    doc.text(`TRABAJOS DE ${member.specialist.name.toUpperCase()} - MIEMBRO DEL EQUIPO`, 15, startY);
    // ... tabla con items del miembro y subtotal
  });

  // Total equipo
  doc.text('TOTAL EQUIPO A PAGAR:', totalsX, finalY);
  doc.text(formatCurrency(data.teamData.teamTotal), pageWidth - 15, finalY, { align: 'right' });
} else {
  // Comportamiento actual
}
```

### 3. Actualizar llamadas a PDF en LiquidacionDetalle.tsx

**En handleDownloadPDF:**
```typescript
const handleDownloadPDF = async () => {
  // ... existing code ...
  
  await generateLiquidationPDF({
    liquidation,
    items: liquidation.liquidation_items || [],
    specialist: liquidation.specialist,
    pendingRequests: pendingRequests || [],
    // Añadir datos de equipo si existen
    teamData: hasTeam && teamData ? {
      members: teamData.members,
      teamTotal: teamData.teamTotal,
    } : undefined,
  });
};
```

**En handleSendEmail:**
```typescript
const pdfBase64 = await generateLiquidationPDFBase64({
  liquidation,
  items: liquidation.liquidation_items || [],
  specialist: liquidation.specialist,
  pendingRequests: pendingRequests || [],
  teamData: hasTeam && teamData ? {
    members: teamData.members,
    teamTotal: teamData.teamTotal,
  } : undefined,
});
```

## Comportamiento Esperado

1. **Vista Web (Liquidación de líder con equipo)**:
   - Card "Trabajos de Daniela Puntriano" con badge "Líder de equipo" y subtotal
   - Card "Trabajos de Sandra Vásquez" con badge "Miembro del equipo" y subtotal
   - Clicks en códigos navegan a detalle de request
   - Botón eliminar solo en items del líder (su propia liquidación)

2. **Vista Web (Liquidación sin equipo)**:
   - Comportamiento actual sin cambios

3. **PDF (Liquidación de líder con equipo)**:
   - Sección "TRABAJOS DE DANIELA PUNTRIANO - LÍDER DE EQUIPO" con tabla y subtotal
   - Sección "TRABAJOS DE SANDRA VÁSQUEZ - MIEMBRO DEL EQUIPO" con tabla y subtotal
   - "TOTAL EQUIPO A PAGAR: 1.352,50 €"

4. **PDF (Liquidación sin equipo)**:
   - Comportamiento actual sin cambios

## Notas Técnicas

- Los datos de `teamData.members` ya incluyen `liquidation_items` con la información necesaria (hook existente)
- La edición (añadir/eliminar items) solo aplica a la liquidación del líder
- El PDF debe considerar saltos de página si hay muchos items

