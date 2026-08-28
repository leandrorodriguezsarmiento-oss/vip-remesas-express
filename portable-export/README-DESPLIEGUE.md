# VIP Remesas — despliegue independiente

Este código no depende de Lovable: ni paquetes, ni proxys, ni dominios.

## 1. Base de datos
Crea un proyecto de Postgres/Supabase propio (o autohospedado) y ejecuta en orden
los archivos de `supabase/migrations/`.

## 2. Variables
Copia `.env.example` a `.env` y rellena los valores. Nunca pongas claves
`SERVICE_ROLE` ni `PRIVATE` en variables con prefijo `VITE_`.

## 3. Arrancar
```bash
bun install     # o npm install
bun run dev     # desarrollo en http://localhost:3000
bun run build   # producción -> .output/
bun run start   # sirve .output/server/index.mjs
```

## 4. VPS
- Nginx como proxy inverso al puerto 3000, HTTP/2 y `client_max_body_size 10m`.
- HTTPS obligatorio (certbot): sin TLS no funcionan el service worker ni el push.
- Mantén el proceso con pm2 o systemd.

## 5. Después del primer despliegue
- Auth: `Site URL = https://tudominio.com`, Redirect URLs `https://tudominio.com/**`.
- Google: en Google Cloud añade `https://TU-PROYECTO.supabase.co/auth/v1/callback`.
- Webhooks: Mercado Pago → `/api/public/mercadopago/webhook`; recargas → `/api/public/recargas/webhook`.
- Actualiza las URLs de los triggers de push en la base a `https://tudominio.com/api/public/push/dispatch`.

## 6. Play Store (TWA)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://tudominio.com/manifest.webmanifest
bubblewrap build
```
Copia `assetlinks.json` a `public/.well-known/`.
