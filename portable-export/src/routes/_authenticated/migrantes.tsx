import { createFileRoute } from "@tanstack/react-router";
import { MigrantGuide } from "@/components/MigrantGuide";

export const Route = createFileRoute("/_authenticated/migrantes")({
  component: MigrantesPage,
  head: () => ({
    meta: [
      { title: "VipMigrante | Guía gratis para migrantes en Brasil" },
      {
        name: "description",
        content:
          "Ayuda gratuita para migrantes en Brasil: lugares para tus trámites, teléfonos de contacto, apps necesarias y creador de currículo gratis.",
      },
      { property: "og:title", content: "VipMigrante | Guía gratis para migrantes en Brasil" },
      {
        property: "og:description",
        content: "Lugares, contactos, apps útiles y currículo gratis para migrantes en Brasil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MigrantesPage() {
  return <MigrantGuide />;
}
