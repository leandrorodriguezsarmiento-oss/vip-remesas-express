import { defineConfig } from "vite";
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
