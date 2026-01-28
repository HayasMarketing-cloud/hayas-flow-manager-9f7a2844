
# Plan: Equipos de Especialistas con Liquidaciones Consolidadas

## Concepto

Implementar un sistema de **equipos de especialistas** donde un usuario (líder de equipo) puede gestionar y recibir liquidaciones consolidadas de múltiples especialistas.

### Caso de uso específico:
- **Daniela** es el contacto/líder para su equipo
- El equipo incluye a **Daniela** y **Sandra**
- Daniela recibirá UNA liquidación consolidada que muestra:
  - Desglose de trabajos de Daniela (subtotal)
  - Desglose de trabajos de Sandra (subtotal)
  - **Total del equipo** = Subtotal Daniela + Subtotal Sandra

---

## Cambios en Base de Datos

### 1. Nueva columna en `specialists`

Añadir una columna para indicar el líder del equipo:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `team_leader_id` | uuid (nullable) | Referencia al specialist que lidera el equipo |

Cuando `team_leader_id` es NULL, el especialista es independiente o es él mismo el líder.

**Ejemplo:**
- Daniela: `team_leader_id = NULL` (es líder)
- Sandra: `team_leader_id = Daniela.id` (miembro del equipo de Daniela)

### 2. Nueva tabla (opcional): `team_liquidations`

Para consolidar liquidaciones de equipo:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | Clave primaria |
| `code` | varchar | Código de liquidación de equipo (ej: TLIQ-2026-001) |
| `team_leader_id` | uuid | Referencia al specialist líder |
| `period_month` | int | Mes del período |
| `period_year` | int | Año del período |
| `total_amount` | numeric | Suma de todas las liquidaciones del equipo |
| `status` | liquidation_status | Estado de la liquidación consolidada |
| `member_liquidations` | uuid[] | IDs de las liquidaciones individuales incluidas |

---

## Opciones de Implementación

### Opción A: Enfoque Sencillo (Recomendado para MVP)

**Solo usar `team_leader_id` en `specialists`:**

1. Sandra apunta a Daniela como líder
2. Al generar liquidación de "equipo", se buscan todas las liquidaciones del período de especialistas donde `team_leader_id = Daniela.id` O `id = Daniela.id`
3. Se genera un PDF consolidado con secciones por especialista
4. Se envía UN email a Daniela con el PDF consolidado
5. Daniela firma por todo el equipo

**Ventajas:** Mínimos cambios en DB, aprovecha liquidaciones individuales existentes
**Desventajas:** Hay que gestionar el estado de múltiples liquidaciones

### Opción B: Enfoque Completo (Para escalar)

**Crear tabla `team_liquidations` que agrupa liquidaciones:**

1. Las liquidaciones individuales (Daniela, Sandra) se crean normalmente
2. Se crea una `team_liquidation` que referencia ambas
3. El email y firma van sobre la liquidación de equipo
4. El estado de las liquidaciones individuales se sincroniza con la de equipo

**Ventajas:** Mayor control, mejor trazabilidad
**Desventajas:** Más complejidad, más tablas

---

## Plan de Implementación Recomendado (Opción A)

### Fase 1: Base de Datos

```sql
-- Añadir columna team_leader_id a specialists
ALTER TABLE specialists 
ADD COLUMN team_leader_id uuid REFERENCES specialists(id);

-- Índice para consultas eficientes
CREATE INDEX idx_specialists_team_leader ON specialists(team_leader_id);

-- Ejemplo: Vincular Sandra al equipo de Daniela
UPDATE specialists 
SET team_leader_id = '4b8cdf79-270f-4c0b-8dc7-f371e63aab5b'  -- ID de Daniela
WHERE id = 'a9b073eb-9c82-484b-8041-07dffcf0d3a7';  -- ID de Sandra
```

### Fase 2: Frontend - Formulario de Especialista

Añadir campo "Líder de equipo" opcional al crear/editar especialista.

### Fase 3: Lógica de Liquidaciones

1. **Nueva vista "Liquidación de Equipo":**
   - Muestra especialistas del equipo con sus liquidaciones del período
   - Permite validar todas juntas
   - Genera PDF consolidado

2. **Modificar envío de email:**
   - Detectar si el especialista tiene miembros de equipo
   - Incluir todas las liquidaciones del equipo en un solo email
   - Un único enlace de firma para todo el equipo

3. **PDF Consolidado:**
   - Sección por cada especialista con sus trabajos
   - Subtotal por especialista
   - Total del equipo al final

### Fase 4: Flujo de Firma

- Cuando Daniela firma, se actualizan todas las liquidaciones del equipo a "aceptada"
- Notificaciones solo a admin/finanzas (ya implementado)

---

## Resumen Visual del Flujo

```text
┌─────────────────────────────────────────────────────────────┐
│                    EQUIPO DANIELA                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐       ┌─────────────────┐              │
│  │    DANIELA      │       │     SANDRA      │              │
│  │  (team_leader)  │◄──────│ (team_member)   │              │
│  │  user: daniela@ │       │  user: null     │              │
│  └────────┬────────┘       └────────┬────────┘              │
│           │                         │                       │
│           ▼                         ▼                       │
│  ┌─────────────────┐       ┌─────────────────┐              │
│  │ LIQ-2026-009    │       │ LIQ-2026-005    │              │
│  │ Subtotal: €512  │       │ Subtotal: €840  │              │
│  └────────┬────────┘       └────────┬────────┘              │
│           │                         │                       │
│           └─────────┬───────────────┘                       │
│                     ▼                                       │
│           ┌─────────────────────┐                           │
│           │  EMAIL CONSOLIDADO  │                           │
│           │  TOTAL: €1.352      │                           │
│           │  Firma: daniela@    │                           │
│           └─────────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `specialists` tabla | Añadir `team_leader_id` |
| `SpecialistFormModal.tsx` | Campo para seleccionar líder de equipo |
| `Liquidaciones.tsx` | Detectar equipos y mostrar vista consolidada |
| `LiquidacionDetalle.tsx` | Mostrar liquidación de equipo con desglose |
| `liquidationPDFGenerator.ts` | Generar PDF con secciones por especialista |
| `send-liquidation-email/index.ts` | Enviar email consolidado del equipo |
| `process-signature/index.ts` | Actualizar todas las liquidaciones del equipo |
| RLS policies | Permitir que líder vea liquidaciones de su equipo |

---

## Pregunta para definir alcance

¿Prefieres que implementemos la **Opción A (sencilla)** donde Sandra simplemente apunta a Daniela como líder y consolidamos las liquidaciones existentes, o la **Opción B (completa)** con una tabla separada para liquidaciones de equipo?
