import { createFileRoute } from "@tanstack/react-router";
import { StoreCatalog } from "@/components/StoreCatalog";

export const Route = createFileRoute("/_authenticated/tienda")({
  component: TiendaPage,
  head: () => ({
    meta: [
      { title: "VipTienda | Compra para tu familia en Cuba" },
      { name: "description", content: "Celulares, tablets, accesorios y electrodomésticos para entregar a tu familia en Cuba con VIP Remesas." },
      { property: "og:title", content: "VipTienda | Compra para tu familia en Cuba" },
      { property: "og:description", content: "Catálogo de celulares y electrodomésticos con entrega en Cuba." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TiendaPage() {
  return <StoreCatalog />;
}
