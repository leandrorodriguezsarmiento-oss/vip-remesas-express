/**
 * Genera una copia 100% independiente del proyecto (sin ninguna dependencia de
 * Lovable) en la carpeta `portable-export/`, lista para subir a tu repositorio
 * de GitHub y desplegar en un VPS, Vercel, Fly.io, Render, etc.
 *
 * Uso:  bun run export:portable
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
cpSync(ROOT, OUT, {
  recursive: true,
  filter: (src) => {
    const rel = src.slice(ROOT.length + 1);
    if (!rel) return true;
    return !SKIP.has(rel.split("/")[0]!);
  },
});

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
  "src/routeTree.gen.ts", // lo regenera el plugin de rutas al arrancar
  "AGENTS.md",
  "bunfig.toml",
]) drop(rel);

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
  start: "node .output/server/index.mjs",
  preview: "vite preview",
  lint: "eslint .",
};
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

// 4. Configuración de Vite propia (sin @lovable.dev/vite-tanstack-config)
write(
  "vite.config.ts",
  `import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 3000, host: true },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      customViteReactPlugin: true,
      // Salida Node autohospedable (VPS + pm2/systemd detrás de Nginx).
      // Cambia a "vercel" / "cloudflare-module" si despliegas allí.
      target: "node-server",
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
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

// 7. Google OAuth directo contra Supabase (sin el broker de Lovable)
patch("src/routes/auth.index.tsx", [
  [/import \{ lovable \} from "@\/integrations\/lovable\/index";\n/, ""],
  [
    /const result = await lovable\.auth\.signInWithOAuth\("google", \{\s*redirect_uri: window\.location\.origin,\s*\}\);/,
    `const result = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: \`\${window.location.origin}/auth\` },
      });`,
  ],
  [/if \(result\.redirected\) return;\n\s*goNext\(\);/, "return;"],
]);

// 8. Sin URLs de lovable.app en el código de servidor
for (const rel of ["src/lib/emailjs.server.ts", "src/lib/payments.functions.ts", "src/lib/recharge-payments.functions.ts"]) {
  patch(rel, [[/"https:\/\/vip-remesas-express\.lovable\.app"/g, 'process.env["PUBLIC_SITE_URL"] || "http://localhost:3000"']]);
}

// 9. Plantilla de variables de entorno y guía de despliegue
write(
  ".env.example",
  `# --- Cliente (se envían al navegador: solo URL y clave pública) ---
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=

# --- Servidor ---
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_SITE_URL=https://tudominio.com

# Pagos
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# Recargas
RECARGAS_API_URL=
RECARGAS_API_KEY=
RECARGA_WEBHOOK_SECRET=

# Correos (EmailJS)
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
EMAILJS_ORIGIN=https://tudominio.com

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

console.log("Exportación lista en portable-export/ (sin dependencias de Lovable)");
