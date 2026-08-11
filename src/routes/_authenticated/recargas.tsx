import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { createRechargeRequest } from "@/lib/orders.functions";
import { createRechargePreference } from "@/lib/recharge-payments.functions";
import { StatusBadge } from "@/components/StatusBadge";
import { Smartphone, Loader2, Sparkles, CreditCard } from "lucide-react";
import { toast } from "sonner";
import cubacelLogo from "@/assets/cubacel.png";
import promoGift from "@/assets/promo-gift.png";

export const Route = createFileRoute("/_authenticated/recargas")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (data) throw redirect({ to: "/admin" });
  },
  component: Recargas,
  head: () => ({
    meta: [
      { title: "Recargas Cubacel a Cuba | VIP Remesas" },
      { name: "description", content: "Recarga saldo Cubacel desde Brasil, México, EE.UU. y Europa con promociones vigentes." },
      { property: "og:title", content: "Recargas Cubacel a Cuba | VIP Remesas" },
      { property: "og:description", content: "Recarga Cubacel con promociones vigentes desde 4 países." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  const qc = useQueryClient();
  const promos = useQuery<Promo[]>({
    queryKey: ["promos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promos")
        .select("*").eq("active", true).order("price_brl");
      if (error) throw error;
      return data as unknown as Promo[];
    },
  });

  const mine = useQuery({
    queryKey: ["recargas-mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recargas_requests")
        .select("*").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const [selected, setSelected] = useState<Promo | null>(null);
  const [digits, setDigits] = useState("");
  const phone = digits ? `+53${digits}` : "";
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const submitRecharge = useServerFn(createRechargeRequest);
  const payRecharge = useServerFn(createRechargePreference);

  async function recharge() {
    if (!selected || digits.length !== 8) {
      toast.error("El teléfono de Cuba debe tener 8 dígitos");
      return;
    }
    setLoading(true);
    try {
      // Server function looks up the authoritative promo (title/price) so a
      // manipulated client cannot claim a cheaper price than what admin sees.
      const r = await submitRecharge({ data: { promoId: selected.id, phone } });
      setLastId(r.id);
      toast.success(`Recarga registrada. Paga y te avisamos al completarla (${phone}).`);
      setDigits("");
      await qc.invalidateQueries({ queryKey: ["recargas-mine"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function payWithMercadoPago() {
    if (!lastId) return;
    setPaying(true);
    try {
      const { checkoutUrl } = await payRecharge({ data: { rechargeId: lastId } });
      if (!checkoutUrl) throw new Error("No se pudo abrir el pago");
      window.location.href = checkoutUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al abrir Mercado Pago");
    } finally {
      setPaying(false);
    }
  }

  const active = mine.data?.filter((r) => r.status === "pending" || r.status === "processing") ?? [];




  return (
    <div className="space-y-5">
      <div className="animate-rise flex items-center gap-3">
        <img src={cubacelLogo} alt="Cubacel / ETECSA" width={512} height={512} loading="lazy"
          className="h-14 w-14 shrink-0 animate-float rounded-xl bg-white p-1 object-contain shadow-glow" />

        <div>
          <h1 className="font-display text-2xl font-extrabold">Recargas Cubacel</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Promos vigentes desde Brasil, México, Europa y EE.UU.</p>
        </div>
      </div>

      {active.length > 0 && (
        <section className="animate-rise rounded-2xl border border-gold/40 bg-card p-4 shadow-glow">
          <h2 className="mb-2 font-display text-sm font-bold">Tus recargas en proceso</h2>
          <ul className="space-y-2">
            {active.map((r) => (
              <li key={r.id} className="animate-slide-left flex items-center gap-2 rounded-lg border border-border bg-background/60 p-3">
                <Smartphone className="h-4 w-4 shrink-0 animate-wiggle text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {r.promo_title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.phone}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}



      {promos.isLoading && <p className="text-sm text-muted-foreground">Cargando promociones…</p>}
      {promos.data && promos.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No hay promociones activas en este momento.
        </div>
      )}

      <div className="space-y-2">
        {promos.data?.map((p, i) => (
          <button key={p.id} onClick={() => setSelected(p)} style={{ animationDelay: `${i * 60}ms` }}
            className={`animate-rise flex w-full items-center gap-3 active:scale-[0.98] rounded-xl border p-4 text-left transition ${selected?.id === p.id ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
            <div className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-gold shadow-gold ${selected?.id === p.id ? "animate-ring" : "animate-float"}`}>
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
        <div className="animate-pop rounded-2xl border border-gold/40 bg-card p-4 space-y-3 shadow-glow">
          <div>
            <div className="text-xs text-muted-foreground">Recarga seleccionada</div>
            <div className="font-display text-lg font-bold">{selected.title}</div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase text-muted-foreground">Teléfono Cubacel</span>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-3 focus-within:border-gold">
              <span className="shrink-0 text-sm font-extrabold text-gold">+53</span>
              <input
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                placeholder="56530329"
                className="w-full bg-transparent text-sm font-extrabold outline-none" />
            </div>
            <span className="mt-1 block text-[11px] font-bold text-muted-foreground">
              Solo 8 dígitos (sin el +53). {digits.length}/8
            </span>
          </label>
          <button onClick={recharge} disabled={loading || digits.length !== 8}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition-transform active:scale-95 animate-glow-pulse disabled:opacity-60 disabled:animate-none">
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
