import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatCurrency, COUNTRIES, getRate } from "@/lib/remittance";
import { ArrowUpRight, Plus, TrendingUp } from "lucide-react";

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

  const txs = useQuery({
    queryKey: ["transactions-recent", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(4);
      if (error) throw error;
      return data;
    },
  });

  const firstName = profile.data?.full_name?.split(" ")[0] || "VIP";
  const balance = Number(profile.data?.balance_brl ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Hola,</p>
        <h1 className="font-display text-2xl font-bold">{firstName} 👋</h1>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-gold p-6 shadow-gold">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <p className="text-xs font-medium uppercase tracking-wider text-black/70">Tu saldo</p>
        <p className="mt-1 font-display text-4xl font-bold text-black">{formatBRL(balance)}</p>
        <p className="mt-1 text-xs text-black/70">Cuenta VIP · Real Brasileño</p>
      </div>

      {/* Send button */}
      <Link
        to="/send"
        className="flex items-center justify-between rounded-2xl border border-gold/40 bg-card p-5 shadow-card transition hover:border-gold"
      >
        <div>
          <p className="font-display text-lg font-bold">Nueva remesa</p>
          <p className="text-xs text-muted-foreground">Envía en minutos</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-gold shadow-gold">
          <Plus className="h-6 w-6 text-primary-foreground" />
        </div>
      </Link>

      {/* Rates */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tasa del día</h2>
          <TrendingUp className="h-4 w-4 text-gold" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {COUNTRIES.map((c) => (
            <div key={c.code} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-lg">{c.flag}</span> {c.name}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">1 BRL =</div>
              <div className="font-display text-lg font-bold text-gold">{getRate(c.code).toFixed(2)} {c.currency}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent transactions */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimas remesas</h2>
          <Link to="/history" className="text-xs font-medium text-gold">Ver todo</Link>
        </div>
        {txs.isLoading && <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Cargando…</div>}
        {txs.data && txs.data.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Aún no has enviado remesas. ¡Envía la primera y disfruta la experiencia VIP!
          </div>
        )}
        <ul className="space-y-2">
          {txs.data?.map((t) => (
            <li key={t.id}>
              <Link to="/transaction/$id" params={{ id: t.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-gold/60">
                <div>
                  <div className="text-sm font-semibold">{t.recipient_name}</div>
                  <div className="text-xs text-muted-foreground">{t.destination_country} · {t.tracking_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gold">{formatBRL(Number(t.total_brl))}</div>
                  <StatusBadge status={t.status} />
                </div>
                <ArrowUpRight className="ml-2 h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
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

// silence unused
void formatCurrency;
