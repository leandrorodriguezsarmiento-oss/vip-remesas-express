"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

type Banner = { id: string; image_url: string; title: string | null; link_url: string | null };

export function BannerCarousel() {
  const { data } = useQuery<Banner[]>({
    queryKey: ["banners", "active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("id,image_url,title,link_url").eq("active", true).order("sort_order");
      if (error) throw error; return (data ?? []) as Banner[];
    },
  });
  const banners = data ?? [];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (banners.length === 0) return null;
  const b = banners[Math.min(idx, banners.length - 1)];
  const inner = (
    <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.image_url} alt={b.title ?? "Banner"} className="h-full w-full object-cover" />
      {b.title && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3"><p className="text-sm font-semibold text-white">{b.title}</p></div>}
    </div>
  );
  return b.link_url ? <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="block">{inner}</a> : inner;
}
