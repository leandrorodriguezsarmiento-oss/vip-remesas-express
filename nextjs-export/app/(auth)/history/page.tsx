"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/remittance";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowUpRight } from "lucide-react";

export default function HistoryPage() {
  const txs = useQuery({
    queryKey: ["transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Historial</h1>
      {txs.data && txs.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">Sin remesas todavía.</div>
      )}
      <ul className="space-y-2">
        {txs.data?.map((t) => (
          <li key={t.id}>
            <Link href={`/transaction/${t.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold">{t.recipient_name}</div>
                <div className="truncate text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("es")} · {t.destination_country}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{t.tracking_id}</div>
              </div>
              <div className="text-right"><div className="text-sm font-bold text-gold">{formatBRL(Number(t.total_brl))}</div><StatusBadge status={t.status} /></div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
