

## Unificar vista de Proyectos Operativos: quitar Tabs, usar toggle de iconos

### Problema actual
La página usa `Tabs` con dos pestañas ("Tarjetas" y "Seguimiento") que separan las vistas. Otras páginas (Presupuestos, Facturas, Solicitudes, etc.) usan un toggle de iconos (`LayoutGrid` / `TableIcon`) dentro de la barra de filtros, sin pestañas.

### Solución

**Archivo: `src/pages/operations/OperationalProjects.tsx`**

1. **Reemplazar `Tabs` por `viewMode` state** — cambiar `activeTab` por `viewMode: 'cards' | 'tracking'`, eliminar el wrapper `<Tabs>`, `<TabsList>`, `<TabsContent>`

2. **Añadir toggle de iconos en la barra de filtros** — igual que en Presupuestos/Facturas: dos botones con `LayoutGrid` y `Table2` (o `TableIcon`) alineados a la derecha dentro del Card de filtros

3. **Mostrar filtros condicionales** — los filtros de especialista, presupuesto y contrato siguen apareciendo solo cuando `viewMode === 'tracking'`

4. **Renderizar contenido condicionalmente** — reemplazar `<TabsContent>` por `{viewMode === 'cards' ? (...cards...) : (...tracking...)}`

5. **Limpiar imports** — eliminar `Tabs, TabsContent, TabsList, TabsTrigger`

### Resultado
Una única vista con los filtros arriba y un toggle de iconos para cambiar entre cards y tabla de seguimiento, consistente con el resto de páginas.

