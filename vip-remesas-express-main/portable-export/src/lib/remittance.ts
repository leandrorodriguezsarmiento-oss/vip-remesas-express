// ============================================================================
// VIP Remesas — modelo de negocio (BR / EU / US → Cuba)
// ----------------------------------------------------------------------------
// Las tasas viven en la tabla `rates` (editables desde el panel admin).
// Este archivo sólo expone tipos, catálogo y utilidades de formato + slots
// de integración (PIX y Cubacel).
// ============================================================================

export type OriginCode = "BR" | "MX" | "EU" | "US";
export type MethodCategory = "transferencia" | "efectivo";
export type DestCurrency = "CUP" | "MLC" | "USD";

export interface OriginOption {
  code: OriginCode;
  name: string;
  currency: string; // BRL | EUR | USD
  flag: string;
  symbol: string;
}

export const ORIGINS: OriginOption[] = [
  { code: "BR", name: "Brasil",         currency: "BRL", flag: "🇧🇷", symbol: "R$" },
  { code: "MX", name: "México",         currency: "MXN", flag: "🇲🇽", symbol: "$"  },
  { code: "EU", name: "Europa",         currency: "EUR", flag: "🇪🇺", symbol: "€"  },
  { code: "US", name: "Estados Unidos", currency: "USD", flag: "🇺🇸", symbol: "$"  },
];

export function getOrigin(code: OriginCode): OriginOption {
  return ORIGINS.find((o) => o.code === code)!;
}

export interface MethodCategoryOption {
  id: MethodCategory;
  label: string;
  description: string;
  currencies: DestCurrency[];
}

export const METHOD_CATEGORIES: MethodCategoryOption[] = [
  {
    id: "transferencia",
    label: "Transferencia",
    description: "A tarjeta MLC / cuenta CUP / USD clásica",
    currencies: ["CUP", "MLC", "USD"],
  },
  {
    id: "efectivo",
    label: "Efectivo",
    description: "Entrega en mano al destinatario",
    currencies: ["CUP", "USD"],
  },
];

export const CURRENCY_LABEL: Record<DestCurrency, string> = {
  CUP: "CUP (Peso cubano)",
  MLC: "MLC (Moneda Libremente Convertible)",
  USD: "USD (Dólar clásico)",
};

// ---------------- Cotización ----------------

export interface RateRow {
  id: string;
  origin_country: string;
  origin_currency: string;
  method_category: string;
  dest_currency: string;
  rate: number;
  time_min_minutes: number;
  time_max_minutes: number;
  min_amount: number;
  active: boolean;
}

export function findRate(
  rates: RateRow[] | undefined,
  origin: OriginCode,
  method: MethodCategory,
  dest: DestCurrency,
): RateRow | undefined {
  return rates?.find(
    (r) =>
      r.origin_country === origin &&
      r.method_category === method &&
      r.dest_currency === dest &&
      r.active,
  );
}

export interface Quote {
  amountOrigin: number;
  amountDest: number;
  rate: number;
  timeLabel: string;
  currency: DestCurrency;
  minAmount: number;
}

export function calcQuote(amountOrigin: number, rate: RateRow): Quote {
  return {
    amountOrigin,
    amountDest: +(amountOrigin * rate.rate).toFixed(2),
    rate: rate.rate,
    timeLabel: `${rate.time_min_minutes}–${rate.time_max_minutes} min`,
    currency: rate.dest_currency as DestCurrency,
    minAmount: Number(rate.min_amount),
  };
}

// ---------------- Utilidades ----------------

export function generateTrackingId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `VIP-${ts}${rand}`;
}

export function formatMoney(n: number, currency: string): string {
  try {
    const locale =
      currency === "BRL" ? "pt-BR" : currency === "EUR" ? "es-ES" : currency === "MXN" ? "es-MX" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

// Kept for backwards compatibility with older components:
export const formatBRL = (n: number) => formatMoney(n, "BRL");
export const formatCurrency = (n: number, currency: string) => formatMoney(n, currency);

// ---------------- PIX (dato público de cobro) ----------------
// Una llave PIX se muestra al pagador, por lo que no es un secreto. Se puede
// sustituir al desplegar sin recompilar mediante VITE_PIX_KEY.
export const PIX_KEY = import.meta.env.VITE_PIX_KEY || "d1512e93-e329-4f6c-b2d3-769384b8f99a";

function pixCrc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

// Genera un PIX copia y pega con el monto embebido en BRL.
export function generatePixCode(_trackingId: string, amountBrl: number): string {
  const amount = amountBrl > 0 ? amountBrl.toFixed(2) : "";
  const payload =
    emv("00", "01") +
    emv("26", emv("00", "br.gov.bcb.pix") + emv("01", PIX_KEY)) +
    emv("52", "0000") +
    emv("53", "986") +
    (amount ? emv("54", amount) : "") +
    emv("58", "BR") +
    emv("59", "VIP REMESAS") +
    emv("60", "BOA VISTA") +
    emv("62", emv("05", "VIPREMESAS")) +
    "6304";
  return payload + pixCrc16(payload);
}

