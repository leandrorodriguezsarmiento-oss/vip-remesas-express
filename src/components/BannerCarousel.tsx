import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Banner = {
  id: string;
  image_url: string;
  title: string | null;
  link_url: string | null;
};

function useBanners() {
  const { data } = useQuery<Banner[]>({
    queryKey: ["banners", "active"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("id,image_url,title,link_url")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Banner[];
    },
  });
  const banners = data ?? [];
  const [idx, setIdx] = useState(0);

  // Precargamos las imágenes para que el cambio sea instantáneo.
  useEffect(() => {
    banners.forEach((b) => {
      const img = new Image();
      img.src = b.image_url;
    });
  }, [banners]);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  return { banners, current: banners[Math.min(idx, Math.max(banners.length - 1, 0))], idx };
}

function Dots({ count, idx }: { count: number; idx: number }) {
  if (count < 2) return null;
  return (
    <div className="absolute bottom-2 right-2 flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`} />
      ))}
    </div>
  );
}

/** Carrusel simple (home pública, antes de iniciar sesión). */
export function BannerCarousel() {
  const { banners, current, idx } = useBanners();
  if (!current) return null;

  const inner = (
    <div className="animate-rise relative aspect-16/7 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <img
        src={current.image_url}
        alt={current.title ?? "Promoción VIP Remesas"}
        loading="eager"
        decoding="async"
        className="h-full w-full object-cover transition-opacity duration-500"
      />
      {current.title && (
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent p-3">
          <p className="text-sm font-extrabold text-white drop-shadow">{current.title}</p>
        </div>
      )}
      <Dots count={banners.length} idx={idx} />
    </div>
  );

  return current.link_url ? (
    <a href={current.link_url} target="_blank" rel="noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

/**
 * Cartel principal del dashboard: los banners cargados desde el panel admin
 * son el fondo del mensaje "Envía a Cuba".
 */
export function BannerHero({ children }: { children: ReactNode }) {
  const { banners, current, idx } = useBanners();

  return (
    <div className="animate-rise relative overflow-hidden rounded-2xl border border-gold/30 shadow-glow">
      {current ? (
        <img
          src={current.image_url}
          alt={current.title ?? "Promoción VIP Remesas"}
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
        />
      ) : null}
      <div className={`absolute inset-0 ${current ? "bg-linear-to-tr from-black/75 via-black/45 to-black/20" : "bg-gradient-sky"}`} />
      <span className="pointer-events-none absolute inset-y-0 -left-1/4 w-1/4 animate-shine bg-white/25 blur-md" />
      <div className="relative min-h-[9.5rem] p-6">{children}</div>
      <Dots count={banners.length} idx={idx} />
    </div>
  );
}
