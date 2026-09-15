import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const FALLBACK_SUPABASE_URL = "https://nczavdcqueebhhtkuasv.supabase.co";
// Supabase publishable keys are intentionally safe to expose in browser bundles.
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rxqHb79-KneH3UZGHj2fDA_5ofGaUds";

export default defineConfig(({ mode }) => {
  // Prefer build-time variables when Cloudflare/GitHub supplies them, but keep a
  // known-good public Supabase configuration so Runtime Variables alone cannot
  // break the browser bundle.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const publicSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL;
  const publicSupabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  if (publicSupabaseUrl !== FALLBACK_SUPABASE_URL) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL debe ser exactamente ${FALLBACK_SUPABASE_URL}. Valor recibido: ${publicSupabaseUrl}.`,
    );
  }

  return {
    server: { port: 3000, host: true },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseKey),
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
