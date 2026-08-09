import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { ShoppingBag, Crown, Smartphone, Refrigerator, X } from "lucide-react";
import { SUPPORT_WHATSAPP_URL } from "@/lib/alias";

export type StoreProduct = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_brl: number;
  images: string[];
};

export const STORE_CATEGORIES = [
  { id: "celulares", label: "Celulares, tablets y accesorios", icon: Smartphone },
  { id: "electrodomesticos", label: "Electrodomésticos", icon: Refrigerator },
] as const;

export function VipTiendaLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold shadow-gold">
        <Crown className="h-5 w-5 text-primary-foreground" />
      </span>
      <span className="font-display text-2xl font-extrabold tracking-tight">
        Vip<span className="text-gradient-gold">Tienda</span>
      </span>
    </div>
  );
}

export function StoreCatalog() {
  const [cat, setCat] = useState<string>(STORE_CATEGORIES[0].id);
  const [open, setOpen] = useState<StoreProduct | null>(null);

  const q = useQuery<StoreProduct[]>({
    queryKey: ["store-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("id, category, title, description, price_brl, images")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        price_brl: Number(p.price_brl),
        images: (p.images ?? []) as string[],
      })) as StoreProduct[];
    },
  });

  const items = (q.data ?? []).filter((p) => p.category === cat);

  return (
    <div className="space-y-4">
      <VipTiendaLogo />
      <p className="text-sm font-semibold text-muted-foreground">
        Elige lo que quieres enviarle a tu familia en Cuba. Nosotros lo entregamos.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {STORE_CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCat(id)}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-extrabold transition ${
              cat === id ? "border-gold bg-accent text-gold" : "border-border bg-card text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="uppercase leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm font-semibold text-muted-foreground">Cargando productos…</p>}
      {!q.isLoading && items.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm font-semibold text-muted-foreground">
          Pronto publicaremos productos en esta categoría.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => setOpen(p)}
            className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-card hover:border-gold"
          >
            <div className="aspect-square w-full bg-secondary">
              {p.images[0] ? (
                <img src={p.images[0]} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-extrabold leading-tight">{p.title}</p>
              <p className="mt-1 font-display text-base font-bold text-gold">
                {formatMoney(p.price_brl, "BRL")}
              </p>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-gold/40 bg-card p-4 sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-display text-lg font-extrabold">{open.title}</p>
              <button onClick={() => setOpen(null)} className="rounded-md p-1 text-muted-foreground hover:text-gold">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {open.images.map((src) => (
                <img key={src} src={src} alt={open.title} className="h-40 w-40 shrink-0 rounded-xl object-cover" />
              ))}
            </div>
            {open.description && (
              <p className="mt-3 text-sm font-semibold text-foreground/80">{open.description}</p>
            )}
            <p className="mt-3 font-display text-2xl font-bold text-gold">
              {formatMoney(open.price_brl, "BRL")}
            </p>
            <a
              href={`${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(`Hola, quiero comprar en VipTienda: ${open.title}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block w-full rounded-xl bg-gradient-gold px-4 py-3 text-center text-sm font-bold text-primary-foreground shadow-gold"
            >
              Pedir por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
