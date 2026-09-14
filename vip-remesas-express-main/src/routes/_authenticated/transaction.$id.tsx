import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatCurrency } from "@/lib/remittance";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/transaction/$id")({
  component: TxDetail,
});

function TxDetail() {
  const { id } = useParams({ from: "/_authenticated/transaction/$id" });
  const q = useQuery({
    queryKey: ["tx", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">No se encontró la remesa.</p>;
  const t = q.data;

  return (
    <div className="space-y-5">
      <Link to="/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <div className="rounded-2xl border border-gold/40 bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Destinatario</p>
            <p className="truncate font-display text-xl font-bold text-destructive">{t.recipient_name}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {new Date(t.created_at).toLocaleString("es")}
            </p>
          </div>
          <StatusBadge status={t.status} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 text-sm">
        <Row k="Teléfono" v={t.recipient_phone} />
        <Row k="País" v={t.destination_country} />
        <Row k="Método de entrega" v={t.delivery_method} />
        {t.notes && <Row k="Dirección / notas" v={t.notes} />}
        <hr className="border-border" />
        <Row k="Monto enviado" v={formatBRL(Number(t.amount_brl))} />
        <Row k="Comisión" v={formatBRL(Number(t.fee_brl))} />
        <Row k="Total pagado" v={formatBRL(Number(t.total_brl))} strong />
        <hr className="border-border" />
        <Row k="Tasa" v={`1 BRL = ${Number(t.exchange_rate).toFixed(2)} ${t.dest_currency}`} />
        <Row k="Recibe" v={formatCurrency(Number(t.amount_dest), t.dest_currency)} strong />
        <Row k="Método de pago" v={t.payment_method.toUpperCase()} />
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="font-medium text-muted-foreground">{k}</span>
      <span className={strong ? "font-bold text-destructive" : "font-semibold"}>{v}</span>
    </div>
  );
}
