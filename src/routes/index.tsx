import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Shield, Zap, Globe2, TrendingUp, Smartphone, Banknote } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { FlagIcon } from "@/components/FlagIcon";
import { BannerCarousel } from "@/components/BannerCarousel";
import { ORIGINS, findRate, formatMoney, type OriginCode, type DestCurrency, type RateRow } from "@/lib/remittance";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: "Tasas de cambio y recargas a Cuba | VIP Remesas" },
      { name: "description", content: "Consulta gratis las tasas de hoy para enviar dinero a Cuba desde Brasil, México, EE.UU. y Europa, y las promociones de recarga Cubacel." },
      { property: "og:title", content: "Tasas de cambio y recargas a Cuba | VIP Remesas" },
      { property: "og:description", content: "Tasas de hoy y promos de recarga Cubacel, sin necesidad de crear cuenta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Promo = { id: string; title: string; price_brl: number; bonus_label: string | null };

function Landing() {
  const rates = useQuery<RateRow[]>({
    queryKey: ["public-rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rates").select("*").eq("active", true);
      if (error) throw error;
      return data as unknown as RateRow[];
    },
  });

  const promos = useQuery<Promo[]>({
    queryKey: ["public-promos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promos")
        .select("id, title, price_brl, bonus_label")
        .eq("active", true)
        .order("price_brl")
        .limit(6);
      if (error) throw error;
      return data as unknown as Promo[];
    },
  });

  return (
    <div className="min-h-screen bg-gradient-vip text-foreground">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="font-display text-lg font-bold tracking-wide">VIP Remesas</span>
        </div>
        <Link to="/auth" search={{ next: undefined }} className="text-sm font-bold text-gold hover:opacity-80">
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-md px-5 pt-10 pb-16">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-card/60 px-3 py-1 text-xs font-bold text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Tasas visibles sin cuenta
        </p>
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
          Envía dinero <span className="text-gradient-gold">como VIP</span> a Cuba.
        </h1>
        <p className="mt-4 text-base font-medium text-muted-foreground">
          Mira las tasas de hoy y las promos de recarga. Crea tu cuenta solo cuando quieras enviar.
        </p>

        {/* Banners (rotan cada 2 s) */}
        <div className="mt-6">
          <BannerCarousel />
        </div>


        {/* Tasas públicas */}
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tasas de hoy</h2>
            <TrendingUp className="h-4 w-4 text-gold" />
          </div>
          {rates.isLoading && <p className="text-sm font-semibold text-muted-foreground">Cargando tasas…</p>}
          <div className="space-y-2">
            {ORIGINS.map((o) => {
              const rCup = findRate(rates.data, o.code as OriginCode, "transferencia", "CUP" as DestCurrency);
              const rMlc = findRate(rates.data, o.code as OriginCode, "transferencia", "MLC" as DestCurrency);
              const eCup = findRate(rates.data, o.code as OriginCode, "efectivo", "CUP" as DestCurrency);
              const eUsd = findRate(rates.data, o.code as OriginCode, "efectivo", "USD" as DestCurrency);
              return (
                <div key={o.code} className="rounded-xl border border-border bg-card p-3 shadow-card">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <FlagIcon code={o.code} className="h-5 w-7" /> {o.name} →{" "}
                    <FlagIcon code="CU" className="h-5 w-7" /> Cuba
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="font-semibold text-muted-foreground">1 {o.currency} · CUP</div>
                      <div className="font-display text-lg font-bold text-gold">{rCup ? rCup.rate.toFixed(2) : "—"}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-muted-foreground">1 {o.currency} · MLC</div>
                      <div className="font-display text-lg font-bold text-gold">{rMlc ? rMlc.rate.toFixed(2) : "—"}</div>
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg border border-gold/30 bg-secondary/60 p-2">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase text-gold">
                      <Banknote className="h-3.5 w-3.5" /> Efectivo (entrega en mano)
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="font-semibold text-muted-foreground">1 {o.currency} · CUP</div>
                        <div className="font-display text-base font-bold text-foreground">
                          {eCup ? eCup.rate.toFixed(2) : "No disponible"}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-muted-foreground">1 {o.currency} · USD</div>
                        <div className="font-display text-base font-bold text-foreground">
                          {eUsd ? eUsd.rate.toFixed(2) : "No disponible"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

            })}
          </div>
        </section>

        {/* Recargas públicas */}
        {promos.data && promos.data.length > 0 && (
          <section className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recargas Cubacel</h2>
              <Smartphone className="h-4 w-4 text-gold" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {promos.data.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
                  <div className="text-sm font-bold">{p.title}</div>
                  {p.bonus_label && <div className="text-[11px] font-semibold text-gold">{p.bonus_label}</div>}
                  <div className="mt-1 font-display text-base font-bold text-gold">
                    {formatMoney(Number(p.price_brl), "BRL")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 space-y-3">
          <Link
            to="/auth"
            search={{ next: undefined }}
            className="block w-full rounded-xl bg-gradient-gold px-6 py-4 text-center text-base font-bold text-primary-foreground shadow-gold"
          >
            Crear cuenta gratis
          </Link>
          <Link
            to="/auth"
            search={{ next: undefined }}
            className="block w-full rounded-xl border border-gold/50 bg-card/50 px-6 py-4 text-center text-base font-semibold text-foreground"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3">
          {[
            { icon: Zap, title: "En minutos", desc: "Acredita rápido" },
            { icon: Shield, title: "100% seguro", desc: "Cifrado y auth" },
            { icon: Globe2, title: "4 orígenes", desc: "BR · MX · EU · US" },
            { icon: Sparkles, title: "Tasa VIP", desc: "Mejor cambio" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <Icon className="mb-2 h-5 w-5 text-gold" />
              <div className="text-sm font-bold">{title}</div>
              <div className="text-xs font-medium text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
