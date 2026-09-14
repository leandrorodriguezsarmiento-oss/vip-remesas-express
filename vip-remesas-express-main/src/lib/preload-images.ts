/**
 * Precarga en el navegador las imágenes de la app la primera vez que el
 * usuario entra, para que luego todo se sienta instantáneo.
 */
import bgFlags from "@/assets/bg-flags.jpg";
import bannerVip from "@/assets/banner-vip.jpg";

/** Solo lo crítico: el fondo global y el banner principal. El resto se carga
 *  perezosamente cuando la pantalla que lo usa se abre. */
const ASSETS = [bgFlags, bannerVip];

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
