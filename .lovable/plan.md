

# Plan: Registrar Códigos de Partner en Solicitudes (Financial Requests)

## Contexto del Problema

El partner **Wolfestone** trabaja con códigos de proyecto propios (ej: `P1225-5602-4821`) que agrupan múltiples traducciones enviadas en un mismo email. Actualmente:

| Situación Actual | Problema |
|------------------|----------|
| Cada traducción = 1 `financial_request` con código `REQ-XXXX` | El código interno `REQ-2026-045` no coincide con el código de Wolfestone |
| No hay campo para registrar código de partner | Cuando Wolfestone factura con `P1225-5602-4821`, es difícil saber qué requests incluye |
| No se puede agrupar requests por código de partner | Imposible filtrar todas las traducciones de un mismo "lote" |

### Ejemplo del Email Recibido
```
De: Oana Ivan <oana.ivan@wolfestonegroup.co.uk>
Subject: P1225-5602-4821
Adjuntos: 6 documentos traducidos
```

Este código `P1225-5602-4821` agrupa varias traducciones que están en diferentes `financial_requests`.

---

## Solución Propuesta

### Fase 1: Añadir Campo "Código de Partner" a Requests

Añadir un nuevo campo `partner_reference` a la tabla `financial_requests` para almacenar el código de referencia del proveedor/partner.

**Migración SQL:**
```sql
ALTER TABLE financial_requests 
ADD COLUMN partner_reference VARCHAR(100);

-- Índice para búsquedas rápidas
CREATE INDEX idx_financial_requests_partner_reference 
ON financial_requests(partner_reference) 
WHERE partner_reference IS NOT NULL;

-- Comentario descriptivo
COMMENT ON COLUMN financial_requests.partner_reference IS 
'Código de referencia del partner/proveedor (ej: P1225-5602-4821 de Wolfestone)';
```

### Fase 2: Actualizar Formulario de Solicitudes

Modificar `RequestFormModal.tsx` para incluir el nuevo campo:

| Campo | Tipo | Ubicación | Descripción |
|-------|------|-----------|-------------|
| **Ref. Partner** | Input texto | Junto a "Especialista" | Código de proyecto del proveedor |

**Comportamiento:**
- Campo opcional
- Solo visible si el especialista seleccionado es tipo "partner"
- Placeholder: "Ej: P1225-5602-4821"
- Autocompletado con valores usados recientemente para el mismo partner

### Fase 3: Mostrar en Tabla y Detalle

**En `RequestTableView.tsx`:**
- Nueva columna "Ref. Partner" después de "Especialista"
- Solo visible si hay datos
- Link para filtrar todas las requests con el mismo código

**En `SolicitudDetalle.tsx`:**
- Card dedicada mostrando el código de partner
- Lista de otras requests vinculadas al mismo código de partner

---

## Diseño Visual

### Formulario de Edición
```
┌────────────────────────────────────────────────────────────┐
│  Especialista                    │  Ref. Partner          │
│  [▼ WOLFESTONE          ]        │  [ P1225-5602-4821   ] │
│                                  │  ⓘ Código de proyecto   │
│                                  │    del proveedor        │
└────────────────────────────────────────────────────────────┘
```

### Tabla de Solicitudes
```
│ Código      │ Título            │ Especialista │ Ref. Partner   │
│─────────────│───────────────────│──────────────│────────────────│
│ REQ-2026-045│ Translation EN>BE │ WOLFESTONE   │ P1225-5602-4821│
│ REQ-2026-046│ Translation EN>DK │ WOLFESTONE   │ P1225-5602-4821│
│ REQ-2026-047│ Translation EN>SE │ WOLFESTONE   │ P1225-5602-4821│
```

### Detalle de Solicitud
```
┌──────────────────────────────────────────────────────────────┐
│ 🏷️ Referencia Partner                                        │
│ ─────────────────────────────────────────────────────────────│
│ Código: P1225-5602-4821                                      │
│ Partner: WOLFESTONE                                          │
│                                                              │
│ Otras solicitudes con este código:                           │
│ • REQ-2026-045 - Translation EN>BE                           │
│ • REQ-2026-046 - Translation EN>DK                           │
│ • REQ-2026-047 - Translation EN>SE                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `migrations/add_partner_reference.sql` | Añadir columna `partner_reference` |
| `src/components/modals/RequestFormModal.tsx` | Añadir campo de entrada |
| `src/components/requests/RequestTableView.tsx` | Añadir columna en tabla |
| `src/pages/SolicitudDetalle.tsx` | Mostrar card con referencia y requests relacionados |
| `src/pages/Solicitudes.tsx` | Añadir filtro por código de partner |

---

## Funcionalidad Extra: Filtros y Búsqueda

### Filtrar por Código de Partner
- Añadir dropdown/search en la página de Solicitudes
- Mostrar lista de códigos únicos con contador: `P1225-5602-4821 (3 requests)`

### Exportación
- Incluir columna "Ref. Partner" en exportación CSV

---

## Beneficios

| Beneficio | Descripción |
|-----------|-------------|
| **Trazabilidad** | Vincular factura del partner con requests específicos |
| **Agrupación** | Ver todas las traducciones de un mismo lote |
| **Reconciliación** | Cuando llegue factura de Wolfestone, filtrar por su código |
| **Histórico** | Mantener registro del código original del partner |

---

## Flujo de Uso

```
1. Wolfestone envía email con código "P1225-5602-4821" y 6 documentos
   
2. Usuario edita cada request relacionado y añade el código de partner
   
3. Cuando llega la factura de Wolfestone:
   - Filtrar requests por "P1225-5602-4821"
   - Ver total a pagar
   - Verificar contra factura recibida
```

---

## Detalles Técnicos

### Schema del Campo
```typescript
// En requestSchema de RequestFormModal.tsx
partner_reference: z.string().max(100).optional().nullable(),
```

### Query para Requests Relacionados
```typescript
// En SolicitudDetalle.tsx
const { data: relatedRequests } = useQuery({
  queryKey: ['related-partner-requests', request?.partner_reference],
  queryFn: async () => {
    if (!request?.partner_reference) return [];
    const { data, error } = await supabase
      .from('financial_requests')
      .select('id, code, title')
      .eq('partner_reference', request.partner_reference)
      .neq('id', request.id)
      .order('created_at', { ascending: true });
    return data || [];
  },
  enabled: !!request?.partner_reference,
});
```

### Filtro en Página de Solicitudes
```typescript
// Añadir a useRequestFilters.tsx
partner_reference: string | null;

// En la query
if (filters.partner_reference) {
  query = query.eq('partner_reference', filters.partner_reference);
}
```

