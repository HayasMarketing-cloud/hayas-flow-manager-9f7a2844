# Integración B2BRouter - Plan Técnico

> **Estado**: Pendiente - Esperando suscripción B2BRouter y definición de requisitos
> **Fecha**: 2026-02-27

## Objetivo

Emitir facturas legalmente válidas (TicketBAI, Verifactu) desde Flow Manager usando la API de B2BRouter, partiendo de presupuestos aprobados.

## Flujo Propuesto

1. Presupuesto aprobado → botón "Emitir Factura"
2. Recoger datos: destinatario, conceptos, importes, datos fiscales, fecha emisión
3. Llamar a B2BRouter API (`POST /accounts/{account}/invoices`) via Edge Function
4. Almacenar `b2brouter_invoice_id` en tabla `invoices` local
5. Sincronizar estados via webhooks (opcional)

## API B2BRouter (v2025-10-13)

- **Base URL**: `https://app.b2brouter.net/api/v2`
- **Auth**: API Key en header `Authorization: Token token=API_KEY`
- **Crear factura**: `POST /accounts/{account_id}/invoices`
- **Emitir**: `POST /invoices/{id}/send` (genera PDF, FacturaE, UBL)
- **Consultar estado**: `GET /invoices/{id}`
- **Webhooks**: Para sincronizar estados (sent, received, accepted, rejected)

## Cambios Necesarios

### 1. Base de datos
- Añadir columna `b2brouter_invoice_id` a tabla `invoices`
- Añadir columna `b2brouter_status` a tabla `invoices`
- Tabla `b2brouter_config` para account_id y configuración fiscal

### 2. Edge Function: `create-b2brouter-invoice`
- Mapear datos del presupuesto/factura al schema B2BRouter
- Campos clave: `invoice_lines`, `accounting_customer_party`, `tax_totals`
- Secret necesario: `B2BROUTER_API_KEY`

### 3. Edge Function: `b2brouter-webhook` (fase 2)
- Recibir cambios de estado desde B2BRouter
- Actualizar `b2brouter_status` en tabla local

### 4. UI
- Botón "Emitir Factura" en detalle de presupuesto aprobado
- Preview de datos antes de emitir
- Indicador de estado B2BRouter en listado de facturas

## Mapeo de Datos Flow Manager → B2BRouter

| Flow Manager | B2BRouter Field |
|---|---|
| client.name | accounting_customer_party.name |
| client.tax_id | accounting_customer_party.tax_identification |
| client.address | accounting_customer_party.address |
| budget_items[].description | invoice_lines[].description |
| budget_items[].quantity | invoice_lines[].quantity |
| budget_items[].unit_price | invoice_lines[].price |
| invoice.tax_rate | tax_totals[].tax_percent |
| invoice.invoice_date | issue_date |
| invoice.due_date | due_date |

## Requisitos Previos

- [ ] Suscripción activa en B2BRouter con acceso API
- [ ] API Key de producción o staging
- [ ] Account ID de B2BRouter
- [ ] Definir datos fiscales del emisor (empresa)
- [ ] Definir plantilla de factura deseada
- [ ] Clarificar requisitos de cumplimiento fiscal (TicketBAI, Verifactu, etc.)

## Fases

1. **MVP**: Crear factura desde presupuesto aprobado (sin webhooks)
2. **Sync**: Webhooks para sincronización bidireccional de estados
3. **Avanzado**: Plantillas personalizadas, series de facturación, notas de crédito
