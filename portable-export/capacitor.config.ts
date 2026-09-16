import type { CapacitorConfig } from "@capacitor/cli";

/**
 * VIP Remesas Android/iOS wrapper.
 * The native app loads the production site, so web updates do not require
 * rebuilding the APK for ordinary website/content changes.
 */
const config: CapacitorConfig = {
  appId: "com.vipremesas.app",
  appName: "VIP Remesas",
  webDir: "public",
  server: {
    url: "https://vipremesas.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
