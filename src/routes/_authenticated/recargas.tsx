import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { createRechargeRequest } from "@/lib/orders.functions";
import { Smartphone, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recargas")({
  component: Recargas,
});

type Promo = {
  id: string;
  title: string;
  description: string | null;
  price_brl: number;
  bonus_label: string | null;
  image_url: string | null;
  active: boolean;
};

function Recargas() {
  const _ctx = Route.useRouteContext();
  void _ctx;
  const promos = useQuery<Promo[]>({
    queryKey: ["promos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promos")
        .select("*").eq("active", true).order("price_brl");
      if (error) throw error;
      return data as unknown as Promo[];
    },
  });

  const [selected, setSelected] = useState<Promo | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const submitRecharge = useServerFn(createRechargeRequest);

  async function recharge() {
    if (!selected || !phone) return;
    setLoading(true);
    try {
      // Server function looks up the authoritative promo (title/price) so a
      // manipulated client cannot claim a cheaper price than what admin sees.
      await submitRecharge({ data: { promoId: selected.id, phone } });
      toast.success(`Solicitud enviada. El admin procesará la recarga a ${phone}.`);
      setSelected(null);
      setPhone("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Recargas Cubacel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Promos vigentes desde Brasil, Europa y EE.UU.</p>
      </div>

      {promos.isLoading && <p className="text-sm text-muted-foreground">Cargando promociones…</p>}
      {promos.data && promos.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No hay promociones activas en este momento.
        </div>
      )}

      <div className="space-y-2">
        {promos.data?.map((p) => (
          <button key={p.id} onClick={() => setSelected(p)}
            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${selected?.id === p.id ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-gold shadow-gold">
              <Smartphone className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{p.title}</div>
              {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
              {p.bonus_label && <div className="mt-1 text-[11px] font-medium text-gold">{p.bonus_label}</div>}
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold text-gold">{formatMoney(Number(p.price_brl), "BRL")}</div>
              <div className="text-[10px] text-muted-foreground">o equivalente</div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-2xl border border-gold/40 bg-card p-4 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Recarga seleccionada</div>
            <div className="font-display text-lg font-bold">{selected.title}</div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Teléfono Cubacel</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+53 5X XXX XXX"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
          </label>
          <button onClick={recharge} disabled={loading || !phone}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Recargar por {formatMoney(Number(selected.price_brl), "BRL")}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            🔌 Conectaremos la API real de Cubacel desde el panel admin.
          </p>
        </div>
      )}
    </div>
  );
}
