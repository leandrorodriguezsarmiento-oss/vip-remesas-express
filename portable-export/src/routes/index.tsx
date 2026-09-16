import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
});

type RateRow = {
  origin_country: string;
  origin_currency: string;
  method_category: string;
  dest_currency: string;
  rate: number;
  active: boolean;
};

const QUICK_AMOUNTS = [100, 250, 500];
const WHATSAPP_NUMBER = "5595981006775";

function Landing() {
  const rates = useQuery<RateRow[]>({
    queryKey: ["public-quick-remittance-rate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rates")
        .select("origin_country, origin_currency, method_category, dest_currency, rate, active")
        .eq("origin_country", "BR")
        .eq("origin_currency", "BRL")
        .eq("method_category", "transferencia")
        .eq("dest_currency", "CUP")
        .eq("active", true)
        .limit(1);
      if (error) throw error;
      return (data ?? []) as RateRow[];
    },
    staleTime: 30_000,
  });

  const currentRate = Number(rates.data?.[0]?.rate ?? 0);
  const formatCUP = (value: number) =>
    new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const quickOfferLink = (amount: number) => {
    const cup = amount * currentRate;
    const message = [
      "Hola VIP Remesas 👋",
      "Quiero solicitar una REMESA RÁPIDA.",
      `💰 Envío: R$${amount}`,
      `🇨🇺 Recibe aproximadamente: ${formatCUP(cup)} CUP`,
      `💱 Tasa mostrada: 1 BRL = ${currentRate.toFixed(2)} CUP`,
      "Quiero continuar con esta oferta.",
    ].join("\n");
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  return (
    <main className="min-h-screen bg-[#0B1B3A] px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3">
          <img src="/icon-192-v8.png" alt="VIP Remesas" width={56} height={56} className="h-14 w-14 rounded-2xl" />
          <div>
            <div className="text-xl font-bold">VIP Remesas</div>
            <div className="text-xs font-semibold tracking-[0.25em] text-[#E7C766]">ENVÍA COMO VIP</div>
          </div>
        </div>

        <section className="mt-12">
          <p className="text-sm font-bold uppercase tracking-wider text-[#E7C766]">VIP Remesas</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">Envía dinero como VIP a Cuba.</h1>
          <p className="mt-4 text-base text-white/70">Remesas, recargas y servicios para Cuba desde Brasil.</p>
        </section>

        <section className="mt-8 rounded-2xl border border-[#E7C766]/40 bg-white/5 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#E7C766]">⚡ Remesa rápida</p>
              <h2 className="mt-1 text-lg font-bold">Elige un monto y mira cuánto recibe Cuba</h2>
            </div>
            <span className="rounded-full bg-[#E7C766]/15 px-2.5 py-1 text-[10px] font-bold text-[#E7C766]">Tasa vigente</span>
          </div>

          {rates.isLoading ? (
            <p className="mt-4 text-sm font-semibold text-white/60">Actualizando tasa…</p>
          ) : currentRate > 0 ? (
            <>
              <p className="mt-3 text-xs font-semibold text-white/55">Hoy: 1 BRL = {currentRate.toFixed(2)} CUP</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <a
                    key={amount}
                    href={quickOfferLink(amount)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-[#E7C766]/50 bg-[#E7C766]/10 p-3 text-center transition hover:bg-[#E7C766]/20 active:scale-95"
                  >
                    <div className="text-lg font-extrabold text-[#E7C766]">R${amount}</div>
                    <div className="mt-1 text-[10px] font-semibold text-white/60">≈ {formatCUP(amount * currentRate)} CUP</div>
                    <div className="mt-2 text-[10px] font-bold text-white">Pedir ahora →</div>
                  </a>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] font-medium text-white/45">La oferta se calcula con la tasa vigente. Al pedirla, WhatsApp abrirá un mensaje listo para continuar.</p>
            </>
          ) : (
            <p className="mt-4 text-sm font-semibold text-white/60">Tasa temporalmente no disponible.</p>
          )}
        </section>

        <div className="mt-6 space-y-3">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="block w-full rounded-xl bg-[#E7C766] px-6 py-4 text-center font-bold text-[#0B1B3A]">Hablar por WhatsApp</a>
          <a href="/auth" className="block w-full rounded-xl border border-[#E7C766]/50 px-6 py-4 text-center font-semibold">Acceder a mi cuenta</a>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Remesas</div><div className="mt-1 text-xs text-white/60">Brasil → Cuba</div></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Recargas</div><div className="mt-1 text-xs text-white/60">Cubacel</div></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Tasas</div><div className="mt-1 text-xs text-white/60">Actualizadas</div></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Seguro</div><div className="mt-1 text-xs text-white/60">Cuenta protegida</div></div>
        </div>
      </div>
    </main>
  );
}
