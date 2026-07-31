import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Shield, Zap, Globe2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-vip text-foreground">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="font-display text-lg font-bold tracking-wide">VIP Remesas</span>
        </div>
        <Link to="/auth" className="text-sm font-medium text-gold hover:opacity-80">
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-md px-5 pt-14 pb-16">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-card/60 px-3 py-1 text-xs font-medium text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Servicio premium desde Brasil
        </p>
        <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">
          Envía dinero <span className="text-gradient-gold">como VIP</span> a Cuba y Latinoamérica.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Rápido, seguro y con la mejor tasa del mercado. Registra tu cuenta y envía tu primera remesa en minutos.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to="/auth"
            className="block w-full rounded-xl bg-gradient-gold px-6 py-4 text-center text-base font-semibold text-primary-foreground shadow-gold"
          >
            Crear cuenta gratis
          </Link>
          <Link
            to="/auth"
            className="block w-full rounded-xl border border-gold/50 bg-card/50 px-6 py-4 text-center text-base font-medium text-foreground"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3">
          {[
            { icon: Zap, title: "En minutos", desc: "Acredita rápido" },
            { icon: Shield, title: "100% seguro", desc: "Cifrado y auth" },
            { icon: Globe2, title: "4 países", desc: "CU · VE · CO · MX" },
            { icon: Sparkles, title: "Tasa VIP", desc: "Mejor cambio" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <Icon className="mb-2 h-5 w-5 text-gold" />
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
