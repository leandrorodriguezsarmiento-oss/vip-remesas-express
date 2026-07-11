"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { Smartphone, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Promo = { id: string; title: string; description: string | null; price_brl: number; bonus_label: string | null; active: boolean };

export default function RecargasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const promos = useQuery<Promo[]>({
    queryKey: ["promos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promos").select("*").eq("active", true).order("price_brl");
      if (error) throw error; return data as unknown as Promo[];
    },
  });
  const [selected, setSelected] = useState<Promo | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function recharge() {
    if (!selected || !phone || !userId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("recargas_requests").insert({
        user_id: userId, phone, promo_id: selected.id, promo_title: selected.title,
        price_brl: selected.price_brl, status: "pending",
      });
      if (error) throw error;
      toast.success(`Solicitud enviada. El admin procesará la recarga a ${phone}.`);
      setSelected(null); setPhone("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold">Recargas Cubacel</h1><p className="mt-1 text-sm text-muted-foreground">Promos vigentes desde BR, EU, US.</p></div>
      <div className="space-y-2">
        {promos.data?.map((p) => (
          <button key={p.id} onClick={() => setSelected(p)}
            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${selected?.id === p.id ? "border-gold bg-accent" : "border-border bg-card"}`}>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-gold shadow-gold"><Smartphone className="h-6 w-6 text-primary-foreground" /></div>
            <div className="flex-1">
              <div className="font-semibold">{p.title}</div>
              {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
              {p.bonus_label && <div className="mt-1 text-[11px] font-medium text-gold">{p.bonus_label}</div>}
            </div>
            <div className="text-right"><div className="font-display text-lg font-bold text-gold">{formatMoney(Number(p.price_brl), "BRL")}</div></div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="rounded-2xl border border-gold/40 bg-card p-4 space-y-3">
          <div><div className="text-xs text-muted-foreground">Seleccionado</div><div className="font-display text-lg font-bold">{selected.title}</div></div>
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
        </div>
      )}
    </div>
  );
}
