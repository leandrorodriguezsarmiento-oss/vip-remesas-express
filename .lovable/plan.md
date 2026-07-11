# Migración a Next.js 15 + Vercel + Supabase nuevo

Genero un proyecto Next.js completo dentro de `nextjs-export/` (carpeta hermana al código actual). El preview de Lovable sigue vivo hasta que confirmes que la versión Next.js funciona en Vercel.

## Qué voy a crear

### 1. Estructura Next.js 15 (App Router)
```text
nextjs-export/
├── package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.mjs
├── .env.example              (SUPABASE_URL, ANON_KEY, SERVICE_ROLE, LOVABLE_API_KEY opcional)
├── middleware.ts             (refresco de sesión Supabase con @supabase/ssr)
├── public/                   (manifest, icons, apple-touch-icon — copiados)
├── app/
│   ├── layout.tsx            (HTML shell, metadata SEO, PWA links)
│   ├── globals.css
│   ├── page.tsx              (landing "/")
│   ├── auth/page.tsx
│   ├── reset-password/page.tsx
│   ├── (auth)/layout.tsx     (guard con redirect si no hay sesión)
│   ├── (auth)/dashboard/page.tsx
│   ├── (auth)/send/page.tsx
│   ├── (auth)/history/page.tsx
│   ├── (auth)/recargas/page.tsx
│   ├── (auth)/transaction/[id]/page.tsx
│   ├── (auth)/admin/page.tsx
│   └── api/
│       ├── admin/delete-user/route.ts   (POST — service role, verifica has_role)
│       └── health/route.ts
├── lib/
│   ├── supabase/client.ts       (browser)
│   ├── supabase/server.ts       (RSC/Actions, cookies)
│   ├── supabase/admin.ts        (service role, solo API routes)
│   └── remittance.ts, pix.ts    (portados 1:1)
└── components/                  (todos los shadcn UI existentes)
```

Reemplazos clave frente al código actual:
- `@tanstack/react-router` → Next.js App Router (`Link`, `useRouter`, `redirect`)
- `createServerFn` → Server Actions y Route Handlers
- `@lovable.dev/cloud-auth-js` → `supabase.auth.signInWithOAuth({ provider: 'google' })` directo
- `@/integrations/supabase/auth-middleware` → `middleware.ts` global con `@supabase/ssr`
- Cero paquetes `@lovable.dev/*`, cero `attachSupabaseAuth`

### 2. Migración SQL consolidada para tu Supabase nuevo
`nextjs-export/supabase/migrations/0001_init.sql` con todo:
- Enum `app_role`, tablas: profiles, user_roles, recipients, rates, promos, banners, transactions, notifications, recargas_config, recargas_requests, payment_methods, verification_codes
- GRANTs para authenticated/service_role
- RLS + políticas
- Funciones `has_role`, `handle_new_user`, `grant_owner_admin_role`, `enforce_single_admin`, `notify_tx_completed`, `touch_updated_at`
- Triggers en `auth.users` y en `transactions`
- Seed de rates iniciales y una promo demo

### 3. README con guía paso a paso (`nextjs-export/README.md`)
1. Crear proyecto Supabase nuevo en supabase.com → copiar URL, anon key, service_role a `.env.local`
2. Correr la migración: `supabase db push` o pegar el SQL en el SQL Editor
3. Configurar Google OAuth en Supabase (Client ID/Secret, redirect URL)
4. `npm install && npm run dev` local para probar
5. Crear repo Git, push, importar en Vercel
6. Variables de entorno en Vercel (mismas que `.env.local`)
7. Conectar tu dominio en Vercel
8. Generar APK para Play Store con Bubblewrap desde el dominio final
9. Actualizaciones: `git push` → Vercel redeploya → PWA se actualiza sola. Para Play Store subes nuevo AAB solo si cambia versión nativa.

### 4. Detalles técnicos
- Next.js 15.x, React 19, Node runtime en Vercel (no edge, para compatibilidad con `@supabase/ssr` sin sorpresas)
- Auth: cookies httpOnly via `@supabase/ssr`. `middleware.ts` refresca token, layouts server-side leen sesión con `createServerClient()`
- Admin: rutas `/admin` protegidas doble (middleware + verificación `has_role` en Server Component). API `/api/admin/delete-user` valida sesión + rol antes de usar service role.
- PIX: `lib/pix.ts` con CRC16 idéntico al actual, misma llave `+5595981006775`
- PWA: `manifest.webmanifest`, iconos, meta tags — copiado de `public/` actual
- SEO: `metadata` export por página con title/description específicos

## Lo que NO hago (fuera de scope)
- No borro el proyecto TanStack actual (sigue en Lovable como respaldo)
- No conecto Vercel/Supabase por ti (necesitas hacerlo tú con tus credenciales)
- No genero el APK ni subo a Play Store (proceso local con Android Studio/Bubblewrap)
- No migro datos de la DB actual — empiezas limpio como pediste

## Después de aprobar el plan
Escribo todo en un solo lote de creación de archivos, ~30–40 archivos. Tú luego descargas la carpeta `nextjs-export/`, corres los pasos del README, y me avisas si algo falla.
