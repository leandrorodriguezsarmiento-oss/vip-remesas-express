import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { whatsappReservaLink, whatsappContactLink } from "@/lib/flights";
import { Plane, MessageCircle, ShieldCheck, Clock, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pasajes")({
  component: PasajesPage,
  head: () => ({
    meta: [
      { title: "VipPasajes | Pasajes Cuba → Guyana | VIP Remesas" },
      { name: "description", content: "Reserva tu pasaje desde La Habana, Santiago de Cuba, Camagüey u Holguín hacia Georgetown, Guyana. Atención directa por WhatsApp." },
      { property: "og:title", content: "VipPasajes | Pasajes Cuba → Guyana" },
      { property: "og:description", content: "Reserva tu pasaje a Guyana con atención directa por WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const GRADS = ["bg-gradient-sky", "bg-gradient-emerald", "bg-gradient-violet", "bg-gradient-rose"];

function PasajesPage() {
  const flights = useQuery({
    queryKey: ["flights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flights")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">VipPasajes</p>
        <h1 className="font-display text-2xl font-bold">Pasajes a Guyana ✈️</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Salidas desde Cuba hacia Georgetown. Reserva directo por WhatsApp.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-sky p-6 shadow-glow">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        <Plane className="h-8 w-8 text-white" />
        <p className="mt-2 font-display text-2xl font-bold text-white">Cuba → Guyana</p>
        <p className="mt-1 text-xs text-white/85">La Habana · Santiago · Camagüey · Holguín</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { icon: ShieldCheck, label: "Reserva segura" },
          { icon: Clock, label: "Respuesta rápida" },
          { icon: MessageCircle, label: "Atención 1 a 1" },
        ].map(({ icon: Icon, label }, i) => (
          <div key={label} style={{ animationDelay: `${i * 70}ms` }}
            className="animate-rise rounded-xl border border-border bg-card p-3">
            <Icon className="mx-auto h-5 w-5 text-gold" />
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Rutas disponibles</h2>
        {flights.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Pronto publicaremos las salidas disponibles.
          </div>
        )}
        {flights.data?.map((f, i) => (
          <div key={f.id} style={{ animationDelay: `${i * 60}ms` }}
            className="animate-rise overflow-hidden rounded-2xl border border-gold/30 bg-card shadow-card">
            <div className="flex items-center gap-3 p-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-glow ${GRADS[i % GRADS.length]}`}>
                <Plane className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <span>🇨🇺 {f.origin_city}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>🇬🇾 {f.destination}</span>
                </div>
                {f.notes && <p className="mt-0.5 text-xs text-muted-foreground">{f.notes}</p>}
                <p className="mt-1 font-display text-lg font-extrabold text-gold">
                  {Number(f.price_usd) > 0 ? `USD ${Number(f.price_usd).toFixed(0)}` : "Consultar precio"}
                </p>
              </div>
            </div>
            <a
              href={whatsappReservaLink(f.origin_city, f.destination)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-gradient-emerald px-4 py-3 text-sm font-extrabold text-white transition-transform active:scale-[0.99]"
            >
              <MessageCircle className="h-5 w-5" /> Reservar por WhatsApp
            </a>
          </div>
        ))}
      </section>

      <a
        href={whatsappContactLink()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-gold" /> ¿Dudas? Escríbenos
        </span>
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      </a>
    </div>
  );
}
