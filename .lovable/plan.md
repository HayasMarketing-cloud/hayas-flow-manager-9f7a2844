# Plan FLOW - Estado de Implementación

## ✅ COMPLETADO

### Fase 1: Contexto en Presupuestos
- [x] Campo `proposal_context` JSONB añadido a `budgets`
- [x] Componente `BudgetContextTab` creado
- [x] Pestaña "Contexto" añadida en `PresupuestoDetalle`

### Fase 2: Plantillas en Servicios
- [x] Campo `template_structure` JSONB añadido a `services`
- [x] Componente `ServiceTemplateEditor` creado
- [x] Pestaña "Plantilla Operativa" añadida en `ServiceFormModal`

### Fase 3: Lógica Híbrida de Clonación
- [x] Hook `useCreateProjectWithActivities` actualizado con lógica híbrida:
  - Si servicio tiene plantilla → clona milestones y tareas desde template
  - Si no tiene plantilla → crea 1 milestone simple desde el request

---

## Arquitectura Final

```
Contrato/Presupuesto (origen)
       ↓
  Budget Items (líneas económicas)
       ↓
  financial_requests (unidad liquidable) 
       ↓
  ¿Servicio tiene template_structure?
       ├─ SÍ → Clonar N milestones + tareas desde plantilla
       └─ NO → Crear 1 milestone simple
       ↓
  operational_requests (milestones) → tasks
       ↓
  liquidations → paid (cierre)
```

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `budgets` (DB) | + `proposal_context` JSONB |
| `services` (DB) | + `template_structure` JSONB |
| `BudgetContextTab.tsx` | Nuevo componente |
| `ServiceTemplateEditor.tsx` | Nuevo componente |
| `PresupuestoDetalle.tsx` | + Pestaña "Contexto" |
| `ServiceFormModal.tsx` | + Pestaña "Plantilla Operativa" |
| `useCreateProjectWithActivities.tsx` | Lógica híbrida |

---

## Próximos Pasos (Opcionales)

1. Crear plantillas para servicios existentes (SEO, Desarrollo Web, Campañas)
2. Añadir indicador visual en lista de servicios para los que tienen plantilla
3. Permitir editar plantillas desde el detalle del proyecto (no solo al crear)

