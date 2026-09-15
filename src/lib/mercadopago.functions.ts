import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MercadoPagoPaymentMethod = { ticket_url?: string; qr_code?: string; qr_code_base64?: string };
type MercadoPagoOrder = { id?: string; message?: string; error?: string; cause?: Array<{ code?: string | number; description?: string }>; transactions?: { payments?: Array<{ id?: string; status?: string; status_detail?: string; payment_method?: MercadoPagoPaymentMethod }> } };

async function fetchMercadoPago(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try { return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Mercado Pago no respondió en 6 segundos. La API está tardando o el Access Token no está respondiendo.");
    throw error;
  } finally { clearTimeout(timeout); }
}

async function getMercadoPagoOrder(accessToken: string, orderId: string): Promise<MercadoPagoOrder> {
  console.log(JSON.stringify({ event: "mp_order_get_start", orderId }));
  const response = await fetchMercadoPago(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` } });
  const json = (await response.json().catch(() => ({}))) as MercadoPagoOrder;
  console.log(JSON.stringify({ event: "mp_order_get_result", orderId, httpStatus: response.status, hasPix: Boolean(json.transactions?.payments?.[0]?.payment_method?.qr_code), status: json.transactions?.payments?.[0]?.status, statusDetail: json.transactions?.payments?.[0]?.status_detail }));
  if (!response.ok) {
    const cause = json.cause?.map((item) => `${item.code ?? ""} ${item.description ?? ""}`.trim()).filter(Boolean).join(" | ");
    throw new Error(`Mercado Pago no pudo consultar la Order ${orderId}: ${cause || json.message || json.error || `HTTP ${response.status}`}`);
  }
  return json;
}

async function resolveMercadoPagoPayment(accessToken: string, order: MercadoPagoOrder) {
  let current = order;
  const payment = current.transactions?.payments?.[0];
  const method = payment?.payment_method;
  const initialPix = method?.qr_code?.trim() || null;
  if (initialPix) return { checkoutUrl: method?.ticket_url?.trim() || null, pixCode: initialPix, qrCodeBase64: method?.qr_code_base64?.trim() || null, paymentId: payment?.id ?? null, status: payment?.status ?? null, statusDetail: payment?.status_detail ?? null };
  if (current.id) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    current = await getMercadoPagoOrder(accessToken, current.id);
    const updated = current.transactions?.payments?.[0];
    const updatedMethod = updated?.payment_method;
    const pixCode = updatedMethod?.qr_code?.trim() || null;
    if (pixCode) return { checkoutUrl: updatedMethod?.ticket_url?.trim() || null, pixCode, qrCodeBase64: updatedMethod?.qr_code_base64?.trim() || null, paymentId: updated?.id ?? null, status: updated?.status ?? null, statusDetail: updated?.status_detail ?? null };
  }
  const finalPayment = current.transactions?.payments?.[0];
  throw new Error(`Mercado Pago creó la Order ${current.id ?? ""}, pero todavía no entregó el PIX. Estado: ${finalPayment?.status ?? "desconocido"}; detalle: ${finalPayment?.status_detail ?? "desconocido"}.`);
}

export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!accessToken) throw new Error("Mercado Pago no está configurado en Cloudflare: falta MERCADOPAGO_ACCESS_TOKEN.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await supabaseAdmin.from("transactions").select("id,user_id,tracking_id,total_brl,recipient_name,status").eq("id", data.transactionId).maybeSingle();
    if (error) throw error;
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.user_id !== context.userId) throw new Error("No autorizado");
    if (tx.status !== "pending_payment" && tx.status !== "pending") throw new Error("La transacción no está pendiente de pago");
    const { data: existing } = await supabaseAdmin.from("mercadopago_payments").select("order_id,checkout_url,qr_code").eq("transaction_id", tx.id).eq("internal_status", "created").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.order_id && existing.qr_code) return { preferenceId: existing.order_id, checkoutUrl: existing.checkout_url ?? null, pixCode: existing.qr_code, qrCodeBase64: null };
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(tx.user_id);
    if (authError) throw authError;
    const payerEmail = authUser.user?.email?.trim();
    if (!payerEmail) throw new Error("El usuario no tiene un email válido para Mercado Pago");
    const amount = Number(tx.total_brl);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto de pago inválido");
    const body = { type: "online", external_reference: tx.tracking_id, total_amount: amount.toFixed(2), description: `Remesa ${tx.tracking_id}`, processing_mode: "automatic", transactions: { payments: [{ amount: amount.toFixed(2), payment_method: { id: "pix", type: "bank_transfer" } }] }, payer: { email: payerEmail } };
    console.log(JSON.stringify({ event: "mp_order_post_start", trackingId: tx.tracking_id, amount }));
    const res = await fetchMercadoPago("https://api.mercadopago.com/v1/orders", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": `vip-remesa-${tx.id}` }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as MercadoPagoOrder;
    console.log(JSON.stringify({ event: "mp_order_post_result", trackingId: tx.tracking_id, httpStatus: res.status, orderId: json.id, hasPix: Boolean(json.transactions?.payments?.[0]?.payment_method?.qr_code), status: json.transactions?.payments?.[0]?.status, statusDetail: json.transactions?.payments?.[0]?.status_detail }));
    if (!res.ok || !json.id) {
      const cause = json.cause?.map((item) => `${item.code ?? ""} ${item.description ?? ""}`.trim()).filter(Boolean).join(" | ");
      throw new Error(`Mercado Pago rechazó la Order: ${cause || json.message || json.error || `HTTP ${res.status}`}`);
    }
    const resolved = await resolveMercadoPagoPayment(accessToken, json);
    const { error: txUpdateError } = await supabaseAdmin.from("transactions").update({ payment_method: "mercadopago", notes: `mp_order:${json.id}` }).eq("id", tx.id);
    if (txUpdateError) throw txUpdateError;
    const { error: insertError } = await supabaseAdmin.from("mercadopago_payments").insert({ transaction_id: tx.id, user_id: tx.user_id, tracking_id: tx.tracking_id, order_id: json.id, preference_id: json.id, checkout_url: resolved.checkoutUrl, qr_code: resolved.pixCode, mp_payment_id: resolved.paymentId, mp_status: resolved.statusDetail ? `${resolved.status ?? ""}:${resolved.statusDetail}`.replace(/^:/, "") : resolved.status, internal_status: "created", amount, currency: "BRL" });
    if (insertError) throw insertError;
    return { preferenceId: json.id, checkoutUrl: resolved.checkoutUrl, pixCode: resolved.pixCode, qrCodeBase64: resolved.qrCodeBase64 };
  });
