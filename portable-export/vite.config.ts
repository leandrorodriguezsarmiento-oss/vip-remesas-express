import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 3000, host: true },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // Salida Node autohospedable (VPS + pm2/systemd detrás de Nginx).
    // Para otros destinos define NITRO_PRESET (vercel, netlify, cloudflare-module...).
    tanstackStart({ server: { entry: "server" } }),
  ],
});
