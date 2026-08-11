import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowUpRight, Smartphone, FolderOpen, Folder } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: History,
  head: () => ({
    meta: [
      { title: "Historial de remesas y recargas | VIP Remesas" },
      { name: "description", content: "Consulta el estado de todas tus remesas a Cuba y tus recargas Cubacel en un solo lugar." },
      { property: "og:title", content: "Historial de remesas y recargas | VIP Remesas" },
      { property: "og:description", content: "Estado de tus remesas a Cuba y recargas Cubacel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { id: string; created_at: string };

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (key === today) return "Hoy";
  if (key === yest) return "Ayer";
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** Agrupa por día y numera 1..N dentro de cada día, según el orden en que se procesaron. */
function groupByDay<T extends Row>(rows: T[] | undefined) {
  const map = new Map<string, T[]>();
  (rows ?? []).forEach((r) => {
    const k = dayKey(r.created_at);
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  });
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => {
      const asc = [...list].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      const numbered = asc.map((item, i) => ({ item, n: i + 1 }));
      return { key, rows: numbered.reverse() };
    });
}

function DayFolder({
  label, count, defaultOpen, children,
}: { label: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card/60">
      <button onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {open ? <FolderOpen className="h-4 w-4 text-gold" /> : <Folder className="h-4 w-4 text-gold" />}
        <span className="flex-1 text-sm font-bold">{label}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {count}
        </span>
      </button>
      {open && <div className="space-y-2 border-t border-border p-3">{children}</div>}
    </section>
  );
}

function History() {
  const [tab, setTab] = useState<"remesas" | "recargas">("remesas");

  const txs = useQuery({
    queryKey: ["transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const recargas = useQuery({
    queryKey: ["recargas-mine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recargas_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const txDays = groupByDay(txs.data ?? []);
  const rcDays = groupByDay(recargas.data ?? []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Historial</h1>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-sm font-medium">
        {([["remesas", "Remesas"], ["recargas", "Recargas"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-2 ${tab === id ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "remesas" ? (
        <>
          {txs.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {txs.data && txs.data.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
              Sin remesas todavía.
            </div>
          )}
          <div className="space-y-3">
            {txDays.map((day, di) => (
              <DayFolder key={day.key} label={dayLabel(day.key)} count={day.rows.length} defaultOpen={di === 0}>
                {day.rows.map(({ item: t, n }) => (
                  <Link key={t.id} to="/transaction/$id" params={{ id: t.id }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-gold/60">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-gold">
                      {n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-destructive">{t.recipient_name}</div>
                      <div className="truncate text-xs font-semibold text-muted-foreground">
                        {new Date(t.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })} · {t.destination_country}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-destructive">
                        {formatMoney(Number(t.total_brl), (t as { origin_currency?: string }).origin_currency || "BRL")}
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </DayFolder>
            ))}
          </div>
        </>
      ) : (
        <>
          {recargas.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {recargas.data && recargas.data.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
              Sin recargas todavía.
            </div>
          )}
          <div className="space-y-3">
            {rcDays.map((day, di) => (
              <DayFolder key={day.key} label={dayLabel(day.key)} count={day.rows.length} defaultOpen={di === 0}>
                {day.rows.map(({ item: r, n }) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-gold">
                      {n}
                    </span>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold shadow-gold">
                      <Smartphone className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-destructive">{r.promo_title}</div>
                      <div className="truncate text-xs font-semibold text-muted-foreground">{r.phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-destructive">{formatMoney(Number(r.price_brl), "BRL")}</div>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </DayFolder>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
