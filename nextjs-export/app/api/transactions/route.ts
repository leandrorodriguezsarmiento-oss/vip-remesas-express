import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generatePixCode, generateTrackingId } from "@/lib/remittance";

const ORIGIN_CURRENCY: Record<string, string> = { BR: "BRL", EU: "EUR", US: "USD" };
const PAYMENT_METHOD: Record<string, string> = { BR: "pix", US: "zelle", EU: "sepa" };

const bodySchema = z.object({
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
  saveRecipient: z.boolean().optional(),
});

export async function POST(req: Request) {
  // 1) Validate session (cookie-based, no client-supplied user_id).
  const supabase = await getSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = userRes.user.id;

  // 2) Validate payload.
  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bad request" }, { status: 400 });
  }

  // 3) Look up authoritative rate.
  const { data: rateRow, error: rateErr } = await supabaseAdmin
    .from("rates")
    .select("*")
    .eq("origin_country", payload.origin)
    .eq("method_category", payload.method)
    .eq("dest_currency", payload.currency)
    .eq("active", true)
    .maybeSingle();
  if (rateErr) return NextResponse.json({ error: rateErr.message }, { status: 500 });
  if (!rateRow) return NextResponse.json({ error: "Tasa no disponible" }, { status: 400 });

  const minAmount = Number(rateRow.min_amount ?? 0);
  if (payload.amount < minAmount) {
    return NextResponse.json({ error: `Monto mínimo: ${minAmount}` }, { status: 400 });
  }

  // 4) Recompute money values server-side. Ignore any client-supplied numbers.
  const rate = Number(rateRow.rate);
  const amountDest = +(payload.amount * rate).toFixed(2);
  const originCurrency = ORIGIN_CURRENCY[payload.origin];
  const paymentMethod = PAYMENT_METHOD[payload.origin];
  const trackingId = generateTrackingId();
  const pixCode = payload.origin === "BR" ? generatePixCode(trackingId, payload.amount) : null;

  const { error: insertErr } = await supabaseAdmin.from("transactions").insert({
    user_id: userId,
    tracking_id: trackingId,
    origin_country: payload.origin,
    origin_currency: originCurrency,
    destination_country: "Cuba",
    method_category: payload.method,
    delivery_method: payload.currency,
    recipient_name: payload.recipient.name,
    recipient_phone: payload.recipient.phone,
    recipient_card: payload.recipient.card || null,
    notes: payload.recipient.notes || null,
    amount_brl: payload.amount,
    amount_dest: amountDest,
    dest_currency: payload.currency,
    exchange_rate: rate,
    fee_brl: 0,
    total_brl: payload.amount,
    payment_method: paymentMethod,
    pix_code: pixCode,
    status: "pending",
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 5) Optionally save recipient (client-writable via RLS; keep here to reuse the session).
  if (payload.saveRecipient && payload.recipient.name) {
    await supabase.from("recipients").insert({
      user_id: userId,
      full_name: payload.recipient.name,
      phone: payload.recipient.phone,
      country: "CU",
      delivery_method: `${payload.method}·${payload.currency}`,
      account_details: payload.recipient.card || null,
    });
  }

  return NextResponse.json({ trackingId, pixCode, amountDest, rate });
}
