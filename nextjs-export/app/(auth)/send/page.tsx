"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
  ORIGINS, METHOD_CATEGORIES, CURRENCY_LABEL, formatMoney,
  findRate, calcQuote, checkPixPayment, getOrigin,
  type OriginCode, type MethodCategory, type DestCurrency, type RateRow,
} from "@/lib/remittance";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Sparkles } from "lucide-react";

type Recipient = { name: string; phone: string; card: string; notes: string };

export default function SendPage() {
  const router = useRouter(); const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const [step, setStep] = useState(1); const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState<OriginCode | null>(null);
  const [method, setMethod] = useState<MethodCategory | null>(null);
  const [currency, setCurrency] = useState<DestCurrency | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState<Recipient>({ name: "", phone: "", card: "", notes: "" });
  const [saveRecipient, setSaveRecipient] = useState(true);
  const [tracking, setTracking] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);

  const rates = useQuery<RateRow[]>({
    queryKey: ["rates"],
    queryFn: async () => { const { data, error } = await supabase.from("rates").select("*").eq("active", true); if (error) throw error; return data as unknown as RateRow[]; },
  });
  const paymentMethods = useQuery({
    queryKey: ["payment-methods", origin], enabled: !!origin,
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("*").eq("active", true).eq("origin_country", origin!).order("sort_order");
      if (error) throw error; return data;
    },
  });

  const rate = useMemo(() => (origin && method && currency ? findRate(rates.data, origin, method, currency) : undefined), [rates.data, origin, method, currency]);
  const amountNum = Number(amount.replace(",", ".")) || 0;
  const quote = useMemo(() => (rate && amountNum > 0 ? calcQuote(amountNum, rate) : null), [rate, amountNum]);
  const originOpt = origin ? getOrigin(origin) : null;
  const minAmount = Number(rate?.min_amount ?? 20);
  const belowMin = amountNum > 0 && amountNum < minAmount;
  const availableCurrencies = useMemo(() => (method ? METHOD_CATEGORIES.find((m) => m.id === method)!.currencies : []), [method]);

  async function createOrder() {
    if (!userId || !origin || !method || !currency || !rate || !quote || !originOpt) return;
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin, method, currency, amount: amountNum,
          recipient: {
            name: recipient.name, phone: recipient.phone,
            card: recipient.card || null, notes: recipient.notes || null,
          },
          saveRecipient,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setTracking(json.trackingId); setPixCode(json.pixCode); setStep(6);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); } finally { setLoading(false); }
  }
  async function confirmPaid() {
    if (!tracking) return;
    setLoading(true);
    try {
      const check = await checkPixPayment(tracking);
      if (!check.paid) throw new Error("Aún no vemos el pago");
      const res = await fetch("/api/transactions/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId: tracking }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      qc.invalidateQueries({ queryKey: ["transactions-recent"] });
      toast.success("Pago recibido"); setStep(7);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      {step < 6 && (
        <div className="flex items-center gap-2">
          <button onClick={() => (step > 1 ? setStep(step - 1) : router.push("/dashboard"))} className="rounded-md p-2 hover:bg-accent"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Paso {step} de 5</div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full bg-gradient-gold" style={{ width: `${(step / 5) * 100}%` }} /></div>
          </div>
        </div>
      )}

      {step === 1 && (
        <Step title="¿Desde dónde envías?">
          <div className="space-y-2">
            {ORIGINS.map((o) => (
              <button key={o.code} onClick={() => { setOrigin(o.code); setStep(2); }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left">
                <span className="text-3xl">{o.flag}</span>
                <div className="flex-1"><div className="font-semibold">{o.name}</div><div className="text-xs text-muted-foreground">Envías en {o.currency}</div></div>
                <ArrowRight className="h-4 w-4 text-gold" />
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step title="¿Cómo lo reciben?">
          <div className="space-y-2">
            {METHOD_CATEGORIES.map((m) => (
              <button key={m.id} onClick={() => { setMethod(m.id); setCurrency(null); setStep(3); }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left">
                <div className="flex-1"><div className="font-semibold">{m.label}</div><div className="text-xs text-muted-foreground">{m.description}</div></div>
                <ArrowRight className="h-4 w-4 text-gold" />
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 3 && origin && method && originOpt && (
        <Step title="Moneda y monto" subtitle={`${originOpt.name} → Cuba`}>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Moneda destino</span>
            <div className="grid grid-cols-3 gap-2">
              {availableCurrencies.map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`rounded-xl border p-3 text-center text-sm font-semibold ${currency === c ? "border-gold bg-accent text-gold" : "border-border bg-card"}`}>{c}</button>
              ))}
            </div>
            {currency && <p className="mt-1 text-[11px] text-muted-foreground">{CURRENCY_LABEL[currency]}</p>}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Envías ({originOpt.symbol}) · mínimo {originOpt.symbol}{minAmount}</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
              className="w-full rounded-xl border border-border bg-background px-4 py-4 font-display text-2xl font-bold outline-none focus:border-gold" />
            {belowMin && <p className="mt-1 text-xs text-destructive">Mínimo {originOpt.symbol}{minAmount}</p>}
          </label>
          {quote && rate && !belowMin && (
            <div className="rounded-xl border border-gold/40 bg-card p-4 space-y-2">
              <Row k="Recibe" v={formatMoney(quote.amountDest, currency!)} strong />
              <Row k="Tasa" v={`1 ${originOpt.currency} = ${rate.rate} ${currency}`} />
              <Row k="Tiempo" v={quote.timeLabel} />
            </div>
          )}
          <NextBtn disabled={!currency || !quote || belowMin} onClick={() => setStep(4)}>Continuar</NextBtn>
        </Step>
      )}

      {step === 4 && (
        <Step title="Destinatario">
          <Input label="Nombre" value={recipient.name} onChange={(v) => setRecipient({ ...recipient, name: v })} />
          <Input label="Teléfono" value={recipient.phone} onChange={(v) => setRecipient({ ...recipient, phone: v })} />
          {method === "transferencia" && <Input label={currency === "MLC" ? "Tarjeta MLC" : currency === "USD" ? "Cuenta USD" : "Tarjeta CUP"}
            value={recipient.card} onChange={(v) => setRecipient({ ...recipient, card: v })} />}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={saveRecipient} onChange={(e) => setSaveRecipient(e.target.checked)} className="h-4 w-4" />
            Guardar para próximas remesas
          </label>
          <NextBtn disabled={!recipient.name || !recipient.phone || (method === "transferencia" && !recipient.card)} onClick={() => setStep(5)}>Continuar</NextBtn>
        </Step>
      )}

      {step === 5 && originOpt && quote && rate && currency && method && (
        <Step title="Confirmar remesa">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
            <Row k="Destinatario" v={recipient.name} />
            <Row k="Teléfono" v={recipient.phone} />
            {recipient.card && <Row k="Cuenta" v={recipient.card} />}
            <hr /><Row k="Origen" v={originOpt.name} />
            <Row k="Moneda" v={currency} />
            <hr /><Row k="Envías" v={formatMoney(amountNum, originOpt.currency)} />
            <Row k="Recibe" v={formatMoney(quote.amountDest, currency)} strong />
          </div>
          <button onClick={createOrder} disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-4 text-base font-semibold text-primary-foreground shadow-gold disabled:opacity-70">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Crear orden
          </button>
        </Step>
      )}

      {step === 6 && tracking && originOpt && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold">{origin === "BR" ? "Paga con PIX" : "Datos para transferir"}</h1>
          <div className="rounded-2xl border border-gold/40 bg-gradient-gold p-5 text-center shadow-gold">
            <p className="text-xs uppercase text-black/70">Total</p>
            <p className="mt-1 font-display text-3xl font-bold text-black">{formatMoney(amountNum, originOpt.currency)}</p>
            <p className="mt-1 text-[11px] text-black/70">{tracking}</p>
          </div>
          {origin === "BR" && pixCode && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">PIX copia y pega</p>
              <p className="mt-1 break-all font-mono text-[11px]">{pixCode}</p>
              <button onClick={() => { navigator.clipboard.writeText(pixCode); toast.success("Copiado"); }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm">
                <Copy className="h-4 w-4" /> Copiar
              </button>
            </div>
          )}
          {origin !== "BR" && paymentMethods.data?.map((pm) => (
            <div key={pm.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gold">{pm.label}</p>
                <button onClick={() => { navigator.clipboard.writeText(pm.instructions); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{pm.instructions}</pre>
            </div>
          ))}
          <button onClick={confirmPaid} disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ya pagué, verificar
          </button>
        </div>
      )}

      {step === 7 && tracking && (
        <div className="pt-6 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-gold shadow-gold"><Check className="h-10 w-10 text-primary-foreground" /></div>
          <h1 className="font-display text-3xl font-bold">¡Enviado!</h1>
          <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-gold/40 bg-card p-5">
            <p className="text-xs text-muted-foreground">Tracking</p>
            <p className="mt-1 font-display text-xl font-bold text-gold">{tracking}</p>
          </div>
          <div className="mt-6 space-y-2">
            <button onClick={() => router.push("/history")} className="w-full rounded-xl bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold">Ver historial</button>
            <button onClick={() => router.push("/dashboard")} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">Inicio</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <div className="space-y-4"><div><h1 className="font-display text-2xl font-bold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>{children}</div>;
}
function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
    <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" /></label>;
}
function NextBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50">{children} <ArrowRight className="h-4 w-4" /></button>;
}
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className={strong ? "font-semibold text-gold" : ""}>{v}</span></div>;
}
