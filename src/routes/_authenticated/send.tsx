import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ORIGINS, METHOD_CATEGORIES, CURRENCY_LABEL, formatMoney,
  findRate, calcQuote, generateTrackingId, generatePixCode, checkPixPayment,
  getOrigin, type OriginCode, type MethodCategory, type DestCurrency, type RateRow,
} from "@/lib/remittance";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/send")({
  component: SendFlow,
});

type Recipient = { name: string; phone: string; card: string; notes: string };
type Saved = {
  id: string; full_name: string; phone: string; account_details: string | null;
  delivery_method: string; country: string;
};

function SendFlow() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

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
    queryFn: async () => {
      const { data, error } = await supabase.from("rates").select("*").eq("active", true);
      if (error) throw error;
      return data as unknown as RateRow[];
    },
  });

  const savedRecipients = useQuery<Saved[]>({
    queryKey: ["recipients", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipients")
        .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Saved[];
    },
  });

  const rate = useMemo(
    () => origin && method && currency ? findRate(rates.data, origin, method, currency) : undefined,
    [rates.data, origin, method, currency],
  );

  const amountNum = Number(amount.replace(",", ".")) || 0;
  const quote = useMemo(() => (rate && amountNum > 0 ? calcQuote(amountNum, rate) : null), [rate, amountNum]);
  const originOpt = origin ? getOrigin(origin) : null;
  const minAmount = Number(rate?.min_amount ?? 20);
  const belowMin = amountNum > 0 && amountNum < minAmount;

  const availableCurrencies = useMemo(() => {
    if (!method) return [] as DestCurrency[];
    return METHOD_CATEGORIES.find((m) => m.id === method)!.currencies;
  }, [method]);

  async function createOrder() {
    if (!origin || !method || !currency || !rate || !quote || !originOpt) return;
    setLoading(true);
    try {
      const id = generateTrackingId();
      const pix = generatePixCode(id, amountNum);

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        tracking_id: id,
        origin_country: origin,
        origin_currency: originOpt.currency,
        destination_country: "Cuba",
        method_category: method,
        delivery_method: currency, // reutilizamos como sub-tipo
        recipient_name: recipient.name,
        recipient_phone: recipient.phone,
        recipient_card: recipient.card || null,
        notes: recipient.notes || null,
        amount_brl: amountNum,
        amount_dest: quote.amountDest,
        dest_currency: currency,
        exchange_rate: rate.rate,
        fee_brl: 0,
        total_brl: amountNum,
        payment_method: "pix",
        pix_code: pix,
        status: "pending",
      });
      if (error) throw error;

      if (saveRecipient && recipient.name) {
        await supabase.from("recipients").insert({
          user_id: user.id,
          full_name: recipient.name,
          phone: recipient.phone,
          country: "CU",
          delivery_method: `${method}·${currency}`,
          account_details: recipient.card || null,
        });
      }

      setTracking(id);
      setPixCode(pix);
      setStep(6);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la orden");
    } finally {
      setLoading(false);
    }
  }

  async function confirmPaid() {
    if (!tracking) return;
    setLoading(true);
    try {
      // 🔌 SLOT INTEGRACIÓN: aquí normalmente el webhook del proveedor PIX
      // marca el pago; usamos mock para demostración.
      const res = await checkPixPayment(tracking);
      if (!res.paid) throw new Error("Aún no vemos el pago");
      await supabase.from("transactions")
        .update({ status: "processing" })
        .eq("tracking_id", tracking);
      await queryClient.invalidateQueries({ queryKey: ["transactions-recent"] });
      toast.success("Pago recibido. Procesando tu remesa.");
      setStep(7);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {step < 6 && (
        <div className="flex items-center gap-2">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="rounded-md p-2 hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => navigate({ to: "/dashboard" })} className="rounded-md p-2 hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Paso {step} de 5</div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-gradient-gold transition-all" style={{ width: `${(step / 5) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Paso 1: origen */}
      {step === 1 && (
        <Step title="¿Desde dónde envías?" subtitle="Selecciona el país de origen">
          <div className="space-y-2">
            {ORIGINS.map((o) => (
              <button key={o.code}
                onClick={() => { setOrigin(o.code); setStep(2); }}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${origin === o.code ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
                <span className="text-3xl">{o.flag}</span>
                <div className="flex-1">
                  <div className="font-semibold">{o.name}</div>
                  <div className="text-xs text-muted-foreground">Envías en {o.currency} → recibes en Cuba</div>
                </div>
                <ArrowRight className="h-4 w-4 text-gold" />
              </button>
            ))}
          </div>
        </Step>
      )}

      {/* Paso 2: transferencia / efectivo */}
      {step === 2 && (
        <Step title="¿Cómo lo reciben?" subtitle="Transferencia o efectivo">
          <div className="space-y-2">
            {METHOD_CATEGORIES.map((m) => (
              <button key={m.id}
                onClick={() => { setMethod(m.id); setCurrency(null); setStep(3); }}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${method === m.id ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
                <div className="flex-1">
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">Monedas: {m.currencies.join(" · ")}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-gold" />
              </button>
            ))}
          </div>
        </Step>
      )}

      {/* Paso 3: moneda + calculadora */}
      {step === 3 && origin && method && originOpt && (
        <Step title="Elige moneda y monto" subtitle={`${originOpt.name} → Cuba · ${method === "transferencia" ? "Transferencia" : "Efectivo"}`}>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Moneda de destino</span>
            <div className="grid grid-cols-3 gap-2">
              {availableCurrencies.map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`rounded-xl border p-3 text-center text-sm font-semibold ${currency === c ? "border-gold bg-accent text-gold" : "border-border bg-card"}`}>
                  {c}
                </button>
              ))}
            </div>
            {currency && (
              <p className="mt-1 text-[11px] text-muted-foreground">{CURRENCY_LABEL[currency]}</p>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Envías ({originOpt.symbol}) · mínimo {originOpt.symbol}{minAmount}
            </span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
              className="w-full rounded-xl border border-border bg-background px-4 py-4 font-display text-2xl font-bold outline-none focus:border-gold" />
            {belowMin && <p className="mt-1 text-xs text-destructive">El mínimo es {originOpt.symbol}{minAmount}</p>}
          </label>

          {quote && rate && !belowMin && (
            <div className="rounded-xl border border-gold/40 bg-card p-4 space-y-2">
              <Row k="Recibe" v={formatMoney(quote.amountDest, currency!)} strong />
              <Row k="Tasa" v={`1 ${originOpt.currency} = ${rate.rate} ${currency}`} />
              <Row k="Tiempo estimado" v={quote.timeLabel} />
            </div>
          )}

          <NextBtn disabled={!currency || !quote || belowMin} onClick={() => setStep(4)}>
            Calcular y continuar
          </NextBtn>
        </Step>
      )}

      {/* Paso 4: destinatario */}
      {step === 4 && (
        <Step title="Datos del destinatario" subtitle="¿A quién le envías?">
          {savedRecipients.data && savedRecipients.data.length > 0 && (
            <div className="mb-2">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Guardados</span>
              <div className="flex flex-wrap gap-2">
                {savedRecipients.data.map((r) => (
                  <button key={r.id}
                    onClick={() => setRecipient({
                      name: r.full_name, phone: r.phone,
                      card: r.account_details ?? "", notes: "",
                    })}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-gold">
                    {r.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input label="Nombre completo" value={recipient.name} onChange={(v) => setRecipient({ ...recipient, name: v })} placeholder="María Pérez" />
          <Input label="Teléfono" value={recipient.phone} onChange={(v) => setRecipient({ ...recipient, phone: v })} placeholder="+53 55 000 000" />
          {method === "transferencia" && (
            <Input
              label={currency === "MLC" ? "Tarjeta MLC" : currency === "USD" ? "Cuenta USD clásica" : "Tarjeta CUP"}
              value={recipient.card}
              onChange={(v) => setRecipient({ ...recipient, card: v })}
              placeholder="XXXX XXXX XXXX XXXX" />
          )}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={saveRecipient} onChange={(e) => setSaveRecipient(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--gold)]" />
            Guardar destinatario para próximas remesas
          </label>
          <NextBtn
            disabled={!recipient.name || !recipient.phone || (method === "transferencia" && !recipient.card)}
            onClick={() => setStep(5)}
          >
            Continuar
          </NextBtn>
        </Step>
      )}

      {/* Paso 5: resumen + crear orden */}
      {step === 5 && originOpt && quote && rate && currency && method && (
        <Step title="Confirmar remesa" subtitle="Revisa antes de generar el pago">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
            <Row k="Destinatario" v={recipient.name} />
            <Row k="Teléfono" v={recipient.phone} />
            {recipient.card && <Row k="Tarjeta / Cuenta" v={recipient.card} />}
            <hr className="border-border" />
            <Row k="Origen" v={originOpt.name} />
            <Row k="Método" v={method === "transferencia" ? "Transferencia" : "Efectivo"} />
            <Row k="Moneda" v={currency} />
            <hr className="border-border" />
            <Row k="Envías" v={formatMoney(amountNum, originOpt.currency)} />
            <Row k="Tasa" v={`1 ${originOpt.currency} = ${rate.rate} ${currency}`} />
            <Row k="Tiempo" v={quote.timeLabel} />
            <Row k="Recibe" v={formatMoney(quote.amountDest, currency)} strong />
          </div>
          <button onClick={createOrder} disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-4 text-base font-semibold text-primary-foreground shadow-gold disabled:opacity-70">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Crear orden y pagar con PIX
          </button>
        </Step>
      )}

      {/* Paso 6: PIX */}
      {step === 6 && pixCode && tracking && originOpt && (
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Paga con PIX</h1>
            <p className="mt-1 text-sm text-muted-foreground">Copia el código y pégalo en tu app de banco.</p>
          </div>
          <div className="rounded-2xl border border-gold/40 bg-gradient-gold p-5 text-center shadow-gold">
            <p className="text-xs uppercase tracking-wider text-black/70">Total a pagar</p>
            <p className="mt-1 font-display text-3xl font-bold text-black">
              {formatMoney(amountNum, originOpt.currency)}
            </p>
            <p className="mt-1 text-[11px] text-black/70">Código: {tracking}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">PIX copia y pega</p>
            <p className="mt-1 break-all font-mono text-[11px] leading-relaxed">{pixCode}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(pixCode); toast.success("Código copiado"); }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:border-gold">
              <Copy className="h-4 w-4" /> Copiar código PIX
            </button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            🔌 Slot integración: cuando conectes tu API PIX real, el webhook confirmará el pago automáticamente.
          </p>
          <button onClick={confirmPaid} disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Ya pagué, verificar
          </button>
        </div>
      )}

      {/* Paso 7: éxito */}
      {step === 7 && tracking && (
        <div className="pt-6 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-gold shadow-gold">
            <Check className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">¡Enviado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu remesa está siendo procesada.</p>
          <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-gold/40 bg-card p-5">
            <p className="text-xs text-muted-foreground">Código de seguimiento</p>
            <p className="mt-1 font-display text-xl font-bold text-gold">{tracking}</p>
          </div>
          <div className="mt-6 space-y-2">
            <button onClick={() => navigate({ to: "/history" })}
              className="w-full rounded-xl bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold">
              Ver historial
            </button>
            <button onClick={() => navigate({ to: "/dashboard" })}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
    </label>
  );
}

function NextBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50">
      {children} <ArrowRight className="h-4 w-4" />
    </button>
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
