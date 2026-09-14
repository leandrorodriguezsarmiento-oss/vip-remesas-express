import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIP Remesas — Envía dinero a Cuba y Latinoamérica",
  description: "Envía remesas desde Brasil, Europa y Estados Unidos a Cuba. Rápido, seguro y con la mejor tasa.",
  applicationName: "VIP Remesas",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "VIP Remesas", statusBarStyle: "default" },
  openGraph: {
    title: "VIP Remesas — Envía dinero a Cuba y Latinoamérica",
    description: "Envía remesas desde Brasil, Europa y Estados Unidos a Cuba. Rápido, seguro y con la mejor tasa.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "VIP Remesas", description: "Envía remesas a Cuba en minutos." },
};
export const viewport: Viewport = {
  themeColor: "#10B981", width: "device-width", initialScale: 1, viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
