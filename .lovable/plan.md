
Objetivo: arreglar el acceso para que puedas entrar bien con Google y entonces ver la nueva página de detalle de especialista en producción.

Diagnóstico
- La página de detalle sí existe en código: hay ruta `/especialistas/:id`, navegación desde el listado y página `EspecialistaDetalle`.
- El motivo más probable de “no la veo” no es la página en sí, sino que el login te está dejando fuera o te devuelve a un flujo incorrecto.
- En preview, Google dentro del iframe no es fiable y puede fallar con `ERR_BLOCKED_BY_RESPONSE`. Ahora mismo la UI intenta abrir “la misma preview” en otra pestaña, pero eso sigue siendo una mala base para OAuth.
- En los logs, el login empieza desde `flow.hayasmarketing.com` pero el callback aparece referenciado desde la URL publicada `.lovable.app`, lo que indica un rebote de dominios que puede romper la sensación de continuidad y provocar rutas extrañas.
- Además, tras login no se conserva la ruta destino, así que aunque entres bien, no siempre vuelves a donde querías ir.

Plan de arreglo
1. Corregir el flujo de Google según entorno
- En preview/iframe: no intentar login Google “ahí”.
- Mostrar un CTA claro para abrir el login en una pestaña normal del sitio publicado/custom domain (`/auth`), no en la preview.
- En dominio real: mantener un único flujo de Google estable, evitando rebotes innecesarios entre hosts.

2. Conservar la ruta destino tras autenticar
- Modificar `ProtectedRoute` para mandar a `/auth?next=...` cuando el usuario intenta abrir una página protegida.
- Hacer que `Auth.tsx` lea `next` y, tras login correcto, redirija a esa ruta en vez de mandar siempre al dashboard.
- Así, si entras desde especialistas, volverás al detalle del especialista y no “perderás” la nueva página.

3. Endurecer la pantalla de auth
- Separar claramente:
  - Login Google en entorno real
  - Mensaje/acción especial para preview
- Evitar que el botón de Google en preview acabe cargando Google embebido o una URL técnica confusa.

4. Verificar la navegación al detalle de especialista
- Revisar el flujo completo: listado `Especialistas` → click tarjeta → `/especialistas/:id`.
- Si hace falta, añadir un affordance más visible (“Ver detalle”) además del click en toda la card para que quede claro que existe esa nueva página.

Archivos a tocar
- `src/pages/Auth.tsx`
  - Detectar preview/iframe mejor
  - Abrir el login en dominio real
  - Leer y aplicar `next`
- `src/contexts/AuthContext.tsx`
  - Ajustar redirección post-login para no forzar siempre dashboard
  - Afinar el inicio de Google para que el dominio real sea el protagonista del flujo
- `src/components/ProtectedRoute.tsx`
  - Añadir redirección con `next`
- `src/pages/Index.tsx`
  - Revisar la redirección automática para que no pise el retorno tras login
- `src/pages/Especialistas.tsx`
  - Solo si hace falta, reforzar visualmente el acceso al detalle

Resultado esperado
- En preview, verás un mensaje claro para abrir el login correctamente fuera del iframe.
- En producción/custom domain, Google iniciará sesión sin llevarte por un flujo extraño que te desoriente.
- Tras autenticarte, podrás volver directamente a la página protegida que querías abrir.
- La página de detalle de especialista quedará accesible y usable desde el listado.

Detalles técnicos
- No hacen falta cambios de base de datos.
- No tocaré los archivos auto-generados de integración.
- La corrección es de flujo de autenticación y routing, no de datos.
- Después habrá que probar específicamente:
  1) login Google en custom domain,
  2) acceso a `/especialistas`,
  3) apertura de `/especialistas/:id`,
  4) navegación a liquidación y descarga/visualización de factura.
