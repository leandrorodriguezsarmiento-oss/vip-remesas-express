import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatCurrency } from "@/lib/remittance";
import { StatusBadge } from "./dashboard";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";

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
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Tracking</p>
            <p className="font-display text-lg font-bold text-gold">{t.tracking_id}</p>
          </div>
          <StatusBadge status={t.status} />
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(t.tracking_id); toast.success("Copiado"); }}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold"
        >
          <Copy className="h-3 w-3" /> Copiar código
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 text-sm">
        <Row k="Destinatario" v={t.recipient_name} />
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
        <Row k="Fecha" v={new Date(t.created_at).toLocaleString("es")} />
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={strong ? "font-semibold text-gold" : ""}>{v}</span>
    </div>
  );
}
