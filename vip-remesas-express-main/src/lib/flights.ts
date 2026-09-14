/** VipPasajes: reservas de pasajes Cuba → Guyana por WhatsApp. */

/** Número de WhatsApp del admin (formato internacional sin +). */
export const VIP_WHATSAPP = "5595984405698";

/** Enlace wa.me con mensaje prellenado para reservar un pasaje. */
export function whatsappReservaLink(originCity: string, destination: string): string {
  const msg = `Hola VIP Remesas ✈️ Quiero reservar un pasaje ${originCity} → ${destination}. ¿Me das más información?`;
  return `https://wa.me/${VIP_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

/** Enlace wa.me genérico de contacto. */
export function whatsappContactLink(): string {
  const msg = "Hola VIP Remesas, necesito ayuda.";
  return `https://wa.me/${VIP_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
