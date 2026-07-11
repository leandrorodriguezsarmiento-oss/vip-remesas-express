// ============================================================================
// VIP Remesas — modelo de negocio (BR / EU / US → Cuba)
// ============================================================================

export type OriginCode = "BR" | "EU" | "US";
export type MethodCategory = "transferencia" | "efectivo";
export type DestCurrency = "CUP" | "MLC" | "USD";

export interface OriginOption {
  code: OriginCode; name: string; currency: string; flag: string; symbol: string;
}

export const ORIGINS: OriginOption[] = [
  { code: "BR", name: "Brasil",         currency: "BRL", flag: "🇧🇷", symbol: "R$" },
  { code: "EU", name: "Europa",         currency: "EUR", flag: "🇪🇺", symbol: "€"  },
  { code: "US", name: "Estados Unidos", currency: "USD", flag: "🇺🇸", symbol: "$"  },
];
export const getOrigin = (code: OriginCode) => ORIGINS.find((o) => o.code === code)!;

export interface MethodCategoryOption {
  id: MethodCategory; label: string; description: string; currencies: DestCurrency[];
}
export const METHOD_CATEGORIES: MethodCategoryOption[] = [
  { id: "transferencia", label: "Transferencia", description: "A tarjeta MLC / cuenta CUP / USD clásica", currencies: ["CUP","MLC","USD"] },
  { id: "efectivo",      label: "Efectivo",      description: "Entrega en mano al destinatario",          currencies: ["CUP","USD"] },
];
export const CURRENCY_LABEL: Record<DestCurrency, string> = {
  CUP: "CUP (Peso cubano)", MLC: "MLC (Moneda Libremente Convertible)", USD: "USD (Dólar clásico)",
};

export interface RateRow {
  id: string; origin_country: string; origin_currency: string;
  method_category: string; dest_currency: string;
  rate: number; time_min_minutes: number; time_max_minutes: number;
  min_amount: number; active: boolean;
}

export function findRate(rates: RateRow[] | undefined, origin: OriginCode, method: MethodCategory, dest: DestCurrency) {
  return rates?.find((r) => r.origin_country === origin && r.method_category === method && r.dest_currency === dest && r.active);
}

export interface Quote { amountOrigin: number; amountDest: number; rate: number; timeLabel: string; currency: DestCurrency; minAmount: number; }
export function calcQuote(amountOrigin: number, rate: RateRow): Quote {
  return {
    amountOrigin, amountDest: +(amountOrigin * rate.rate).toFixed(2),
    rate: rate.rate, timeLabel: `${rate.time_min_minutes}–${rate.time_max_minutes} min`,
    currency: rate.dest_currency as DestCurrency, minAmount: Number(rate.min_amount),
  };
}

export function generateTrackingId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `VIP-${ts}${rand}`;
}

export function formatMoney(n: number, currency: string): string {
  try {
    const locale = currency === "BRL" ? "pt-BR" : currency === "EUR" ? "es-ES" : "en-US";
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${currency}`; }
}
export const formatBRL = (n: number) => formatMoney(n, "BRL");
export const formatCurrency = (n: number, currency: string) => formatMoney(n, currency);

// ---------------- PIX (llave real VIP Remesas) ----------------
const PIX_STATIC_BR =
  "00020126360014br.gov.bcb.pix0114+55959810067755204000053039865802BR5908ARANCH996009Sao Paulo610901227-20062240520daqr33445318438073686";

function pixCrc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePixCode(_trackingId: string, amountBrl: number): string {
  const amount = amountBrl.toFixed(2);
  const amountField = `54${amount.length.toString().padStart(2, "0")}${amount}`;
  const [before, after] = PIX_STATIC_BR.split("5802BR");
  const withoutCrc = `${before}${amountField}5802BR${after}6304`;
  return withoutCrc + pixCrc16(withoutCrc);
}

export async function checkPixPayment(_trackingId: string) { await new Promise((r) => setTimeout(r, 800)); return { paid: true }; }
