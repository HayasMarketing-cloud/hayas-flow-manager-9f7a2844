# Reporte: Liquidación IRPF Trimestral

## Objetivo

Nueva sección de Finanzas para prever cuánto IRPF retenido a especialistas hay que ingresar a Hacienda cada trimestre. El IRPF se devenga al **pagar** la factura del especialista y se ingresa en el modelo 111 sobre el día 20 del mes siguiente al cierre del trimestre.

Trimestres y fechas de pago a Hacienda:
- **1T** (ene + feb + mar) → pagar ~20 abril
- **2T** (abr + may + jun) → pagar ~20 julio
- **3T** (jul + ago + sep) → pagar ~20 octubre
- **4T** (oct + nov + dic) → pagar ~20 enero (año siguiente)

## Criterio de devengo

El IRPF se considera devengado en el **mes en que se paga la factura del especialista** (`liquidations.paid_at` o, si está vacío, `liquidations.updated_at` cuando `status = 'paid'`).

**Importante**: solo se contabilizan facturas de liquidaciones efectivamente pagadas + facturas pendientes con IRPF (estas se muestran como "previsión"). Esto permite ver tanto lo ya devengado como lo previsto para el trimestre en curso.

## Fuente de datos

Tabla `liquidation_invoices` (campo `irpf_amount`) JOIN con `liquidations` (campos `specialist_id`, `status`, `paid_at`) JOIN con `specialists` (campo `name`).

```text
SELECT
  l.specialist_id, s.name,
  COALESCE(l.paid_at, l.updated_at) AS devengo_date,
  li.irpf_amount,
  l.status
FROM liquidation_invoices li
JOIN liquidations l ON l.id = li.liquidation_id
JOIN specialists s ON s.id = l.specialist_id
WHERE li.irpf_amount IS NOT NULL AND li.irpf_amount > 0
```

## Nuevo reporte en `/reportes`

Añadir una **5ª (en realidad 6ª) tarjeta** en el grid de reportes: **"Liquidación IRPF Trimestral"** con icono `Receipt`.

### UI cuando se selecciona

Selector de **Año** (sin mes — el reporte siempre es anual con desglose trimestral).

Cuatro bloques de tarjetas (uno por trimestre) con esta estructura:

```text
┌────────────────────────────────────────────────────┐
│ 1T 2026 · Pago a Hacienda: 20 abril 2026          │
│ Total IRPF a ingresar: 1.234,56 €                  │
├────────────────────────────────────────────────────┤
│ Especialista     │ Enero │ Febrero │ Marzo │ Total │
│ Iolanda Carbone  │ 150 € │  150 €  │ 200 € │ 500 € │
│ ...              │       │         │       │       │
│ TOTAL MES        │ 350 € │  400 €  │ 484 € │1.234 €│
└────────────────────────────────────────────────────┘
```

Cada celda mes/especialista muestra la suma de `irpf_amount` de las facturas pagadas en ese mes. Filas de especialistas ordenadas por total descendente.

Indicador visual (badge) por trimestre:
- **"Cerrado"** (verde) si todas las liquidaciones del trimestre están en `paid` y la fecha actual es posterior al día 20 del mes de pago.
- **"Pendiente liquidar"** (ámbar) si el trimestre ya cerró pero aún no se ha ingresado a Hacienda.
- **"En curso"** (azul) si el trimestre está activo.
- **"Previsión"** (gris) si es trimestre futuro.

Mostrar también un mini-resumen al pie: cuánto del total son liquidaciones ya pagadas (cierto) vs pendientes con IRPF declarado (previsión).

### Exportación a Excel

Botón "Exportar a Excel" genera una hoja con la matriz completa: una fila por especialista × 12 meses + columna total trimestral y total anual. Filas adicionales de totales por mes y trimestre. Útil para declarar el modelo 111 cada trimestre.

## Cambios concretos

### 1. `src/pages/Reportes.tsx`
- Añadir `'irpf_quarterly'` al tipo `ReportType`.
- Añadir su tarjeta al array `reports` (icono `Receipt`).
- Añadir nuevo `useQuery` que cargue todas las `liquidation_invoices` del año con sus `liquidations` y `specialists`, agrupando por especialista y mes.
- Añadir bloque de renderizado dedicado cuando `selectedReport === 'irpf_quarterly'` con las 4 tarjetas trimestrales.
- Cuando este reporte está seleccionado, ocultar el selector de mes (solo año).
- Implementar `handleExportReport` para este caso usando `downloadExcel`.

### 2. Nuevo hook `src/hooks/useIrpfQuarterly.tsx` (opcional, para mantener `Reportes.tsx` manejable)
- Encapsula la query y devuelve la matriz `{ specialistId, name, monthly: number[12], quarterly: number[4], yearTotal }[]` + totales por mes/trimestre/año + estado de cada trimestre.

### 3. (Opcional) Acceso directo desde `/dashboard` de Finanzas
- Añadir un widget pequeño en el dashboard mensual que muestre el IRPF del trimestre en curso, con enlace al reporte completo. **Lo dejo fuera del alcance inicial** salvo que lo pidas explícitamente.

## Permisos

El reporte sigue las mismas políticas RLS existentes: solo `admin` y `finanzas` ven todas las facturas de liquidación con IRPF. AM/PM no ven este reporte (la tarjeta se mostrará pero la query devolverá vacío, lo cual es coherente con el resto de la página).

## No incluido

- Cálculo automático del modelo 111 oficial ni envío a Hacienda.
- IVA trimestral (modelo 303) — si lo quieres después es trivial replicar este patrón con `tax_amount` y facturas emitidas (`invoices.tax_amount`).
- Marcar trimestres como "pagados a Hacienda" (no hay tabla para eso todavía; se puede añadir en una iteración futura).
