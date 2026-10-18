import { useLocation } from "@tanstack/react-router";
import { SUPPORT_WHATSAPP_URL } from "@/lib/alias";

const WHATSAPP_MESSAGE = "Hola, equipo de VIP Remesas. Quisiera recibir información sobre sus servicios.";
const WHATSAPP_LINK = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

// These pages include the fixed bottom navigation; keep the button above it.
const APP_ROUTES = ["/dashboard", "/recargas", "/send", "/tienda", "/pasajes", "/migrantes", "/history", "/settings", "/admin"];

export function WhatsAppFloat() {
  const { pathname } = useLocation();
  const aboveBottomNav = APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar a VIP Remesas por WhatsApp"
      title="¿Necesitas ayuda? Escríbenos por WhatsApp"
      className={`fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full border-2 border-white/30 bg-[#25D366] text-white shadow-[0_8px_30px_rgba(37,211,102,0.42)] transition-transform duration-200 hover:scale-110 hover:bg-[#20bd5a] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] active:scale-95 sm:right-6 sm:h-16 sm:w-16 ${aboveBottomNav ? "bottom-[calc(7rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true">
        <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05 0C5.495 0 .16 5.335 .157 11.89c0 2.095.547 4.142 1.588 5.946L.057 24l6.305-1.654a11.877 11.877 0 0 0 5.685 1.448h.005c6.554 0 11.89-5.335 11.893-11.891a11.82 11.82 0 0 0-3.425-8.423zm-8.47 18.27h-.004a9.861 9.861 0 0 1-5.031-1.378l-.36-.213-3.746.982 1-3.65-.235-.374a9.83 9.83 0 0 1-1.512-5.126C2.164 6.455 6.615 2 12.055 2a9.83 9.83 0 0 1 6.974 2.89 9.829 9.829 0 0 1 2.886 6.977c-.002 5.439-4.456 9.887-9.865 9.887zm5.417-7.405c-.297-.149-1.758-.868-2.03-.967-.273-.099-.47-.149-.67.149-.197.297-.768.967-.94 1.165-.174.198-.347.223-.644.074-.297-.148-1.255-.463-2.39-1.477-.883-.789-1.478-1.76-1.651-2.057-.174-.297-.019-.458.13-.606.134-.133.297-.346.446-.52.149-.173.198-.297.297-.495.099-.198.05-.371-.025-.52-.075-.148-.67-1.61-.917-2.205-.242-.58-.487-.502-.67-.51l-.57-.01c-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.478s1.064 2.874 1.213 3.072c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.488 1.692.625.711.226 1.359.194 1.871.118.57-.085 1.758-.719 2.005-1.412.248-.693.248-1.287.174-1.411-.075-.124-.272-.198-.57-.347z" />
      </svg>
    </a>
  );
}
