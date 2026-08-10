import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ORIGINS, type OriginCode, type DestCurrency,
  type RateRow, findRate,
} from "@/lib/remittance";
import { Send, Smartphone, TrendingUp, Store, Sparkles } from "lucide-react";
import { BannerHero } from "@/components/BannerCarousel";
import { FlagIcon } from "@/components/FlagIcon";

export const Route = createFileRoute("/_authenticated/dashboard")({
  // El admin y el organizador van directo a su panel: no usan el inicio.
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id)
      .in("role", ["admin", "organizador"]);
    if ((data ?? []).length > 0) throw redirect({ to: "/admin" });
  },
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Inicio | VIP Remesas a Cuba" },
      { name: "description", content: "Tasas del día, remesas, recargas Cubacel y VipShop Brasil en un solo lugar." },
      { property: "og:title", content: "Inicio | VIP Remesas a Cuba" },
      { property: "og:description", content: "Tasas del día, remesas, recargas y VipShop Brasil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Dashboard() {
  const { user } = Route.useRouteContext();

  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rates = useQuery<RateRow[]>({
    queryKey: ["rates"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("rates").select("*").eq("active", true);
      if (error) throw error;
      return data as unknown as RateRow[];
    },
  });

  const firstName = profile.data?.full_name?.split(" ")[0] || "VIP";

  const actions = [
    { to: "/send", label: "Remesas", sub: "Envía ahora", icon: Send, grad: "bg-gradient-rose" },
    { to: "/recargas", label: "Recargas", sub: "Cubacel", icon: Smartphone, grad: "bg-gradient-emerald" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <p className="text-sm font-bold text-muted-foreground">Hola,</p>
        <h1 className="font-display text-2xl font-extrabold">{firstName} 👋</h1>
      </div>

      {/* Cartel principal: los banners del panel admin son el fondo */}
      <BannerHero>
        <p className="text-xs font-extrabold uppercase tracking-wider text-white/90">Envía a Cuba</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-white drop-shadow">Desde 20 en 15 min</p>
        <p className="mt-1 text-xs font-bold text-white/90">Brasil · México · Europa · EE.UU. → Cuba</p>
      </BannerHero>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ to, label, sub, icon: Icon, grad }, i) => (
          <Link
            key={to}
            to={to}
            style={{ animationDelay: `${i * 60}ms` }}
            className="animate-rise flex items-center justify-between rounded-2xl border border-border bg-card bg-dots p-4 shadow-card transition-transform hover:border-gold active:scale-[0.98]"
          >
            <div>
              <p className="font-display text-base font-extrabold">{label}</p>
              <p className="text-[11px] font-bold text-muted-foreground">{sub}</p>
            </div>
            <div className={`grid h-10 w-10 place-items-center rounded-full text-white shadow-glow ${grad}`}>
              <Icon className="h-5 w-5" />
            </div>
          </Link>
        ))}
        <Link
          to="/tienda"
          className="animate-rise relative col-span-2 flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-amber p-4 text-white shadow-glow transition-transform active:scale-[0.98]"
        >
          <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shine bg-white/40 blur-md" />
          <div className="relative">
            <p className="font-display text-base font-extrabold">VipShop Brasil</p>
            <p className="text-[11px] font-bold text-white/90">Celulares, electrodomésticos y alimentos</p>
          </div>
          <div className="relative grid h-10 w-10 place-items-center rounded-full bg-white/25">
            <Store className="h-5 w-5 animate-float" />
          </div>
        </Link>
      </div>

      {/* Tasas de hoy */}
      <section className="animate-rise">
        <div className="mb-2 flex items-center justify-between rounded-xl bg-gradient-sky px-3 py-2 text-white shadow-glow">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-white">
            <Sparkles className="h-4 w-4" /> Tasas de hoy
          </h2>
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="space-y-2">
          {ORIGINS.map((o, i) => {
            const rCup = findRate(rates.data, o.code as OriginCode, "transferencia", "CUP" as DestCurrency);
            const rMlc = findRate(rates.data, o.code as OriginCode, "transferencia", "MLC" as DestCurrency);
            const eCup = findRate(rates.data, o.code as OriginCode, "efectivo", "CUP" as DestCurrency);
            const eUsd = findRate(rates.data, o.code as OriginCode, "efectivo", "USD" as DestCurrency);
            return (
              <div
                key={o.code}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-rise rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <FlagIcon code={o.code} className="h-5 w-7" /> {o.name} →{" "}
                  <FlagIcon code="CU" className="h-5 w-7" /> Cuba
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-secondary p-2">
                    <div className="font-bold text-muted-foreground">1 {o.currency} · CUP</div>
                    <div className="font-display text-lg font-extrabold text-gold">
                      {rCup ? rCup.rate.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-accent p-2">
                    <div className="font-bold text-muted-foreground">1 {o.currency} · MLC</div>
                    <div className="font-display text-lg font-extrabold text-gold">
                      {rMlc ? rMlc.rate.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded-lg border border-gold/30 bg-secondary/60 p-2">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase text-gold">
                    <Banknote className="h-3.5 w-3.5" /> Efectivo (entrega en mano)
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="font-bold text-muted-foreground">1 {o.currency} · CUP</div>
                      <div className="font-display text-base font-extrabold text-foreground">
                        {eCup ? eCup.rate.toFixed(2) : "No disponible"}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-muted-foreground">1 {o.currency} · USD</div>
                      <div className="font-display text-base font-extrabold text-foreground">
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
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    processing: "bg-brand-sky/20 text-brand-sky",
    completed: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };
  const label: Record<string, string> = {
    pending: "Pendiente", processing: "Procesando", completed: "Completado", rejected: "Rechazado",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold ${map[status] || ""}`}>
      {label[status] || status}
    </span>
  );
}
