import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

const TRIGGER_DISTANCE = 72;
const MAX_PULL = 110;

export function PullToRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let startY = 0;
    let active = false;
    let pulling = false;

    const isMobile = () => window.matchMedia("(pointer: coarse)").matches && window.innerWidth <= 900;
    const isEditable = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      return !!element?.closest("input, textarea, select, button, [contenteditable=\"true\"]");
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!isMobile() || refreshingRef.current || event.touches.length !== 1 || window.scrollY > 0 || isEditable(event.target)) {
        active = false;
        return;
      }
      startY = event.touches[0]?.clientY ?? 0;
      active = true;
      pulling = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!active || refreshingRef.current || event.touches.length !== 1 || window.scrollY > 0) return;
      const currentY = event.touches[0]?.clientY ?? startY;
      const distance = currentY - startY;
      if (distance <= 0) {
        pulling = false;
        distanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      pulling = true;
      const eased = Math.min(MAX_PULL, distance * 0.55);
      distanceRef.current = eased;
      setPullDistance(eased);
      event.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!active) return;
      active = false;
      const shouldRefresh = pulling && distanceRef.current >= TRIGGER_DISTANCE;
      pulling = false;
      if (!shouldRefresh || refreshingRef.current) {
        distanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setPullDistance(48);
      try {
        await Promise.all([queryClient.invalidateQueries(), router.invalidate()]);
      } finally {
        refreshingRef.current = false;
        distanceRef.current = 0;
        setRefreshing(false);
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [queryClient, router]);

  if (pullDistance <= 0 && !refreshing) return null;
  const progress = Math.min(1, pullDistance / TRIGGER_DISTANCE);

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-2 z-[9999] -translate-x-1/2 rounded-full border border-gold/30 bg-card/95 px-3 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur"
      style={{ opacity: Math.min(1, 0.45 + progress * 0.55) }}
      aria-live="polite"
    >
      {refreshing ? "↻ Actualizando…" : progress >= 1 ? "↻ Suelta para actualizar" : "↓ Desliza para actualizar"}
    </div>
  );
}
