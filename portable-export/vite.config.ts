import { defineConfig, loadEnv } from "vite";
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
        `Faltan variables públicas de compilación: ${missing.join(", ")}. ` +
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
