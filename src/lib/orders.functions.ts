import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generatePixCode, generateTrackingId } from "@/lib/remittance";

const ORIGIN_CURRENCY: Record<string, string> = { BR: "BRL", EU: "EUR", US: "USD" };
const PAYMENT_METHOD: Record<string, string> = { BR: "pix", US: "zelle", EU: "sepa" };

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        origin: z.enum(["BR", "EU", "US"]),
        method: z.enum(["transferencia", "efectivo"]),
        currency: z.enum(["CUP", "MLC", "USD"]),
        amount: z.number().positive().max(1_000_000),
        recipient: z.object({
          name: z.string().trim().min(1).max(120),
          phone: z.string().trim().min(3).max(40),
          card: z.string().trim().max(60).optional().nullable(),
          notes: z.string().trim().max(500).optional().nullable(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Look up authoritative rate server-side.
    const { data: rateRow, error: rateErr } = await supabaseAdmin
      .from("rates")
      .select("*")
      .eq("origin_country", data.origin)
      .eq("method_category", data.method)
      .eq("dest_currency", data.currency)
      .eq("active", true)
      .maybeSingle();
    if (rateErr) throw rateErr;
    if (!rateRow) throw new Error("Tasa no disponible para esta combinación");

    const minAmount = Number(rateRow.min_amount ?? 0);
    if (data.amount < minAmount) {
      throw new Error(`Monto mínimo: ${minAmount}`);
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
        notes: data.recipient.notes || null,
        amount_brl: data.amount,
        amount_dest: amountDest,
        dest_currency: data.currency,
        exchange_rate: rate,
        fee_brl: 0,
        total_brl: data.amount,
        payment_method: paymentMethod,
        pix_code: pixCode,
        status: "pending",
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

    const { error } = await supabaseAdmin.from("recargas_requests").insert({
      user_id: context.userId,
      phone: data.phone,
      promo_id: promo.id,
      promo_title: promo.title,
      price_brl: promo.price_brl,
      status: "pending",
    });
    if (error) throw error;
    return { ok: true };
  });
