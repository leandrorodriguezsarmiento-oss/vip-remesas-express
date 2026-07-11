# VIP Remesas — Next.js 15 + Supabase + Vercel

Exportación autónoma de la app. **Cero dependencias `@lovable.dev/*`**. Corre en tu propio Supabase y se despliega en Vercel con `git push`.

---

## 1. Crear proyecto Supabase nuevo

1. Ve a https://supabase.com/dashboard → **New Project**.
2. Guarda estos valores (Settings → API):
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (¡NUNCA lo pegues en el frontend!)

## 2. Correr la migración

Abre **SQL Editor** en Supabase y pega el contenido completo de:

```
supabase/migrations/0001_init.sql
```

Ejecuta. Esto crea todas las tablas (profiles, transactions, rates, promos, banners, payment_methods, recargas_*, user_roles, notifications), los enums, funciones (`has_role`, `handle_new_user`, `grant_owner_admin_role`, `enforce_single_admin`), triggers, políticas RLS, y datos semilla (tasas iniciales + 3 promos Cubacel).

**Importante:** el trigger `grant_owner_admin_role` da rol `admin` automáticamente al usuario que se registre con `leandrorodriguezsarmiento@gmail.com`. Si quieres otro email, edita la función antes de correrla.

## 3. Configurar Google OAuth en Supabase

1. Supabase Dashboard → **Authentication → Providers → Google** → Enable.
2. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web).
3. Authorized redirect URI: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
4. Pega Client ID + Client Secret en Supabase.
5. En Supabase → Authentication → URL Configuration → **Site URL**: `https://tudominio.com`
   - **Redirect URLs adicionales**: `http://localhost:3000/**`, `https://tudominio.com/**`

## 4. Correr local

```bash
cd nextjs-export
npm install
cp .env.example .env.local   # y edita con tus valores
npm run dev
```

Abre http://localhost:3000. Regístrate con tu email admin para tener acceso al panel.

## 5. Desplegar en Vercel

1. Crea repo Git y sube el contenido de `nextjs-export/` a GitHub.
2. https://vercel.com/new → importa el repo.
3. Framework preset: **Next.js** (auto-detectado).
4. Environment Variables → pega las mismas 4 de `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://tudominio.com`
5. Deploy. Vercel te da una URL `xxx.vercel.app`.

## 6. Conectar tu dominio

Vercel → Project → Settings → Domains → Add. Sigue las instrucciones de DNS de tu registrar (A/CNAME).

Actualiza `NEXT_PUBLIC_SITE_URL` y las Redirect URLs de Supabase con tu dominio real.

## 7. Publicar como app en Google Play Store (PWA con TWA)

Tu app ya es PWA instalable (manifest + iconos incluidos en `public/`). Para llevarla a Play Store empaquétala como **Trusted Web Activity** con **Bubblewrap**:

```bash
# En tu máquina, una sola vez:
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://tudominio.com/manifest.webmanifest
# Responde las preguntas (nombre, paquete com.vipremesas.app, colores, etc.)
bubblewrap build
```

Genera un `app-release-bundle.aab`. Sube ese archivo a **Play Console** (cuenta $25 USD única).

Vincula tu dominio a la app usando **Digital Asset Links**: Bubblewrap ya te genera `assetlinks.json`; súbelo a `public/.well-known/assetlinks.json` en tu repo y redeploya.

## 8. Actualizaciones futuras

- **Cambio en la web / lógica**: `git commit && git push` → Vercel redeploya en ~1 min. Los usuarios ven la nueva versión al recargar la PWA (o inmediatamente si tienen el service worker actualizado — Next.js maneja esto automáticamente).
- **Cambio nativo en el APK** (nuevo ícono, splash, permisos): solo entonces necesitas `bubblewrap update && bubblewrap build` y subir nuevo `.aab` a Play Store. Para actualizar solo la lógica web, **NO** necesitas subir nada a Play Store — el TWA carga tu dominio en vivo.

## 9. Rutas del app

| Ruta | Descripción |
|---|---|
| `/` | Landing pública |
| `/auth` | Login / signup / Google OAuth |
| `/auth/callback` | Callback OAuth (intercambia code por sesión) |
| `/reset-password` | Nueva contraseña |
| `/dashboard` | Home autenticado, banners, tasas, últimas remesas |
| `/send` | Flujo de remesa BR/EU/US → Cuba, PIX con monto embebido |
| `/history` | Todas las remesas del usuario |
| `/recargas` | Solicitud de recarga Cubacel |
| `/transaction/[id]` | Detalle de una remesa |
| `/admin` | Panel admin (solo `leandrorodriguezsarmiento@gmail.com`) |
| `/api/admin/delete-user` | Endpoint privado (verifica rol) para borrar cuentas |

## 10. Extras opcionales

- **Banners**: crea bucket `banners` en Supabase Storage (privado) y agrega el tab de subida al admin — ya soportado por el schema.
- **Webhook real de PIX**: reemplaza `checkPixPayment` en `lib/remittance.ts` por llamada a tu proveedor.
- **Cubacel API real**: guarda la key con `add_secret` (Vercel: Settings → Env Vars → Encrypted), consúmela en un route handler `/api/recargas/execute`.

---

**Migración completada.** El proyecto Lovable original queda como respaldo hasta que confirmes que este funciona en tu dominio.
