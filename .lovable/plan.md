
# Plan: Aplicar identidad corporativa Flow Manager

## Resumen

Implementar la paleta cromatica "Tranquil Gradient" de Flow Manager, incluyendo:
1. Corregir visibilidad del logo en el sidebar (aplicando fondo oscuro Deep Blue)
2. Actualizar todas las variables CSS del sistema de diseno
3. Aplicar gradiente corporativo en la pagina de login

## Paleta de colores (HEX a HSL)

| Nombre | HEX | HSL | Uso |
|--------|-----|-----|-----|
| Hayas Green | #2FA36B | 149 55% 41% | Primario, botones, CTAs |
| Deep Teal | #0F6F78 | 185 77% 26% | Secundario, headers, hover |
| Deep Blue | #0B3C5D | 203 80% 20% | Fondos oscuros, sidebar |
| Tofu Digital | #F4F7F6 | 150 18% 96% | Backgrounds, cards |
| Stone Grey | #6B7280 | 220 9% 46% | Texto secundario |
| Charcoal | #1F2933 | 209 26% 16% | Texto principal |

## Cambios a implementar

### 1. Actualizar variables CSS (src/index.css)

**Modo claro:**
```css
:root {
  --background: 150 18% 96%;        /* Tofu Digital */
  --foreground: 209 26% 16%;        /* Charcoal */
  --primary: 149 55% 41%;           /* Hayas Green */
  --secondary: 185 77% 26%;         /* Deep Teal */
  --muted-foreground: 220 9% 46%;   /* Stone Grey */
  --sidebar-background: 203 80% 20%; /* Deep Blue */
  --sidebar-foreground: 150 18% 96%; /* Texto claro en sidebar */
}
```

**Modo oscuro:**
- Mantener coherencia con la paleta
- Sidebar ya sera oscuro por defecto

### 2. Actualizar sidebar (src/components/layout/AppSidebar.tsx)

- El logo ahora sera visible gracias al fondo Deep Blue
- Ajustar estilos de texto e iconos para contraste sobre fondo oscuro

### 3. Actualizar pagina de login (src/pages/Auth.tsx)

Aplicar el gradiente corporativo de fondo:
```css
linear-gradient(135deg, #2FA36B 0%, #0F6F78 50%, #0B3C5D 100%)
```
En HSL para Tailwind:
```
bg-gradient-to-br from-[hsl(149,55%,41%)] via-[hsl(185,77%,26%)] to-[hsl(203,80%,20%)]
```

### 4. Actualizar colores de botones y componentes

- Botones primarios: Hayas Green (#2FA36B)
- Estados hover: Deep Teal (#0F6F78)
- Elementos activos en sidebar: resaltar con verde

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/index.css` | Actualizar todas las variables CSS con nueva paleta |
| `src/pages/Auth.tsx` | Aplicar gradiente corporativo de fondo |
| `src/components/layout/AppSidebar.tsx` | Ajustar estilos para fondo oscuro |

## Vista previa del resultado esperado

**Sidebar:**
- Fondo azul profundo (Deep Blue)
- Logo visible con buen contraste
- Texto e iconos en color claro
- Item activo resaltado con Hayas Green

**Login:**
- Gradiente de fondo: verde a azul profundo
- Card blanca centrada con logo grande
- Boton primario verde Hayas

**Aplicacion general:**
- Fondo Tofu Digital (blanco roto)
- Texto principal Charcoal
- Acentos y CTAs en Hayas Green

## Detalles tecnicos

### Variables CSS actualizadas

```css
:root {
  --background: 150 18% 96%;
  --foreground: 209 26% 16%;
  --card: 0 0% 100%;
  --card-foreground: 209 26% 16%;
  --primary: 149 55% 41%;
  --primary-foreground: 0 0% 100%;
  --secondary: 185 77% 26%;
  --secondary-foreground: 0 0% 100%;
  --muted: 150 10% 92%;
  --muted-foreground: 220 9% 46%;
  --accent: 185 77% 26%;
  --accent-foreground: 0 0% 100%;
  --border: 150 10% 88%;
  --input: 150 10% 88%;
  --ring: 149 55% 41%;
  --sidebar-background: 203 80% 20%;
  --sidebar-foreground: 150 18% 96%;
  --sidebar-primary: 149 55% 41%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 185 77% 30%;
  --sidebar-accent-foreground: 0 0% 100%;
  --sidebar-border: 203 60% 25%;
  --sidebar-ring: 149 55% 41%;
}
```

### Gradiente corporativo para login

```typescript
// En Auth.tsx
<div className="min-h-screen bg-gradient-to-br from-[hsl(149,55%,41%)] via-[hsl(185,77%,26%)] to-[hsl(203,80%,20%)] flex items-center justify-center p-4">
```
