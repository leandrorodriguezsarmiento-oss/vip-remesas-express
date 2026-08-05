import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ORIGINS, type OriginCode, type DestCurrency,
  type RateRow, findRate,
} from "@/lib/remittance";
import { Send, Smartphone, TrendingUp } from "lucide-react";
import { BannerCarousel } from "@/components/BannerCarousel";
import { PushToggle } from "@/components/PushToggle";
import { FlagIcon } from "@/components/FlagIcon";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
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
    queryFn: async () => {
      const { data, error } = await supabase.from("rates").select("*").eq("active", true);
      if (error) throw error;
      return data as unknown as RateRow[];
    },
  });

  const firstName = profile.data?.full_name?.split(" ")[0] || "VIP";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Hola,</p>
        <h1 className="font-display text-2xl font-bold">{firstName} 👋</h1>
      </div>

      {/* Banners */}
      <BannerCarousel />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-gold p-6 shadow-gold">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        <p className="text-xs font-medium uppercase tracking-wider text-white/90">Envía a Cuba</p>
        <p className="mt-1 font-display text-3xl font-bold text-white">Desde 20 en 15 min</p>
        <p className="mt-1 text-xs text-white/85">Brasil · Europa · Estados Unidos → Cuba</p>
      </div>


      {/* Push notifications toggle */}
      <PushToggle hideWhenBlocked />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/send" className="flex items-center justify-between rounded-2xl border border-gold/40 bg-card p-4 shadow-card hover:border-gold">
          <div>
            <p className="font-display text-base font-bold">Remesas</p>
            <p className="text-[11px] text-muted-foreground">Envía ahora</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-gold shadow-gold">
            <Send className="h-5 w-5 text-primary-foreground" />
          </div>
        </Link>
        <Link to="/recargas" className="flex items-center justify-between rounded-2xl border border-gold/40 bg-card p-4 shadow-card hover:border-gold">
          <div>
            <p className="font-display text-base font-bold">Recargas</p>
            <p className="text-[11px] text-muted-foreground">Cubacel</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-gold shadow-gold">
            <Smartphone className="h-5 w-5 text-primary-foreground" />
          </div>
        </Link>
      </div>

      {/* Rates preview */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tasas de hoy</h2>
          <TrendingUp className="h-4 w-4 text-gold" />
        </div>
        <div className="space-y-2">
          {ORIGINS.map((o) => {
            const rCup = findRate(rates.data, o.code as OriginCode, "transferencia", "CUP" as DestCurrency);
            const rMlc = findRate(rates.data, o.code as OriginCode, "transferencia", "MLC" as DestCurrency);
            return (
              <div key={o.code} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FlagIcon code={o.code} className="h-5 w-7" /> {o.name} →{" "}
                  <FlagIcon code="CU" className="h-5 w-7" /> Cuba
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">1 {o.currency} · CUP</div>
                    <div className="font-display text-lg font-bold text-gold">
                      {rCup ? rCup.rate.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">1 {o.currency} · MLC</div>
                    <div className="font-display text-lg font-bold text-gold">
                      {rMlc ? rMlc.rate.toFixed(2) : "—"}
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
    processing: "bg-gold/20 text-gold",
    completed: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };
  const label: Record<string, string> = {
    pending: "Pendiente", processing: "Procesando", completed: "Completado", rejected: "Rechazado",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] || ""}`}>
      {label[status] || status}
    </span>
  );
}
