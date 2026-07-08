import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  COUNTRIES, calcQuote, formatBRL, formatCurrency, generateTrackingId,
  createPayment, PAYMENT_METHODS, type CountryCode, type PaymentMethodId,
} from "@/lib/remittance";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/send")({
  component: SendFlow,
});

function SendFlow() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [country, setCountry] = useState<CountryCode | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState({ name: "", phone: "", method: "" });
  const [payment, setPayment] = useState<PaymentMethodId | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);

  const amountNum = Number(amount.replace(",", ".")) || 0;
  const quote = useMemo(() => (country && amountNum > 0 ? calcQuote(amountNum, country) : null), [country, amountNum]);

  async function confirm() {
    if (!country || !quote || !payment) return;
    setLoading(true);
    try {
      // 🔌 SLOT DE INTEGRACIÓN: pasarela de pago real
      const id = generateTrackingId();
      const pay = await createPayment({ method: payment, totalBrl: quote.total, trackingId: id });
      if (!pay.ok) throw new Error("Pago rechazado");

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        tracking_id: id,
        destination_country: COUNTRIES.find((c) => c.code === country)!.name,
        recipient_name: recipient.name,
        recipient_phone: recipient.phone,
        delivery_method: recipient.method,
        amount_brl: amountNum,
        amount_dest: quote.amountDest,
        dest_currency: quote.currency,
        exchange_rate: quote.rate,
        fee_brl: quote.fee,
        total_brl: quote.total,
        payment_method: payment,
        status: "processing",
      });
      if (error) throw error;
      setTracking(id);
      setStep(7);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al procesar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {step < 7 && (
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
            <div className="text-xs text-muted-foreground">Paso {step} de 6</div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-gradient-gold transition-all" style={{ width: `${(step / 6) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <Step title="¿A dónde envías?" subtitle="Selecciona el país de destino">
          <div className="space-y-2">
            {COUNTRIES.map((c) => (
              <button key={c.code}
                onClick={() => { setCountry(c.code); setRecipient((r) => ({ ...r, method: "" })); setStep(2); }}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${country === c.code ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
                <span className="text-3xl">{c.flag}</span>
                <div className="flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Moneda: {c.currency}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-gold" />
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && country && (
        <Step title="Monto a enviar" subtitle={`Tasa: 1 BRL = ${quote?.rate.toFixed(2) ?? "..."} ${COUNTRIES.find(c => c.code === country)!.currency}`}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Envías (R$)</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
              className="w-full rounded-xl border border-border bg-background px-4 py-4 font-display text-2xl font-bold outline-none focus:border-gold" />
          </label>
          {quote && (
            <div className="mt-4 rounded-xl border border-gold/40 bg-card p-4">
              <div className="text-xs text-muted-foreground">Recibe</div>
              <div className="mt-1 font-display text-2xl font-bold text-gold">
                {formatCurrency(quote.amountDest, quote.currency)}
              </div>
            </div>
          )}
          <NextBtn disabled={amountNum <= 0} onClick={() => setStep(3)}>Continuar</NextBtn>
        </Step>
      )}

      {step === 3 && country && (
        <Step title="Datos del destinatario" subtitle="¿Quién recibe la remesa?">
          <Input label="Nombre completo" value={recipient.name} onChange={(v) => setRecipient({ ...recipient, name: v })} placeholder="María Pérez" />
          <Input label="Teléfono" value={recipient.phone} onChange={(v) => setRecipient({ ...recipient, phone: v })} placeholder="+53 55 000 000" />
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Método de entrega</span>
            <div className="space-y-2">
              {COUNTRIES.find(c => c.code === country)!.deliveryMethods.map((m) => (
                <button key={m} onClick={() => setRecipient({ ...recipient, method: m })}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm ${recipient.method === m ? "border-gold bg-accent" : "border-border bg-card"}`}>
                  {m} {recipient.method === m && <Check className="h-4 w-4 text-gold" />}
                </button>
              ))}
            </div>
          </div>
          <NextBtn disabled={!recipient.name || !recipient.phone || !recipient.method} onClick={() => setStep(4)}>Continuar</NextBtn>
        </Step>
      )}

      {step === 4 && quote && country && (
        <Step title="Resumen" subtitle="Revisa los detalles antes de continuar">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
            <Row k="Destinatario" v={recipient.name} />
            <Row k="País" v={COUNTRIES.find(c => c.code === country)!.name} />
            <Row k="Entrega" v={recipient.method} />
            <hr className="border-border" />
            <Row k="Envías" v={formatBRL(amountNum)} />
            <Row k="Comisión" v={formatBRL(quote.fee)} />
            <Row k="Tasa" v={`1 BRL = ${quote.rate.toFixed(2)} ${quote.currency}`} />
            <hr className="border-border" />
            <Row k="Total a pagar" v={formatBRL(quote.total)} strong />
            <Row k="Recibe" v={formatCurrency(quote.amountDest, quote.currency)} strong />
          </div>
          <NextBtn onClick={() => setStep(5)}>Elegir método de pago</NextBtn>
        </Step>
      )}

      {step === 5 && (
        <Step title="Método de pago" subtitle="¿Cómo prefieres pagar?">
          <div className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id} onClick={() => setPayment(m.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left ${payment === m.id ? "border-gold bg-accent" : "border-border bg-card"}`}>
                <div>
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
                {payment === m.id && <Check className="h-4 w-4 text-gold" />}
              </button>
            ))}
          </div>
          <NextBtn disabled={!payment} onClick={() => setStep(6)}>Continuar</NextBtn>
        </Step>
      )}

      {step === 6 && quote && (
        <Step title="Confirmar envío" subtitle="Un último paso">
          <div className="rounded-2xl border border-gold/40 bg-gradient-gold p-6 text-center shadow-gold">
            <p className="text-xs uppercase tracking-wider text-black/70">Total a pagar</p>
            <p className="mt-1 font-display text-4xl font-bold text-black">{formatBRL(quote.total)}</p>
          </div>
          <button onClick={confirm} disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-4 text-base font-semibold text-primary-foreground shadow-gold disabled:opacity-70">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Confirmar y enviar
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Pasarela de pagos en modo demostración. Sustituye <code>createPayment()</code> por Stripe/Mercado Pago.
          </p>
        </Step>
      )}

      {step === 7 && tracking && (
        <div className="pt-6 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-gold shadow-gold">
            <Check className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">¡Enviado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu remesa está en camino.</p>
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
