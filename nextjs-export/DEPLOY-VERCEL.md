# Desplegar en Vercel + Supabase (checklist)

## 1. Supabase (tu propio proyecto)
1. supabase.com → New Project.
2. SQL Editor → pega y ejecuta `supabase/migrations/0001_init.sql`.
3. Settings → API: copia `Project URL`, `anon public`, `service_role`.
4. Authentication → Providers → Google: enable + Client ID/Secret.
   - Redirect URI en Google Cloud: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
5. Authentication → URL Configuration:
   - Site URL: `https://tudominio.com`
   - Redirect URLs: `http://localhost:3000/**`, `https://tudominio.com/**`
6. Authentication → Policies: deja `Leaked password protection` activado.

## 2. Subir el código
Sube **solo el contenido de `nextjs-export/`** a un repo de GitHub (que quede en la raíz).

## 3. Vercel
1. vercel.com/new → importa el repo. Framework: Next.js (auto).
2. Environment Variables (Production + Preview + Development):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (secreto, sin NEXT_PUBLIC_) |
| `ADMIN_EMAIL` | leandrorodriguezsarmiento@gmail.com |
| `NEXT_PUBLIC_SITE_URL` | https://tudominio.com |
| `EMAILJS_SERVICE_ID` | service_3vnoxpm |
| `EMAILJS_TEMPLATE_ID` | tu template |
| `EMAILJS_PUBLIC_KEY` | tu public key |
| `EMAILJS_PRIVATE_KEY` | tu private key (secreto) |
| `MERCADOPAGO_ACCESS_TOKEN` | cuando actives Mercado Pago |
| `RECARGAS_API_URL` / `RECARGAS_API_KEY` | cuando conectes el proveedor de recargas |

3. Deploy. `vercel.json` ya fija la región `gru1` (São Paulo) y los headers de la PWA.

## 4. Dominio
Vercel → Settings → Domains → Add. Luego actualiza `NEXT_PUBLIC_SITE_URL` y las Redirect URLs de Supabase.

## 5. Webhooks (después del primer deploy)
- Mercado Pago → notificación a `https://tudominio.com/api/public/mercadopago-webhook`
- Proveedor de recargas → `https://tudominio.com/api/public/recargas-webhook` (firma HMAC)

## 6. Play Store (TWA)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://tudominio.com/manifest.webmanifest
bubblewrap build
```
Sube el `.aab` a Play Console y copia `assetlinks.json` a `public/.well-known/`.
Las actualizaciones web salen con `git push` — no hay que resubir el APK.
