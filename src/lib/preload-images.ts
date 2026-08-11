/**
 * Precarga en el navegador las imágenes de la app la primera vez que el
 * usuario entra, para que luego todo se sienta instantáneo.
 */
import bgFlags from "@/assets/bg-flags.jpg";
import bgCard from "@/assets/bg-card.jpg";
import bgCash from "@/assets/bg-cash.jpg";
import cubacel from "@/assets/cubacel.png";
import promoGift from "@/assets/promo-gift.png";
import mapRoute from "@/assets/map-route.jpg";
import bannerVip from "@/assets/banner-vip.jpg";

const ASSETS = [bgFlags, bgCard, bgCash, cubacel, promoGift, mapRoute, bannerVip];

let done = false;

export function preloadAppImages() {
  if (done || typeof window === "undefined") return;
  done = true;
  // Sin bloquear el render: se descargan cuando el navegador esté libre.
  const run = () => ASSETS.forEach((src) => { const i = new Image(); i.decoding = "async"; i.src = src; });
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  } else {
    setTimeout(run, 400);
  }
}
