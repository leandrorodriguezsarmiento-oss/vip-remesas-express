# Migración a dominio propio y VPS externo

## 1. Base de datos y auth
- El backend es Postgres + Auth (Supabase). Opciones:
  - **Recomendado**: crear un proyecto Supabase propio y ejecutar las migraciones de `supabase/migrations/`.
  - **Autohospedado**: `supabase/docker` en el VPS (necesitas 4 GB RAM mínimo).
- Copia los datos con `pg_dump` / `pg_restore` si ya hay clientes reales.

## 2. Variables de entorno del servidor
| Variable | Uso |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | lecturas públicas y sesión |
| `SUPABASE_SERVICE_ROLE_KEY` | operaciones privilegiadas (solo servidor) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | cliente |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | pagos |
| `RECARGAS_API_URL`, `RECARGAS_API_KEY`, `RECARGAS_WEBHOOK_SECRET` | proveedor de recargas |
| `EMAILJS_*` | correos |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_DISPATCH_SECRET` | notificaciones push |

Nunca expongas claves `SERVICE_ROLE` ni `PRIVATE` en variables `VITE_`.

## 3. Despliegue en el VPS
```bash
bun install
bun run build
# servir con el runtime de Node/Bun detrás de Nginx + certbot (HTTPS obligatorio)
```
- Nginx: proxy_pass al puerto de la app, `client_max_body_size 10m`, HTTP/2.
- HTTPS obligatorio: las notificaciones push y el service worker no funcionan sin TLS.

## 4. Dominio
1. DNS `A` → IP del VPS (y `CNAME www`).
2. En Auth: `Site URL = https://tudominio.com`, Redirect URLs `https://tudominio.com/**`.
3. Actualiza las URLs de los triggers de push en la base (`.../api/public/push/dispatch`).
4. Webhooks: Mercado Pago → `https://tudominio.com/api/public/mercadopago/webhook`; recargas → `/api/public/recargas/webhook`.

## 5. Blindaje del panel admin
Ya implementado en el código:
- Solo tu correo puede tener rol `admin` (trigger `enforce_single_admin` en la base; no se puede escalar desde la app).
- `MfaGate` pide un segundo factor en **cada apertura** de la app para staff (TOTP si está activo, si no código al correo). La llave vive en `sessionStorage`, así que muere al cerrar la app.
- Todas las acciones sensibles pasan por funciones de servidor con verificación de sesión y de rol; RLS activo en todas las tablas.

Recomendado además en el VPS:
- Activa TOTP en tu cuenta (Ajustes → seguridad) para no depender del correo.
- SSH solo con llave, `PermitRootLogin no`, fail2ban y firewall (solo 80/443/22).
- Copias de seguridad diarias de Postgres fuera del VPS.
- Repositorio privado y protección de rama `main` para que nadie cambie el código.

## 6. Play Store (TWA)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://tudominio.com/manifest.webmanifest
bubblewrap build
```
Copia `assetlinks.json` a `public/.well-known/`. Las actualizaciones web salen sin resubir el APK.
