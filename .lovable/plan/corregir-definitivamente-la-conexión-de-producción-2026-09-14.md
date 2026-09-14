# Corregir definitivamente la conexión de producción

## Objetivo
Hacer que toda la versión portable use exclusivamente el proyecto nuevo al crear cuentas, iniciar sesión, recuperar contraseñas y entrar con Google, sin exponer la clave administrativa.

## Cambios
- Auditar y corregir todas las inicializaciones activas del cliente y servidor en la raíz, `portable-export` y `nextjs-export`.
- Unificar el navegador con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, validando una URL HTTPS completa antes de crear el cliente.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en operaciones del servidor y comprobar que no llegue al código del navegador.
- Eliminar referencias funcionales al proyecto anterior y evitar que la generación de `portable-export` las vuelva a introducir.
- Endurecer los workflows para detener cualquier compilación vacía, mal formada o dirigida al proyecto anterior.

## Verificación
- Regenerar `portable-export` y ejecutar typecheck y build con el proyecto nuevo.
- Inspeccionar el resultado final para confirmar: proyecto nuevo presente, proyecto anterior ausente y clave administrativa ausente del navegador.
- Probar crear cuenta, acceso con contraseña, Google OAuth, recuperación y cierre de sesión en el build local.

## Sin cambios
No se modifican diseño, lógica comercial, dominio ni credenciales/configuración de Google OAuth.
