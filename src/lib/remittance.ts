// ============================================================================
// VIP Remesas — datos de negocio y "slots de integración"
// ----------------------------------------------------------------------------
// Reemplaza las tasas mock con una API real (por ejemplo openexchangerates.org,
// exchangerate.host, o tu propio proveedor) en `fetchExchangeRates`.
// Reemplaza `createPayment` con la pasarela real (Stripe, Mercado Pago, PIX...).
// ============================================================================

export type CountryCode = "CU" | "VE" | "CO" | "MX";

export interface CountryOption {
  code: CountryCode;
  name: string;
  currency: string;
  flag: string;
  deliveryMethods: string[];
}

export const COUNTRIES: CountryOption[] = [
  {
    code: "CU",
    name: "Cuba",
    currency: "CUP",
    flag: "🇨🇺",
    deliveryMethods: ["Entrega en casa", "Tarjeta MLC", "Transferencia CUP"],
  },
  {
    code: "VE",
    name: "Venezuela",
    currency: "VES",
    flag: "🇻🇪",
    deliveryMethods: ["Depósito bancario", "Pago Móvil", "Entrega en casa"],
  },
  {
    code: "CO",
    name: "Colombia",
    currency: "COP",
    flag: "🇨🇴",
    deliveryMethods: ["Depósito bancario", "Nequi", "Daviplata"],
  },
  {
    code: "MX",
    name: "México",
    currency: "MXN",
    flag: "🇲🇽",
    deliveryMethods: ["Depósito bancario", "Entrega en casa"],
  },
];

// ---------------- MOCK EXCHANGE RATES (1 BRL = X moneda destino) ------------
// TODO: Reemplazar por API real de tasas. Este es el ÚNICO lugar a tocar.
const MOCK_RATES: Record<CountryCode, number> = {
  CU: 48.0,
  VE: 7.35,
  CO: 815.2,
  MX: 3.48,
};

export async function fetchExchangeRates(): Promise<Record<CountryCode, number>> {
  // 🔌 SLOT DE INTEGRACIÓN: sustituir por fetch a proveedor real.
  // const res = await fetch("https://api.exchangerate.host/latest?base=BRL");
  // return parseRates(await res.json());
  return MOCK_RATES;
}

export function getRate(country: CountryCode): number {
  return MOCK_RATES[country];
}

// Comisión: 5% con mínimo R$ 5.
export function calcFee(amountBrl: number): number {
  return Math.max(5, +(amountBrl * 0.05).toFixed(2));
}

export function calcQuote(amountBrl: number, country: CountryCode) {
  const rate = getRate(country);
  const fee = calcFee(amountBrl);
  const amountDest = +(amountBrl * rate).toFixed(2);
  const total = +(amountBrl + fee).toFixed(2);
  return {
    rate,
    fee,
    amountDest,
    total,
    currency: COUNTRIES.find((c) => c.code === country)!.currency,
  };
}

export const PAYMENT_METHODS = [
  { id: "pix", label: "PIX", description: "Transferencia instantánea" },
  { id: "credit", label: "Tarjeta de crédito", description: "Visa · Mastercard · Elo" },
  { id: "debit", label: "Tarjeta de débito", description: "Débito bancario" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

// ---------------- PASARELA DE PAGOS (mock) ---------------------------------
// 🔌 SLOT DE INTEGRACIÓN: reemplazar por Stripe / Mercado Pago / PIX real.
export async function createPayment(_input: {
  method: PaymentMethodId;
  totalBrl: number;
  trackingId: string;
}): Promise<{ ok: true; providerRef: string }> {
  await new Promise((r) => setTimeout(r, 700));
  return { ok: true, providerRef: `MOCK-${Date.now()}` };
}

export function generateTrackingId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `VIP-${ts}${rand}`;
}

export function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function formatCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
