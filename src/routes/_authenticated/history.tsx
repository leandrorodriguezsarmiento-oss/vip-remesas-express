import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/remittance";
import { StatusBadge } from "./dashboard";
import { ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: History,
});

function History() {
  const txs = useQuery({
    queryKey: ["transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Historial</h1>
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
                <div className="truncate text-sm font-semibold">{t.recipient_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString("es")} · {t.destination_country}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{t.tracking_id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gold">{formatBRL(Number(t.total_brl))}</div>
                <StatusBadge status={t.status} />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
