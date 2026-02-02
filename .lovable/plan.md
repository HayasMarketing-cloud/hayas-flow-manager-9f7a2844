
## Objetivo
Añadir la columna "Solicitado por" (Request By / client_contact) a la exportación CSV de requests.

---

## Diagnóstico

### Situación actual:
1. **En la base de datos**: Los requests (`financial_requests`) tienen un campo `client_contact_id` que referencia a `client_contacts`.
2. **En la página de detalle** (`SolicitudDetalle.tsx`): Se muestra correctamente el "Contacto Solicitante" cuando existe.
3. **En la query del listado** (`Solicitudes.tsx`): **NO** se está haciendo join a `client_contacts`, por lo que el campo no está disponible para exportar.
4. **En el exportador** (`requestsExporter.ts`): No existe una columna para el contacto solicitante.

### Columna "Origen" en el listado:
La columna "Origen" que muestra "HubSpot Reques..." en la interfaz en realidad muestra el nombre del `client_contact` asociado al request.

---

## Cambios a realizar

### 1. Actualizar la query en `src/pages/Solicitudes.tsx`
Añadir el join a `client_contacts` para tener el dato disponible:

```diff
  let query = supabase
    .from('financial_requests')
    .select(`
      *,
      client:clients(id, name, code),
      service:services(id, name),
      specialist:specialists(id, name),
      budget:budgets(id, title, code, client_contact_id),
      contract:contracts(id, title, code),
      invoice:invoices(id, code, status),
      liquidation:liquidations(id, code, status),
+     client_contact:client_contacts(id, name),
      operational_request:operational_requests!financial_request_id(
        id,
        operational_project:operational_projects(id, name)
      )
    `)
```

### 2. Actualizar el exportador `src/utils/excel/requestsExporter.ts`
Añadir columna "Solicitado por":

**Headers:**
```typescript
const headers = [
  'Código',
  'Título',
  'Cliente',
  'Servicio',
  'Especialista',
  'Ref. Partner',
+ 'Solicitado por',  // Nueva columna
  'Estado',
  'Cantidad',
  'Precio Unit.',
  'Total',
  'Coste',
  'Margen',
  'Fecha Creación',
  'Completado',
  'Facturado',
  'Liquidado',
];
```

**Filas de datos:**
```typescript
const rows = requests.map((request) => [
  request.code || '-',
  request.title || '-',
  request.client?.name || '-',
  request.service?.name || '-',
  request.specialist?.name || '-',
  request.partner_reference || '-',
+ request.client_contact?.name || '-',  // Nueva columna
  request.status || '-',
  // ... resto igual
]);
```

**Fila de totales:**
Ajustar para que tenga el número correcto de columnas vacías (una más).

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Solicitudes.tsx` | Añadir join a `client_contacts` en la query |
| `src/utils/excel/requestsExporter.ts` | Añadir columna "Solicitado por" |

---

## Resultado esperado
Al exportar el listado de requests a CSV, aparecerá una nueva columna "Solicitado por" con el nombre del contacto asociado a cada request.
