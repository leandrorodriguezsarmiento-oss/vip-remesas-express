import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  // Explicit build variables must override any stale values loaded from files.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const publicSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publicSupabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const expectedSupabaseUrl = "https://nczavdcqueebhhtkuasv.supabase.co";
  if (command === "build") {
    const missing = [
      ...(!publicSupabaseUrl ? ["NEXT_PUBLIC_SUPABASE_URL"] : []),
      ...(!publicSupabaseKey ? ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    if (missing.length > 0) {
      throw new Error(
        `Faltan variables públicas de compilación: ${missing.join(", ")}. ` +
          "Configúralas como Variables de compilación en Cloudflare o como Variables del repositorio en GitHub.",
      );
    }
    if (publicSupabaseUrl !== expectedSupabaseUrl) {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_URL debe ser exactamente ${expectedSupabaseUrl}. Valor recibido: ${publicSupabaseUrl || "vacío"}.`,
      );
    }
  }

  return {
    server: { port: 3000, host: true },
    define: {
      // VITE_* is guaranteed to be replaced in browser bundles by Vite.
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseKey),
      // Keep NEXT_PUBLIC aliases available to any server-side code that still references them.
      "import.meta.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
      "import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseKey),
    },
    plugins: [
      tsConfigPaths(),
      tailwindcss(),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart({ server: { entry: "server" } }),
      react(),
    ],
  };
});
