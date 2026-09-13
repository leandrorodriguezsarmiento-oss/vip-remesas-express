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

## 4. Variables y secretos
Las `VITE_*` son públicas y se inyectan al compilar (build o secrets del repo).
Los secretos del servidor van en el Worker, nunca en el navegador:
```bash
bunx wrangler secret put PUBLIC_SITE_URL
bunx wrangler secret put MERCADOPAGO_ACCESS_TOKEN
bunx wrangler secret put MERCADOPAGO_WEBHOOK_SECRET
bunx wrangler secret put EMAILJS_SERVICE_ID
bunx wrangler secret put EMAILJS_TEMPLATE_ID
bunx wrangler secret put EMAILJS_PUBLIC_KEY
bunx wrangler secret put EMAILJS_PRIVATE_KEY
bunx wrangler secret put VAPID_PUBLIC_KEY
bunx wrangler secret put VAPID_PRIVATE_KEY
bunx wrangler secret put PUSH_DISPATCH_SECRET
bunx wrangler secret put SUPABASE_URL
bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## 5. Conectar vipremesas.com (cuando lo decidas)
1. Añade el dominio a Cloudflare y apunta los nameservers en tu registrador.
2. Workers & Pages > vip-remesas-express > Settings > Domains & Routes >
   *Add custom domain* → `vipremesas.com` y `www.vipremesas.com`.
3. Actualiza `PUBLIC_SITE_URL=https://vipremesas.com` (secret del Worker).
4. Supabase Auth: Site URL `https://vipremesas.com`, Redirect URLs `https://vipremesas.com/**`.
5. Mercado Pago: webhook `https://vipremesas.com/api/public/mercadopago/webhook`.
6. Triggers de push en la base de datos: `https://vipremesas.com/api/public/push/dispatch`.

## 6. Límites del runtime del Worker
`nodejs_compat` cubre `crypto`, `createHmac`, `timingSafeEqual` y `Buffer`.
No añadas paquetes que necesiten binarios nativos, procesos hijos o disco real.
