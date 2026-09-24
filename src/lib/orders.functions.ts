import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generatePixCode, generateTrackingId } from "@/lib/remittance";

const ORIGIN_CURRENCY: Record<string, string> = { BR: "BRL", MX: "MXN", EU: "EUR", US: "USD" };
const PAYMENT_METHOD: Record<string, string> = { BR: "pix", MX: "transferencia", US: "zelle", EU: "sepa" };

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        origin: z.enum(["BR", "MX", "EU", "US"]),
        method: z.enum(["transferencia", "efectivo"]),
        currency: z.enum(["CUP", "MLC", "USD"]),
        amount: z.number().positive().max(1_000_000),
        deliveryLocation: z.string().trim().max(120).optional().nullable(),
        recipient: z.object({
          name: z.string().trim().min(1).max(120),
          phone: z.string().trim().min(3).max(40),
          card: z.string().trim().max(60).optional().nullable(),
          address: z.string().trim().max(300).optional().nullable(),
          notes: z.string().trim().max(500).optional().nullable(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cash deliveries require an enabled delivery location and the recipient's street address.
    const address = data.recipient.address?.trim() || "";
    let deliveryLocation: string | null = null;
    if (data.method === "efectivo") {
      if (address.length < 8) {
        throw new Error("La dirección de entrega es obligatoria para remesas en efectivo");
      }
      const requestedLocation = data.deliveryLocation?.trim() || "";
      if (!requestedLocation) {
        throw new Error("Selecciona el municipio o zona de entrega");
      }
      const { data: locationRow, error: locationError } = await supabaseAdmin
        .from("cash_delivery_locations")
        .select("municipality")
        .eq("municipality", requestedLocation)
        .eq("active", true)
        .maybeSingle();
      if (locationError) throw locationError;
      if (!locationRow) {
        throw new Error("Ese municipio o zona ya no está disponible para entrega en efectivo");
      }
      deliveryLocation = locationRow.municipality;
    }

    // 1) Look up the authoritative rate server-side, including amount brackets.
    const { data: rateRowsRaw, error: rateErr } = await supabaseAdmin
      .from("rates")
      .select("*")
      .eq("origin_country", data.origin)
      .eq("method_category", data.method)
      .eq("dest_currency", data.currency)
      .eq("active", true);
    if (rateErr) throw rateErr;

    const rateRows = (rateRowsRaw ?? []) as Array<any>;
    const rateRow = rateRows
      .filter((row) => {
        const min = Number(row.min_amount ?? 0);
        const max = row.max_amount == null ? null : Number(row.max_amount);
        return data.amount >= min && (max == null || data.amount <= max);
      })
      .sort((a, b) => Number(b.min_amount ?? 0) - Number(a.min_amount ?? 0))[0];

    if (!rateRow) {
      const minimum = rateRows.length
        ? Math.min(...rateRows.map((row) => Number(row.min_amount ?? 0)))
        : null;
      if (minimum != null && data.amount < minimum) {
        throw new Error(`Monto mínimo: ${minimum}`);
      }
      throw new Error("Tasa no disponible para este monto");
    }

    // 2) Recompute money values server-side. Ignore any client-supplied numbers.
    const rate = Number(rateRow.rate);
    const amountDest = +(data.amount * rate).toFixed(2);
    const originCurrency = ORIGIN_CURRENCY[data.origin];
    const paymentMethod = PAYMENT_METHOD[data.origin];

    const trackingId = generateTrackingId();
    const pixCode = data.origin === "BR" ? generatePixCode(trackingId, data.amount) : null;

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: context.userId,
        tracking_id: trackingId,
        origin_country: data.origin,
        origin_currency: originCurrency,
        destination_country: "Cuba",
        method_category: data.method,
        delivery_method: data.currency,
        recipient_name: data.recipient.name,
        recipient_phone: data.recipient.phone,
        recipient_card: data.recipient.card || null,
        delivery_location: deliveryLocation,
        notes: [address ? `Dirección de entrega: ${address}` : null, data.recipient.notes || null]
          .filter(Boolean)
          .join(" | ") || null,
        amount_brl: data.amount,
        amount_dest: amountDest,
        dest_currency: data.currency,
        exchange_rate: rate,
        fee_brl: 0,
        total_brl: data.amount,
        payment_method: paymentMethod,
        pix_code: pixCode,
        status: "pending_payment",
      })
      .select("id")
      .single();
    if (insertErr) throw insertErr;

    return { transactionId: inserted.id, trackingId, pixCode, amountDest, rate };

  });

export const createRechargeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        promoId: z.string().uuid(),
        phone: z.string().trim().min(3).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authoritative promo lookup — ignore client price/title.
    const { data: promo, error: promoErr } = await supabaseAdmin
      .from("promos")
      .select("id,title,price_brl,active")
      .eq("id", data.promoId)
      .maybeSingle();
    if (promoErr) throw promoErr;
    if (!promo || !promo.active) throw new Error("Promoción no disponible");

    const { data: inserted, error } = await supabaseAdmin.from("recargas_requests").insert({
      user_id: context.userId,
      phone: data.phone,
      promo_id: promo.id,
      promo_title: promo.title,
      price_brl: promo.price_brl,
      status: "pending",
    }).select("id").single();
    if (error) throw error;
    return { ok: true, id: inserted.id as string, priceBrl: Number(promo.price_brl) };
  });

/** El cliente informa un PIX. Sólo registra el aviso; no confirma fondos. */
export const reportTransactionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ trackingId: z.string().trim().min(1).max(60) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("id,user_id,status,payment_reported_at")
      .eq("tracking_id", data.trackingId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!tx) throw new Error("Remesa no encontrada");
    if (tx.payment_reported_at) return { ok: true, status: tx.status, already: true };
    if (tx.status !== "pending_payment" && tx.status !== "pending") {
      throw new Error("Esta remesa ya no admite avisos de pago");
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("transactions")
      .update({ payment_reported_at: new Date().toISOString(), status: "payment_reported" })
      .eq("id", tx.id)
      .eq("user_id", context.userId)
      .is("payment_reported_at", null)
      .select("status")
      .maybeSingle();
    if (updErr) throw updErr;
    return { ok: true, status: updated?.status ?? tx.status, already: !updated };
  });

// Alias temporal para exportaciones antiguas; conserva la nueva semántica segura.
export const markTransactionPaid = reportTransactionPayment;
