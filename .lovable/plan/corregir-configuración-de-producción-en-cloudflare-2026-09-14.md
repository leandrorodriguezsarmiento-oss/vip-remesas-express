# Corregir configuración de producción en Cloudflare

## Objetivo
Eliminar el error de configuración en `/auth` y asegurar que el paquete portable reciba las variables públicas al compilar y las variables del servidor al ejecutar en Cloudflare.

## Cambios
- Separar claramente la configuración pública del navegador (`VITE_SUPABASE_*`) de la configuración del Worker (`SUPABASE_*`).
- Corregir el flujo de GitHub Actions para validar las variables públicas antes de compilar y desplegar el artefacto generado de Cloudflare.
- Conservar las variables configuradas directamente en Cloudflare durante nuevos despliegues.
- Actualizar el generador de `portable-export` para que todos estos cambios sean reproducibles.
- Documentar exactamente qué valores van como Variables y cuáles como Secrets, incluyendo despliegue manual y por GitHub.
- Mantener Google con `supabase.auth.signInWithOAuth`, login por usuario/correo, registro de cuatro campos y recuperación de contraseña.

## Verificación
- Regenerar `portable-export`.
- Ejecutar typecheck y build con configuración pública de prueba válida.
- Inspeccionar el código final para confirmar que no contiene `lovable.auth` ni `/~oauth/initiate`.
- Revisar que el paquete final de Cloudflare conserve el acceso servidor a `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.
