

# Plan: Corregir los 11 Requests Afectados

## Datos Identificados

Encontré los 11 requests que fueron afectados por el cambio masivo incorrecto. Todos tienen `cost_to_agency = 25` pero deberían tener el valor calculado como `cost_rate × hours`.

## Corrección a Aplicar

| Código | Horas | cost_rate | cost_to_agency (correcto) |
|--------|-------|-----------|---------------------------|
| REQ-2026-030 | 3 | 25 € | 75 € |
| REQ-2026-031 | 1.5 | 25 € | 37.50 € |
| REQ-2026-032 | 2 | 25 € | 50 € |
| REQ-2026-033 | 2 | 25 € | 50 € |
| REQ-2026-034 | 2 | 25 € | 50 € |
| REQ-2026-035 | 2 | 25 € | 50 € |
| REQ-2026-036 | 3 | 25 € | 75 € |
| REQ-2026-041 | 3 | 25 € | 75 € |
| REQ-2026-042 | 3 | 25 € | 75 € |
| REQ-2026-043 | 1 | 25 € | 25 € |
| REQ-2026-044 | 1 | 25 € | 25 € |

## Acción

Ejecutar UPDATE en la base de datos para los 11 registros:

```sql
UPDATE financial_requests
SET 
  cost_rate = 25,
  cost_to_agency = 25 * hours
WHERE id IN (
  'f2dff66e-4d9b-407d-8f5a-c69e04285c94',
  '3b3b316e-92f6-4ca6-9075-35c19ce66326',
  '9258eb1c-b4f3-437b-92ba-1a82ef6e5a6f',
  '73869547-c8b5-45ba-b041-dbd08e6c878a',
  '33e6ed0d-e0a9-4091-a0d4-0cc66eae1f47',
  '94167ea0-192e-4697-ad89-d7ffdcaa34c8',
  'cb2f12e0-c45f-4180-ac8d-5875e65e0adf',
  '4b3cfcbb-f291-4444-a96c-12f69fb2f208',
  '5b0ce814-76e3-42af-b4cf-86ddf0c97608',
  '6d1da14a-653d-4e44-b276-745d1aa78a2b',
  '36a68472-f816-4d0d-a007-bc6fdf084773'
);
```

## Resultado Esperado

- **cost_rate**: 25 € para todos
- **cost_to_agency**: Calculado correctamente (25 × horas)

