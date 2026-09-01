import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Las apps de Android e iPhone son un envoltorio nativo del sitio publicado:
 * al actualizar la web, las apps se actualizan solas (sin volver a subir el APK).
 * Cambia `server.url` por tu dominio real con HTTPS.
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
