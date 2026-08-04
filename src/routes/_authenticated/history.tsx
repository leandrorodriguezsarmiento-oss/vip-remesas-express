import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { StatusBadge } from "./dashboard";
import { ArrowUpRight, Smartphone } from "lucide-react";

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
          <ul className="space-y-2">
            {txs.data?.map((t) => (
              <li key={t.id}>
                <Link to="/transaction/$id" params={{ id: t.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-gold/60">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold">
                      #{(t as { order_no?: number }).order_no ?? "—"} · {t.recipient_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("es")} · {t.destination_country}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{t.tracking_id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gold">
                      {formatMoney(Number(t.total_brl), (t as { origin_currency?: string }).origin_currency || "BRL")}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {recargas.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {recargas.data && recargas.data.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
              Sin recargas todavía.
            </div>
          )}
          <ul className="space-y-2">
            {recargas.data?.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-gold shadow-gold">
                  <Smartphone className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    #{(r as { order_no?: number }).order_no ?? "—"} · {r.promo_title}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.phone} · {new Date(r.created_at).toLocaleDateString("es")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gold">{formatMoney(Number(r.price_brl), "BRL")}</div>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
