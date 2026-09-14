import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  // Explicit build variables must override any stale values loaded from files.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  // Cloudflare Build Variables often use the server-side names. Only these
  // two values are public, so safely expose them to the browser bundle.
  const publicSupabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publicSupabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (command === "build") {
    const missing = [
      ...(!publicSupabaseUrl?.trim() ? ["SUPABASE_URL"] : []),
      ...(!publicSupabaseKey?.trim() ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    if (missing.length > 0) {
      throw new Error(
        `Faltan variables públicas de compilación: ${missing.join(", ")}. ` +
          "Configúralas como Variables de compilación en Cloudflare o como Variables del repositorio en GitHub.",
      );
    }
  }

  return {
    server: { port: 3000, host: true },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseKey),
    },
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
