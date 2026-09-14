/**
 * Genera una copia 100% independiente del proyecto (sin ninguna dependencia de
 * Lovable) en la carpeta `portable-export/`, lista para subir a tu repositorio
 * de GitHub y desplegar en un VPS, Vercel, Fly.io, Render, etc.
 *
 * Uso:  bun run export:portable
 */
import { cpSync, existsSync, readdirSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "portable-export");

const SKIP = new Set([
  "node_modules",
  ".git",
  ".lovable",
  ".workspace",
  ".agents",
  ".claude",
  "dist",
  ".output",
  ".nitro",
  ".vite",
  "bun.lockb",
  "portable-export",
  "nextjs-export",
  "scripts",
  ".env",
]);

function write(rel: string, content: string) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function drop(rel: string) {
  rmSync(join(OUT, rel), { recursive: true, force: true });
}

function patch(rel: string, edits: Array<[from: string | RegExp, to: string]>) {
  const path = join(OUT, rel);
  if (!existsSync(path)) return;
  let src = readFileSync(path, "utf8");
  for (const [from, to] of edits) src = src.replace(from as never, to);
  writeFileSync(path, src);
}

// 1. Copia limpia del código
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const entry of readdirSync(ROOT)) {
  if (SKIP.has(entry)) continue;
  cpSync(join(ROOT, entry), join(OUT, entry), { recursive: true });
}

// 2. Fuera todo lo específico de la plataforma Lovable
for (const rel of [
  "src/routes/mcp.ts",
  "src/routes/[.mcp]",
  "src/routes/[.well-known]",
  "src/routes/[.]lovable.oauth.consent.tsx",
  "src/lib/mcp",
  "src/lib/oauth-consent.ts",
  "src/integrations/lovable",
  "src/lib/lovable-error-reporting.ts",
  // NOTA: src/routeTree.gen.ts SÍ se incluye: el CI hace typecheck antes del
  // build y sin este archivo generado el typecheck fallaría en un clon limpio.
  "AGENTS.md",
  "bunfig.toml",
  "tsconfig.tsbuildinfo",
  "package-lock.json",
  "MIGRACION-VPS.md",
]) drop(rel);

// Mensajes de error genéricos (sin marca de plataforma)
for (const rel of [
  "src/integrations/supabase/client.ts",
  "src/integrations/supabase/client.server.ts",
  "src/integrations/supabase/auth-middleware.ts",
]) patch(rel, [[/Connect Supabase in Lovable Cloud\./g, "Revisa tu archivo .env."]]);
patch("src/routes/auth.index.tsx", [[/\(enlace seguro de Lovable Cloud\)/, "(enlace seguro por correo)"]]);

// routeTree.gen.ts viene del editor y aún referencia la ruta de consentimiento
// OAuth de la plataforma (ya eliminada). Limpiarla para que typecheck/build
// funcionen en un clon limpio; el plugin la regenera en cada build.
{
  const rtPath = join(OUT, "src/routeTree.gen.ts");
  let rt = readFileSync(rtPath, "utf8");
  rt = rt.replace(/^import .*Dotlovable.*\n/m, "");
  rt = rt.replace(/const DotlovableOauthConsentRoute[\s\S]*?\} as any\)\n/, "");
  rt = rt.replace(/^ *'\/\.lovable\/oauth\/consent': \{[\s\S]*?\n *\}\n/gm, "");
  rt = rt.replace(/^.*(?:Dotlovable|\.lovable\/oauth\/consent).*$\n/gm, "");
  writeFileSync(rtPath, rt);
}

// 3. package.json sin paquetes @lovable.dev
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
pkg.name = "vip-remesas";
for (const field of ["dependencies", "devDependencies"] as const) {
  for (const dep of Object.keys(pkg[field] ?? {})) {
    if (dep.startsWith("@lovable.dev/")) delete pkg[field][dep];
  }
}
pkg.scripts = {
  dev: "vite dev",
  build: "vite build",
  preview: "vite preview",
  typecheck: "tsc --noEmit",
  lint: "eslint .",
  deploy: "wrangler deploy -c dist/server/wrangler.json",
  "deploy:dry-run": "wrangler deploy --dry-run -c dist/server/wrangler.json",
  "cf-typegen": "wrangler types",
};
pkg.devDependencies["@cloudflare/vite-plugin"] = "^1.14.2";
pkg.devDependencies["wrangler"] = "^4.45.0";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

// 4. Configuración de Vite para Cloudflare Workers (sin paquetes de terceros)
write(
  "vite.config.ts",
  `import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build") {
    const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
    const missing = required.filter((name) => !env[name]?.trim());
    if (missing.length > 0) {
      throw new Error(
        \`Faltan variables públicas de compilación: \${missing.join(", ")}. \` +
          "Configúralas como Variables del repositorio en GitHub o expórtalas antes de bun run build.",
      );
    }
  }

  return {
    server: { port: 3000, host: true },
    plugins: [
      tsConfigPaths(),
      tailwindcss(),
      // Entorno SSR de Cloudflare Workers (lee wrangler.jsonc).
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart({ server: { entry: "server" } }),
      react(),
    ],
  };
});
`,
);

// 4b. Configuración del Worker
write(
  "wrangler.jsonc",
  `{
  // Worker de VIP Remesas Express (TanStack Start full-stack sobre Cloudflare).
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "vip-remesas-express",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/server.ts",
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  }
}
`,
);

// 5. Almacenamiento de sesión estándar (localStorage), sin puente al editor
write(
  "src/integrations/supabase/previewAuthStorage.ts",
  `// Almacenamiento de sesión estándar del navegador.
export function brokeredPreviewStorage() {
  if (typeof window === "undefined") return undefined;
  return localStorage;
}
`,
);

// 5b. El navegador recibe la URL y la clave publicable durante el build.
patch("src/integrations/supabase/client.ts", [
  [
    /  \/\/ Use import\.meta\.env for client-side \(Vite build-time replacement\)\n  \/\/ Fall back to process\.env for SSR \(server-side rendering\)\n  const SUPABASE_URL = import\.meta\.env\.VITE_SUPABASE_URL \|\| process\.env\.SUPABASE_URL;\n  const SUPABASE_PUBLISHABLE_KEY = import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY \|\| process\.env\.SUPABASE_PUBLISHABLE_KEY;/,
    `  // Valores públicos incorporados por Vite durante la compilación.\n  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;\n  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;`,
  ],
  [
    /const message = `Missing Supabase environment variable\(s\): \$\{missing\.join\(', '\)\}\. Revisa tu archivo \.env\.`;/,
    "const message = `Faltan variables públicas de compilación: ${missing.map((name) => `VITE_${name}`).join(', ')}.`;",
  ],
]);

// 6. Reporte de errores propio
write(
  "src/lib/error-reporting.ts",
  `export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[app-error]", error, { route: window.location.pathname, ...context });
}
`,
);
patch("src/routes/__root.tsx", [
  [/import \{ reportLovableError \} from ".*lovable-error-reporting";/, 'import { reportAppError } from "../lib/error-reporting";'],
  [/reportLovableError\(/g, "reportAppError("],
]);

// 7. Google OAuth ya usa Supabase directamente en el código fuente (sin broker externo).

// 8. Sin URLs de lovable.app en el código de servidor
for (const rel of ["src/lib/emailjs.server.ts", "src/lib/payments.functions.ts", "src/lib/recharge-payments.functions.ts"]) {
  patch(rel, [[/"https:\/\/vip-remesas-express\.lovable\.app"/g, '(process.env["PUBLIC_SITE_URL"] || "http://localhost:3000")']]);
}

// 8b. Traducción del currículo con un proveedor de IA propio (API compatible OpenAI)
patch("src/lib/cv-translate.functions.ts", [
  [
    /const apiKey = process\.env\["LOVABLE_API_KEY"\];/,
    'const apiKey = process.env["AI_API_KEY"];',
  ],
  [
    /"https:\/\/ai\.gateway\.lovable\.dev\/v1\/chat\/completions"/,
    'process.env["AI_API_URL"] || "https://api.openai.com/v1/chat/completions"',
  ],
  [/model: "google\/gemini-2\.5-flash",/, 'model: process.env["AI_MODEL"] || "gpt-4o-mini",'],
]);

// 9. Plantilla de variables de entorno y guía de despliegue
write(
  ".env.example",
  `# --- Cliente (se envían al navegador: SOLO información pública) ---
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
VITE_VAPID_PUBLIC_KEY=
VITE_PIX_KEY=

# --- Servidor (secretos: nunca con prefijo VITE_) ---
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_SITE_URL=https://vipremesas.com

# Pagos
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# Recargas (proveedor manual mientras no exista API real)
RECARGAS_API_URL=
RECARGAS_API_KEY=
RECARGA_WEBHOOK_SECRET=

# Correos (EmailJS)
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
EMAILJS_ORIGIN=https://vipremesas.com

# Traducción del currículo (API compatible con OpenAI; opcional)
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=
AI_MODEL=gpt-4o-mini

# Notificaciones push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:tu@correo.com
PUSH_DISPATCH_SECRET=
`,
);

write(
  "README-DESPLIEGUE.md",
  `# VIP Remesas — despliegue independiente

Este código no depende de Lovable: ni paquetes, ni proxys, ni dominios.

## 1. Base de datos
Crea un proyecto de Postgres/Supabase propio (o autohospedado) y ejecuta en orden
los archivos de \`supabase/migrations/\`.

## 2. Variables
Copia \`.env.example\` a \`.env\` y rellena los valores. Nunca pongas claves
\`SERVICE_ROLE\` ni \`PRIVATE\` en variables con prefijo \`VITE_\`.

## 3. Arrancar
\`\`\`bash
bun install     # o npm install
bun run dev     # desarrollo en http://localhost:3000
bun run build   # producción -> .output/
bun run start   # sirve .output/server/index.mjs
\`\`\`

## 4. VPS
- Nginx como proxy inverso al puerto 3000, HTTP/2 y \`client_max_body_size 10m\`.
- HTTPS obligatorio (certbot): sin TLS no funcionan el service worker ni el push.
- Mantén el proceso con pm2 o systemd.

## 5. Después del primer despliegue
- Auth: \`Site URL = https://tudominio.com\`, Redirect URLs \`https://tudominio.com/**\`.
- Google: en Google Cloud añade \`https://TU-PROYECTO.supabase.co/auth/v1/callback\`.
- Webhooks: Mercado Pago → \`/api/public/mercadopago/webhook\`; recargas → \`/api/public/recargas/webhook\`.
- Actualiza las URLs de los triggers de push en la base a \`https://tudominio.com/api/public/push/dispatch\`.

## 6. Play Store (TWA)
\`\`\`bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://tudominio.com/manifest.webmanifest
bubblewrap build
\`\`\`
Copia \`assetlinks.json\` a \`public/.well-known/\`.
`,
);

// 10. .gitignore listo para GitHub
write(
  ".gitignore",
  `node_modules
dist
dist-ssr
.output
.nitro
.tanstack
.vite
*.log
*.local

# Secretos: nunca subir
.env
.env.*
!.env.example

# Móvil (se generan con Capacitor)
android/
ios/
*.keystore
*.jks
google-services.json
GoogleService-Info.plist

.DS_Store
.idea
.vscode/*
!.vscode/extensions.json
`,
);

// 11. GitHub: CI en cada push + despliegue al VPS al publicar en main
write(
  ".github/workflows/ci.yml",
  `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: Typecheck
        run: bunx tsc --noEmit
      - name: Verificar configuración pública
        run: |
          test -n "$VITE_SUPABASE_URL" || (echo "Falta VITE_SUPABASE_URL en Actions > Variables" && exit 1)
          test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || (echo "Falta VITE_SUPABASE_PUBLISHABLE_KEY en Actions > Variables" && exit 1)
        env:
          VITE_SUPABASE_URL: \${{ vars.VITE_SUPABASE_URL || secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: \${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY || secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
      - name: Build
        run: bun run build
        env:
          VITE_SUPABASE_URL: \${{ vars.VITE_SUPABASE_URL || secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: \${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY || secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          VITE_SUPABASE_PROJECT_ID: \${{ vars.VITE_SUPABASE_PROJECT_ID || secrets.VITE_SUPABASE_PROJECT_ID }}
`,
);

write(
  ".github/workflows/deploy.yml",
  `name: Deploy Cloudflare Workers

# Actualizar la web en producción: haz push a main (o lánzalo a mano).
on:
  workflow_dispatch:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: Verificar configuración pública
        run: |
          test -n "$VITE_SUPABASE_URL" || (echo "Falta VITE_SUPABASE_URL en Actions > Variables" && exit 1)
          test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || (echo "Falta VITE_SUPABASE_PUBLISHABLE_KEY en Actions > Variables" && exit 1)
        env:
          VITE_SUPABASE_URL: \${{ vars.VITE_SUPABASE_URL || secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: \${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY || secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
      - run: bun run build
        env:
          VITE_SUPABASE_URL: \${{ vars.VITE_SUPABASE_URL || secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: \${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY || secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          VITE_SUPABASE_PROJECT_ID: \${{ vars.VITE_SUPABASE_PROJECT_ID || secrets.VITE_SUPABASE_PROJECT_ID }}
          VITE_VAPID_PUBLIC_KEY: \${{ vars.VITE_VAPID_PUBLIC_KEY || secrets.VITE_VAPID_PUBLIC_KEY }}
          VITE_PIX_KEY: \${{ vars.VITE_PIX_KEY || secrets.VITE_PIX_KEY }}
      - name: Publicar en Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy -c dist/server/wrangler.json --keep-vars
`,
);

// 11c. Guía de despliegue en Cloudflare Workers
write(
  "README-CLOUDFLARE.md",
  `# VIP Remesas Express — Cloudflare Workers

Aplicación full-stack (TanStack Start) servida por un Worker. Base de datos,
autenticación y RLS siguen en Supabase; los pagos siguen siendo manuales.

## 1. Instalar y compilar
\`\`\`bash
bun install
bun run typecheck
bun run build
bun run deploy:dry-run     # comprueba el Worker sin publicar
\`\`\`

## 2. Desarrollo con el runtime real del Worker
\`\`\`bash
bun run dev        # Vite + entorno Cloudflare
bun run preview    # wrangler dev sobre el build de producción
\`\`\`

## 3. Publicar
\`\`\`bash
bunx wrangler login
bun run deploy
\`\`\`
También se publica solo en cada push a \`main\` (\`.github/workflows/deploy.yml\`)
con los secrets \`CLOUDFLARE_API_TOKEN\` y \`CLOUDFLARE_ACCOUNT_ID\`.

## 4. Variables y secretos
Las \`VITE_*\` son públicas y se inyectan al compilar (build o secrets del repo).
Los secretos del servidor van en el Worker, nunca en el navegador:
\`\`\`bash
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
\`\`\`

## 5. Conectar vipremesas.com (cuando lo decidas)
1. Añade el dominio a Cloudflare y apunta los nameservers en tu registrador.
2. Workers & Pages > vip-remesas-express > Settings > Domains & Routes >
   *Add custom domain* → \`vipremesas.com\` y \`www.vipremesas.com\`.
3. Actualiza \`PUBLIC_SITE_URL=https://vipremesas.com\` (secret del Worker).
4. Supabase Auth: Site URL \`https://vipremesas.com\`, Redirect URLs \`https://vipremesas.com/**\`.
5. Mercado Pago: webhook \`https://vipremesas.com/api/public/mercadopago/webhook\`.
6. Triggers de push en la base de datos: \`https://vipremesas.com/api/public/push/dispatch\`.

## 6. Límites del runtime del Worker
\`nodejs_compat\` cubre \`crypto\`, \`createHmac\`, \`timingSafeEqual\` y \`Buffer\`.
No añadas paquetes que necesiten binarios nativos, procesos hijos o disco real.
`,
);

// 11b. Migraciones sin URLs de la plataforma: usa tu propio dominio
{
  const dir = join(OUT, "supabase/migrations");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue;
    const path = join(dir, file);
    const src = readFileSync(path, "utf8");
    const next = src.replace(
      /https:\/\/[a-z0-9.\-]*lovable\.app/g,
      "https://tudominio.com",
    );
    if (next !== src) writeFileSync(path, next);
  }
}
patch("README-DESPLIEGUE.md", [
  [
    /Este código no depende de Lovable: ni paquetes, ni proxys, ni dominios\./,
    "Código 100% propio: sin paquetes, proxys ni dominios de terceros.",
  ],
]);

// 12. Apps Android e iPhone con Capacitor (envoltorio nativo del sitio)
pkg.dependencies["@capacitor/core"] = "^7.0.0";
pkg.dependencies["@capacitor/android"] = "^7.0.0";
pkg.dependencies["@capacitor/ios"] = "^7.0.0";
pkg.devDependencies["@capacitor/cli"] = "^7.0.0";
pkg.scripts["mobile:add"] = "cap add android && cap add ios";
pkg.scripts["mobile:sync"] = "cap sync";
pkg.scripts["mobile:android"] = "cap open android";
pkg.scripts["mobile:ios"] = "cap open ios";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

write(
  "capacitor.config.ts",
  `import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Las apps de Android e iPhone son un envoltorio nativo del sitio publicado:
 * al actualizar la web, las apps se actualizan solas (sin volver a subir el APK).
 * Cambia \`server.url\` por tu dominio real con HTTPS.
 */
const config: CapacitorConfig = {
  appId: "com.vipremesas.app",
  appName: "VIP Remesas",
  webDir: "public",
  server: {
    url: process.env["PUBLIC_SITE_URL"] || "https://tudominio.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: { allowMixedContent: false },
  ios: { contentInset: "always" },
};

export default config;
`,
);

write(
  "MOVIL.md",
  `# Apps Android e iPhone

La app móvil envuelve el sitio publicado con Capacitor. Ventaja: cuando
actualizas la web (push a \`main\`), **las apps ya instaladas se actualizan solas**.
Solo vuelves a subir la app a las tiendas si cambias el icono, el nombre o los permisos.

## 1. Preparar
\`\`\`bash
bun install
export PUBLIC_SITE_URL=https://tudominio.com
bun run mobile:add     # crea las carpetas android/ e ios/
bun run mobile:sync
\`\`\`

## 2. Android (Play Store)
\`\`\`bash
bun run mobile:android   # abre Android Studio
\`\`\`
- Build > Generate Signed App Bundle (.aab) con tu keystore (guárdalo fuera de Git).
- Sube el .aab a Play Console. Cada nueva versión: sube \`versionCode\` en \`android/app/build.gradle\`.
- Alternativa sin Capacitor: TWA con \`@bubblewrap/cli\` (ver README-DESPLIEGUE.md).

## 3. iPhone (App Store)
\`\`\`bash
bun run mobile:ios       # abre Xcode (requiere Mac)
\`\`\`
- Cuenta de Apple Developer, luego Product > Archive > Distribute App.
- Sube \`CFBundleVersion\` en cada actualización.

## 4. Notificaciones push en las apps
El sitio ya usa Web Push. En Android funciona dentro del envoltorio; en iOS,
si quieres push nativo, añade \`@capacitor/push-notifications\` + Firebase/APNs.
`,
);

patch("README-DESPLIEGUE.md", [
  [
    /## 6\. Play Store \(TWA\)/,
    `## 6. GitHub y actualizaciones
- Sube esta carpeta a tu repositorio y crea la rama \`main\`.
- Secrets del repo: \`VITE_SUPABASE_URL\`, \`VITE_SUPABASE_PUBLISHABLE_KEY\`,
  \`VITE_SUPABASE_PROJECT_ID\`, \`VPS_HOST\`, \`VPS_USER\`, \`VPS_SSH_KEY\`, \`VPS_PATH\`.
- Cada push a \`main\` compila (\`ci.yml\`) y publica en Cloudflare Workers (\`deploy.yml\`).
- Guía completa de Cloudflare: \`README-CLOUDFLARE.md\`.
- Apps Android/iPhone: ver \`MOVIL.md\`.

## 7. Play Store (TWA)`,
  ],
]);

console.log("Exportación lista en portable-export/ (sin dependencias de Lovable)");
