import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BR_STATES, BR_STATE_STORAGE_KEY, stateName } from "@/lib/br-states";
import { CvBuilder } from "@/components/CvBuilder";
import {
  MapPin, Phone, Smartphone, ExternalLink, HeartHandshake,
  FileText, Sparkles, Gift, Search,
} from "lucide-react";

export type MigrantResource = {
  id: string;
  kind: "lugar" | "contacto" | "app";
  title: string;
  description: string | null;
  address: string | null;
  state_code: string | null;
  city: string | null;
  phone: string | null;
  url: string | null;
  sort_order: number;
  active: boolean;
};

type Section = "lugar" | "contacto" | "app" | "cv";

const SECTIONS: { id: Section; label: string; icon: typeof MapPin; grad: string }[] = [
  { id: "lugar", label: "Lugares", icon: MapPin, grad: "bg-gradient-sky" },
  { id: "contacto", label: "Contactos", icon: Phone, grad: "bg-gradient-emerald" },
  { id: "app", label: "Apps", icon: Smartphone, grad: "bg-gradient-violet" },
  { id: "cv", label: "Currículo", icon: FileText, grad: "bg-gradient-amber" },
];

export function MigrantGuide() {
  const [section, setSection] = useState<Section>("lugar");
  const [q, setQ] = useState("");
  const [state, setState] = useState<string>(() => {
    try {
      return localStorage.getItem(BR_STATE_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const resources = useQuery({
    queryKey: ["migrant-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrant_resources")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as MigrantResource[];
    },
  });

  const list = useMemo(() => {
    const all = resources.data ?? [];
    const term = q.trim().toLowerCase();
    return all
      .filter((r) => r.kind === section)
      .filter((r) => (section === "lugar" && state ? !r.state_code || r.state_code === state : true))
      .filter((r) =>
        !term
          ? true
          : `${r.title} ${r.description ?? ""} ${r.city ?? ""} ${r.address ?? ""}`.toLowerCase().includes(term),
      );
  }, [resources.data, section, state, q]);

  function pickState(code: string) {
    setState(code);
    try {
      localStorage.setItem(BR_STATE_STORAGE_KEY, code);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <p className="text-sm font-bold text-muted-foreground">VipMigrante · 100% gratis</p>
        <h1 className="font-display text-2xl font-extrabold">Guía del migrante 🤝</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          Lugares a dónde ir en Brasil, teléfonos de ayuda, las apps que necesitas y tu currículo gratis.
        </p>
      </div>

      {/* Cartel principal animado */}
      <div className="animate-rise relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-emerald p-6 shadow-glow">
        <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shine bg-white/40 blur-md" />
        <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
        <HeartHandshake className="h-8 w-8 animate-float text-white" />
        <p className="mt-2 font-display text-2xl font-extrabold text-white drop-shadow">Ayuda gratis en Brasil</p>
        <p className="mt-1 text-xs font-bold text-white/90">Documentos · Salud · Trabajo · Currículo</p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
          <Gift className="h-3.5 w-3.5" /> Sin costo
        </span>
      </div>

      {/* Secciones tipo tienda */}
      <div className="grid grid-cols-4 gap-2">
        {SECTIONS.map(({ id, label, icon: Icon, grad }, i) => {
          const on = section === id;
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`animate-rise flex flex-col items-center gap-1 rounded-2xl border p-3 text-[10px] font-extrabold uppercase tracking-wide transition-transform active:scale-95 ${
                on ? "border-gold bg-card shadow-glow text-gold" : "border-border bg-card/70 text-muted-foreground"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl text-white transition-transform ${grad} ${on ? "scale-110 shadow-glow" : ""}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {section === "cv" ? (
        <CvBuilder />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground"
            />
          </div>

          {section === "lugar" && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-gold" />
              <select
                value={state}
                onChange={(e) => pickState(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold outline-none"
              >
                <option value="">Todos los estados de Brasil</option>
                {BR_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {resources.isLoading && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs font-bold text-muted-foreground">
              Cargando…
            </p>
          )}

          {!resources.isLoading && list.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs font-bold text-muted-foreground">
              Todavía no hay información publicada aquí.
            </p>
          )}

          <ul className="space-y-3">
            {list.map((r, i) => (
              <li
                key={r.id}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-rise overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform hover:border-gold"
              >
                <div className="flex gap-3 p-4">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-glow ${
                      r.kind === "lugar" ? "bg-gradient-sky" : r.kind === "contacto" ? "bg-gradient-emerald" : "bg-gradient-violet"
                    }`}
                  >
                    {r.kind === "lugar" ? (
                      <MapPin className="h-5 w-5" />
                    ) : r.kind === "contacto" ? (
                      <Phone className="h-5 w-5" />
                    ) : (
                      <Smartphone className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold leading-tight">{r.title}</p>
                    {r.description && (
                      <p className="mt-1 text-xs font-bold text-muted-foreground">{r.description}</p>
                    )}
                    {(r.address || r.city || r.state_code) && (
                      <p className="mt-1 text-[11px] font-bold text-foreground/75">
                        📍 {[r.address, r.city, stateName(r.state_code)].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex border-t border-border">
                  {r.phone && (
                    <a
                      href={`tel:${r.phone.replace(/\s/g, "")}`}
                      className="flex flex-1 items-center justify-center gap-1.5 bg-gradient-emerald px-3 py-2.5 text-xs font-extrabold text-white transition-transform active:scale-[0.98]"
                    >
                      <Phone className="h-4 w-4" /> {r.phone}
                    </a>
                  )}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-extrabold text-gold transition-transform active:scale-[0.98]"
                    >
                      {r.kind === "app" ? "Descargar app" : "Abrir enlace"} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-2 rounded-xl border border-gold/30 bg-secondary/60 p-3 text-[11px] font-bold text-muted-foreground">
            <Sparkles className="h-4 w-4 shrink-0 text-gold" />
            Información gratuita para la comunidad. Si algo cambió, escríbenos y lo actualizamos.
          </p>
        </div>
      )}
    </div>
  );
}
