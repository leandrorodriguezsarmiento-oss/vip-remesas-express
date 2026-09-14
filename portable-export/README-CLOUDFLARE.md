# VIP Remesas Express — Cloudflare Workers

Aplicación full-stack (TanStack Start) servida por un Worker. Base de datos,
autenticación y RLS siguen en Supabase; los pagos siguen siendo manuales.

## 1. Instalar y compilar
```bash
bun install
bun run typecheck
bun run build
bun run deploy:dry-run     # comprueba el Worker sin publicar
```

## 2. Desarrollo con el runtime real del Worker
```bash
bun run dev        # Vite + entorno Cloudflare
bun run preview    # wrangler dev sobre el build de producción
```

## 3. Publicar
```bash
bunx wrangler login
bun run deploy
```
También se publica solo en cada push a `main` (`.github/workflows/deploy.yml`)
con los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

## 4. Variables públicas de compilación
La URL y la clave publicable quedan dentro del JavaScript del navegador. En
GitHub, créalas en **Settings > Secrets and variables > Actions > Variables**:

- `NEXT_PUBLIC_SUPABASE_URL` (obligatoria)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (obligatoria; clave publicable)
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_PIX_KEY`

El workflow se detiene antes de publicar si faltan las dos primeras. Para un
despliegue manual, expórtalas antes de ejecutar `bun run build`.

## 5. Variables y Secrets del Worker
En **Workers & Pages > vip-remesas-express > Settings > Variables and Secrets**,
configura como **Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `PUBLIC_SITE_URL=https://vipremesas.com`
- `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_ORIGIN`
- `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
- `RECARGAS_API_URL`, `AI_API_URL`, `AI_MODEL` cuando se usen

Configura como **Secrets**:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
- `EMAILJS_PRIVATE_KEY`
- `VAPID_PRIVATE_KEY`, `PUSH_DISPATCH_SECRET`
- `RECARGAS_API_KEY`, `RECARGA_WEBHOOK_SECRET`
- `AI_API_KEY` cuando se use

Los secretos también se pueden cargar desde la terminal:
```bash
bunx wrangler secret put MERCADOPAGO_ACCESS_TOKEN
bunx wrangler secret put MERCADOPAGO_WEBHOOK_SECRET
bunx wrangler secret put EMAILJS_PRIVATE_KEY
bunx wrangler secret put VAPID_PRIVATE_KEY
bunx wrangler secret put PUSH_DISPATCH_SECRET
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

El despliegue usa `--keep-vars` para conservar la configuración del Worker.
El workflow exige `SUPABASE_SERVICE_ROLE_KEY` en **GitHub Actions > Secrets**
y lo carga como Secret del Worker en cada despliegue; nunca entra al build del navegador.
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` deben
existir como Variables del Worker y durante el build. Son valores públicos;
la clave administrativa sólo existe como `SUPABASE_SERVICE_ROLE_KEY` Secret.

## 6. Configurar autenticación para vipremesas.com
1. Añade el dominio a Cloudflare y apunta los nameservers en tu registrador.
2. Workers & Pages > vip-remesas-express > Settings > Domains & Routes >
   *Add custom domain* → `vipremesas.com` y `www.vipremesas.com`.
3. Configura `PUBLIC_SITE_URL=https://vipremesas.com` como Variable del Worker.
4. Supabase Auth: Site URL `https://vipremesas.com`, Redirect URLs `https://vipremesas.com/**`.
5. Mercado Pago: webhook `https://vipremesas.com/api/public/mercadopago/webhook`.
6. Triggers de push en la base de datos: `https://vipremesas.com/api/public/push/dispatch`.

## 7. Límites del runtime del Worker
`nodejs_compat` cubre `crypto`, `createHmac`, `timingSafeEqual` y `Buffer`.
No añadas paquetes que necesiten binarios nativos, procesos hijos o disco real.
