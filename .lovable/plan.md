

## Plan: Usar logo original (no blanco) en el PDF del quote

El logo blanco no se ve sobre fondo blanco del PDF. Hay que usar `hayas-logo.png` (el logo oscuro original) en el generador de PDF, manteniendo el logo blanco solo para la vista web (que tiene fondo azul).

### Cambio

**`src/utils/pdf/budgetPDFGenerator.ts`** (línea 62): Cambiar la ruta del logo de `hayas-logo-white.png` → `hayas-logo.png`.

```typescript
// Antes
logoImg.src = '/images/hayas-logo-white.png';

// Después  
logoImg.src = '/images/hayas-logo.png';
```

La vista web (`PublicQuote.tsx`) seguirá usando el logo blanco sobre fondo azul sin cambios.

