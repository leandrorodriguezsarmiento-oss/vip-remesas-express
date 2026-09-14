# VIP Remesas — verificación de reparación

## Cambios
- Eliminadas las dependencias `@lovable.dev/*`.
- Eliminados los módulos/rutas MCP y OAuth propios de Lovable.
- Eliminado el almacenamiento de sesión específico de Lovable; Supabase usa `localStorage` estándar.
- Eliminadas referencias a dominios Lovable/GPT Engineer del código, configuración, documentación y migraciones.
- Google OAuth corregido con flujo PKCE y ruta `/auth/callback`.
- `exchangeCodeForSession(code)` implementado en el callback.
- El build de producción continúa usando `portable-export/` para Cloudflare Workers.
- Supabase fijado al proyecto de producción configurado.
- La clave administrativa sigue siendo exclusivamente de servidor.

## Pruebas ejecutadas
- JSON de `package.json`: OK.
- JSON de `portable-export/package.json`: OK.
- 269 archivos TypeScript/TSX: análisis sintáctico OK.
- Referencias Lovable en código/configuración/documentación/migraciones: 0.
- Archivos Lovable eliminados: OK.
- Ruta `/auth/callback` presente en el árbol de rutas: OK.
- Google OAuth → `/auth/callback`: OK.
- PKCE + `exchangeCodeForSession`: OK.
- `sb_secret_` en cliente del navegador: 0.
- Workflow Cloudflare usa `portable-export`: OK.
- Secret `SUPABASE_SERVICE_ROLE_KEY`: configurado para runtime/deploy.

## Nota
En este entorno no fue posible ejecutar una compilación completa porque la instalación de dependencias de npm agotó el tiempo disponible. Por eso no se afirma que un `vite build` local haya pasado aquí. El repositorio sí queda preparado para que GitHub Actions ejecute `bun install` + `bun run build` y detenga el despliegue si alguna verificación de producción falla.
