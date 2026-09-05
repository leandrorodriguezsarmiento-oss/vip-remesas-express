import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ORIGINS, METHOD_CATEGORIES, CURRENCY_LABEL, formatMoney,
  findRate, calcQuote,
  getOrigin, type OriginCode, type MethodCategory, type DestCurrency, type RateRow,
} from "@/lib/remittance";
import { createTransaction, markTransactionPaid } from "@/lib/orders.functions";
import { createMercadoPagoPreference } from "@/lib/payments.functions";
import { PixQrCode } from "@/components/PixQrCode";
import { FlagIcon } from "@/components/FlagIcon";
import bgCash from "@/assets/bg-cash.jpg";
import bgCard from "@/assets/bg-card.jpg";

import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Copy, CreditCard, Loader2, Plane, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/send")({
  component: SendFlow,
});

/** Sólo letras y espacios para nombres. */
function onlyLettersName(v: string): string {
  return v.replace(/[^a-zA-ZÀ-ÿ' ]/g, "").slice(0, 60);
}

/** Teléfono de Cuba: +53 fijo + exactamente 8 dígitos. */
function formatCubaPhone(v: string): string {
  const digits = v.replace(/\D/g, "").replace(/^53/, "").slice(0, 8);
  return `+53 ${digits}`.trimEnd();
}

/** Tarjeta/cuenta: máximo 16 dígitos en grupos de 4. */
function formatCard(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(.{4})(?=.)/g, "$1 ");
}

type Recipient = { name: string; phone: string; card: string; address: string; notes: string };
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
  const createTx = useServerFn(createTransaction);
  const createMpPreference = useServerFn(createMercadoPagoPreference);
  const markPaid = useServerFn(markTransactionPaid);


  const [origin, setOrigin] = useState<OriginCode | null>(null);
  const [method, setMethod] = useState<MethodCategory | null>(null);
  const [currency, setCurrency] = useState<DestCurrency | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState<Recipient>({ name: "", phone: "", card: "", address: "", notes: "" });
  const [saveRecipient, setSaveRecipient] = useState(true);
  const [tracking, setTracking] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [mpLoading, setMpLoading] = useState(false);


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

  const paymentMethods = useQuery({
    queryKey: ["payment-methods", origin],
    enabled: !!origin,
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods")
        .select("*").eq("active", true).eq("origin_country", origin!).order("sort_order");
      if (error) throw error;
      return data;
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

  /** Número de VIP Remesas que recibe las órdenes de MX / EE.UU. / Europa. */
  const WHATSAPP_NUMBER = "5595981006775";

  function openWhatsApp(trackingId: string) {
    if (!origin || !originOpt || !method || !currency || !quote || !rate) return;
    const lines = [
      "*Nueva orden VIP Remesas*",
      `Código: ${trackingId}`,
      `Cliente: ${user.email ?? user.id}`,
      "",
      `Origen: ${originOpt.name} (${originOpt.currency})`,
      `Método: ${method === "transferencia" ? "Transferencia" : "Efectivo"}`,
      `Moneda destino: ${currency}`,
      `Envía: ${formatMoney(amountNum, originOpt.currency)}`,
      `Tasa: 1 ${originOpt.currency} = ${rate.rate} ${currency}`,
      `Recibe: ${formatMoney(quote.amountDest, currency)}`,
      "",
      `Destinatario: ${recipient.name}`,
      `Teléfono: ${recipient.phone}`,
      recipient.card ? `Tarjeta / Cuenta: ${recipient.card}` : null,
      recipient.address ? `Dirección de entrega: ${recipient.address}` : null,
      recipient.notes ? `Notas: ${recipient.notes}` : null,
    ].filter(Boolean);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function createOrder() {

    if (!origin || !method || !currency || !rate || !quote || !originOpt) return;
    setLoading(true);
    try {
      // Server function recomputes amount/rate/fee from the authoritative
      // `rates` table and returns the tracking id + PIX code. Client-supplied
      // financial numbers are never trusted for storage.
      const res = await createTx({
        data: {
          origin,
          method,
          currency,
          amount: amountNum,
          recipient: {
            name: recipient.name,
            phone: recipient.phone,
            card: recipient.card || null,
            address: recipient.address || null,
            notes: recipient.notes || null,
          },
        },
      });

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

      setTracking(res.trackingId);
      setPixCode(res.pixCode);
      setTxId(res.transactionId);
      setStep(6);
      if (origin !== "BR") openWhatsApp(res.trackingId);



    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la orden");
    } finally {
      setLoading(false);
    }
  }

  async function payWithMercadoPago() {
    if (!txId) return;
    setMpLoading(true);
    try {
      // El monto se recalcula en el servidor desde la fila de `transactions`.
      const res = await createMpPreference({ data: { transactionId: txId } });
      // Solo permitimos abrir dominios oficiales de Mercado Pago por HTTPS.
      const url = new URL(res.checkoutUrl);
      const okHost =
        url.protocol === "https:" &&
        /(^|\.)mercadopago\.com(\.[a-z]{2})?$|(^|\.)mercadolibre\.com(\.[a-z]{2})?$/.test(url.hostname);
      if (!okHost) throw new Error("Enlace de pago no válido");
      window.location.href = url.toString();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir Mercado Pago");
      setMpLoading(false);
    }
  }




  async function confirmPaid() {
    if (!tracking) return;
    setLoading(true);
    try {
      // El servidor registra el momento del pago y avisa al panel admin.
      await markPaid({ data: { trackingId: tracking } });
      await queryClient.invalidateQueries({ queryKey: ["transactions-recent"] });
      toast.success("Pago informado. Procesando tu remesa.");
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
              <div className="h-full bg-gradient-gold transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Paso 1: origen */}
      {step === 1 && (
        <Step title="¿Desde dónde envías?" subtitle="Selecciona el país de origen">
          <div className="space-y-2">
            {ORIGINS.map((o, i) => (
              <button key={o.code} style={{ animationDelay: `${i * 70}ms` }}
                onClick={() => { setOrigin(o.code); setStep(2); }}
                className={`animate-rise relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-4 text-left transition active:scale-[0.98] ${origin === o.code ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
                {/* Banderas de fondo: origen → Cuba */}
                <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-end gap-2 pr-3 opacity-20 select-none">
                  <FlagIcon code={o.code} className="h-14 w-20" />
                  <FlagIcon code="CU" className="h-14 w-20" />
                </span>
                <FlagIcon code={o.code} className="relative h-7 w-10 animate-float" />
                <div className="relative flex-1">
                  <div className="text-base font-extrabold">{o.name} → Cuba</div>
                  <div className="text-xs font-semibold text-muted-foreground">Envías en {o.currency} → recibes en Cuba</div>
                </div>
                <ArrowRight className="relative h-4 w-4 text-gold" />
              </button>
            ))}
          </div>
        </Step>
      )}

      {/* Paso 2: transferencia / efectivo */}
      {step === 2 && (
        <Step title="¿Cómo lo reciben?" subtitle="Transferencia o efectivo">
          <div className="space-y-2">
            {METHOD_CATEGORIES.map((m, i) => (
              <button key={m.id} style={{ animationDelay: `${i * 90}ms` }}
                onClick={() => { setMethod(m.id); setCurrency(null); setStep(3); }}
                className={`animate-rise group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-4 text-left transition active:scale-[0.98] ${method === m.id ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
                <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
                  <img src={m.id === "efectivo" ? bgCash : bgCard} alt="" loading="lazy" width={1200} height={640}
                    className="h-full w-full animate-zoom-bg object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute inset-0 bg-gradient-to-r from-card/90 via-card/55 to-card/10" />
                </span>
                <div className="relative flex-1">
                  <div className="text-base font-extrabold">{m.label}</div>
                  <div className="text-xs font-semibold text-muted-foreground">{m.description}</div>
                  <div className="mt-1 text-[10px] font-bold text-muted-foreground">Monedas: {m.currencies.join(" · ")}</div>
                </div>
                <ArrowRight className="relative h-4 w-4 text-gold" />
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
              {availableCurrencies.map((c, i) => (
                <button key={c} onClick={() => setCurrency(c)} style={{ animationDelay: `${i * 60}ms` }}
                  className={`animate-pop rounded-xl border p-3 transition active:scale-95 text-center text-sm font-semibold ${currency === c ? "border-gold bg-accent text-gold" : "border-border bg-card"}`}>
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
            <div className="animate-pop rounded-xl border border-gold/40 bg-card p-4 space-y-2 shadow-glow">
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
                      name: r.full_name, phone: formatCubaPhone(r.phone),
                      card: formatCard(r.account_details ?? ""), address: "", notes: "",
                    })}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-gold">
                    {r.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input label="Nombre completo" value={recipient.name} onChange={(v) => setRecipient({ ...recipient, name: onlyLettersName(v) })} placeholder="María Pérez" />
          <Input label="Teléfono en Cuba" value={recipient.phone} onChange={(v) => setRecipient({ ...recipient, phone: formatCubaPhone(v) })} placeholder="+53 56530329" />
          {method === "transferencia" && (
            <Input
              label={currency === "MLC" ? "Tarjeta MLC (16 dígitos)" : currency === "USD" ? "Cuenta USD clásica (16 dígitos)" : "Tarjeta CUP (16 dígitos)"}
              value={recipient.card}
              onChange={(v) => setRecipient({ ...recipient, card: formatCard(v) })}
              placeholder="XXXX XXXX XXXX XXXX" />
          )}
          {method === "efectivo" && (
            <Input
              label="Dirección de entrega"
              value={recipient.address}
              onChange={(v) => setRecipient({ ...recipient, address: v })}
              placeholder="Calle, número, entre calles, municipio, provincia" />
          )}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={saveRecipient} onChange={(e) => setSaveRecipient(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--gold)]" />
            Guardar destinatario para próximas remesas
          </label>
          <NextBtn
            disabled={!recipient.name || recipient.phone.replace(/\D/g, "").length !== 10 || (method === "transferencia" && recipient.card.replace(/\D/g, "").length !== 16) || (method === "efectivo" && recipient.address.trim().length < 8)}
            onClick={() => setStep(5)}
          >
            Continuar
          </NextBtn>
        </Step>
      )}

      {/* Paso 5: resumen + crear orden */}
      {step === 5 && originOpt && quote && rate && currency && method && (
        <Step title="Confirmar remesa" subtitle="Revisa antes de generar el pago">
          <div className="animate-rise rounded-xl border border-border bg-card p-4 space-y-2 text-sm shadow-card">
            <Row k="Destinatario" v={recipient.name} />
            <Row k="Teléfono" v={recipient.phone} />
            {recipient.card && <Row k="Tarjeta / Cuenta" v={recipient.card} />}
            {recipient.address && <Row k="Dirección" v={recipient.address} />}
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
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-4 text-base font-semibold text-primary-foreground shadow-gold transition-transform active:scale-95 animate-glow-pulse disabled:opacity-70 disabled:animate-none">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {origin === "BR" ? "Crear orden y pagar con PIX" : "Crear orden y enviar por WhatsApp"}
          </button>

        </Step>
      )}

      {/* Paso 6: pago */}
      {step === 6 && tracking && originOpt && (
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-2xl font-bold">
              {origin === "BR" ? "Paga con PIX" : "Datos para transferir"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {origin === "BR"
                ? "Copia el código y pégalo en tu app de banco — el monto ya viene incluido."
                : "Transfiere el total exacto usando estos datos. Pon tu código de seguimiento como concepto."}
            </p>
          </div>
          <div className="rounded-2xl border border-gold/40 bg-gradient-gold p-5 text-center shadow-gold">
            <p className="text-xs uppercase tracking-wider text-black/70">Total a pagar</p>
            <p className="mt-1 font-display text-3xl font-bold text-black">
              {formatMoney(amountNum, originOpt.currency)}
            </p>
            
          </div>

          {origin === "BR" && txId && (
            <button
              onClick={payWithMercadoPago}
              disabled={mpLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-70">
              {mpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pagar con Mercado Pago
            </button>
          )}



          {origin === "BR" && pixCode && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Escanea el QR con tu app del banco</p>
              <div className="mt-3">
                <PixQrCode value={pixCode} fileName={`pix-${tracking}.png`} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">PIX copia y pega (monto incluido)</p>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed">{pixCode}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(pixCode); toast.success("Código copiado"); }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:border-gold">
                <Copy className="h-4 w-4" /> Copiar código PIX
              </button>
            </div>
          )}

          {origin !== "BR" && (
            <div className="space-y-2">
              {paymentMethods.isLoading && <p className="text-sm text-muted-foreground">Cargando datos…</p>}
              {paymentMethods.data && paymentMethods.data.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
                  Aún no hay métodos de pago configurados para este origen. El admin debe añadirlos.
                </div>
              )}
              {paymentMethods.data?.map((pm) => (
                <div key={pm.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gold">{pm.label}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(pm.instructions); toast.success("Datos copiados"); }}
                      className="rounded-md p-1 hover:bg-accent">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
{pm.instructions}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {origin !== "BR" && tracking && (
            <button
              onClick={() => openWhatsApp(tracking)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground">
              <Sparkles className="h-4 w-4" /> Enviar datos por WhatsApp
            </button>
          )}


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
          <div className="animate-pop animate-ring mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-gold shadow-gold">
            <Check className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="animate-rise font-display text-3xl font-bold text-gradient-gold">¡Enviado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu remesa está siendo procesada.</p>

          {/* Vuelo origen → Cuba */}
          <div className="relative mx-auto mt-5 flex w-64 items-center justify-between">
            <FlagIcon code={origin ?? "BR"} className="relative z-10 h-7 w-10 rounded" />
            <svg viewBox="0 0 240 40" className="pointer-events-none absolute inset-x-0 top-1/2 h-10 w-full -translate-y-1/2" aria-hidden>
              <path d="M14 28 C 70 -6, 170 -6, 226 28" fill="none" stroke="currentColor" className="animate-dash text-gold"
                strokeWidth="2" strokeLinecap="round" strokeDasharray="4 6" />
            </svg>
            <FlagIcon code="CU" className="relative z-10 h-7 w-10 rounded" />
            <span className="animate-fly absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Plane className="h-6 w-6 text-gold" />
            </span>
          </div>
          <div className="animate-rise mx-auto mt-6 max-w-xs rounded-2xl border border-gold/40 bg-card p-5 shadow-glow">
            <p className="text-sm font-bold text-foreground">Estado: en proceso</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Te avisamos por notificación cuando esté completada.
            </p>
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
    <div className="animate-rise space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-gradient-gold">{title}</h1>
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
