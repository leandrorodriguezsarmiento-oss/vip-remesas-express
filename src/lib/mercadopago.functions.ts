import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MercadoPagoPaymentMethod = {
  ticket_url?: string;
  qr_code?: string;
  qr_code_base64?: string;
};

type MercadoPagoOrder = {
  id?: string;
  message?: string;
  error?: string;
  cause?: Array<{ code?: string | number; description?: string }>;
  transactions?: {
    payments?: Array<{
      id?: string;
      status?: string;
      status_detail?: string;
      payment_method?: MercadoPagoPaymentMethod;
    }>;
  };
};

async function getMercadoPagoOrder(accessToken: string, orderId: string): Promise<MercadoPagoOrder> {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = (await response.json().catch(() => ({}))) as MercadoPagoOrder;
  if (!response.ok) {
    const cause = json.cause?.map((item) => `${item.code ?? ""} ${item.description ?? ""}`.trim()).filter(Boolean).join(" | ");
    const detail = cause || json.message || json.error || `HTTP ${response.status}`;
    throw new Error(`Mercado Pago no pudo consultar la Order ${orderId}: ${detail}`);
  }
  return json;
}

async function resolveMercadoPagoPayment(accessToken: string, order: MercadoPagoOrder): Promise<{
  checkoutUrl: string | null;
  pixCode: string | null;
  qrCodeBase64: string | null;
  paymentId: string | null;
  status: string | null;
  statusDetail: string | null;
}> {
  let current = order;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const payment = current.transactions?.payments?.[0];
    const method = payment?.payment_method;
    const pixCode = method?.qr_code?.trim() || null;

    if (pixCode) {
      return {
        checkoutUrl: method?.ticket_url?.trim() || null,
        pixCode,
        qrCodeBase64: method?.qr_code_base64?.trim() || null,
        paymentId: payment?.id ?? null,
        status: payment?.status ?? null,
        statusDetail: payment?.status_detail ?? null,
      };
    }

    if (!current.id || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 700));
    current = await getMercadoPagoOrder(accessToken, current.id);
  }

  const payment = current.transactions?.payments?.[0];
  throw new Error(
    `Mercado Pago creó la Order ${current.id ?? ""}, pero todavía no devolvió qr_code PIX. Estado: ${payment?.status ?? "desconocido"}; detalle: ${payment?.status_detail ?? "desconocido"}.`,
  );
}

/** Crea una Order PIX real de Mercado Pago para una transacción existente. */
export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new Error("Mercado Pago no está configurado en el runtime de Cloudflare: falta MERCADOPAGO_ACCESS_TOKEN.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("id,user_id,tracking_id,total_brl,recipient_name,status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error) throw error;
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.user_id !== context.userId) throw new Error("No autorizado");
    if (tx.status !== "pending_payment" && tx.status !== "pending") {
      throw new Error("La transacción no está pendiente de pago");
    }

    const { data: existing } = await supabaseAdmin
      .from("mercadopago_payments")
      .select("order_id,checkout_url,qr_code")
      .eq("transaction_id", tx.id)
      .eq("internal_status", "created")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.order_id && existing.qr_code) {
      return {
        preferenceId: existing.order_id,
        checkoutUrl: existing.checkout_url ?? null,
        pixCode: existing.qr_code,
        qrCodeBase64: null,
      };
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(tx.user_id);
    if (authError) throw authError;
    const payerEmail = authUser.user?.email?.trim();
    if (!payerEmail) throw new Error("El usuario no tiene un email válido para Mercado Pago");

    const amount = Number(tx.total_brl);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto de pago inválido");

    const body = {
      type: "online",
      external_reference: tx.tracking_id,
      total_amount: amount.toFixed(2),
      description: `Remesa ${tx.tracking_id}`,
      processing_mode: "automatic",
      transactions: {
        payments: [{
          amount: amount.toFixed(2),
          payment_method: { id: "pix", type: "bank_transfer" },
        }],
      },
      payer: { email: payerEmail },
    };

    const res = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `vip-remesa-${tx.id}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as MercadoPagoOrder;

    if (!res.ok || !json.id) {
      const cause = json.cause?.map((item) => `${item.code ?? ""} ${item.description ?? ""}`.trim()).filter(Boolean).join(" | ");
      const detail = cause || json.message || json.error || `HTTP ${res.status}`;
      throw new Error(`Mercado Pago rechazó la Order: ${detail}`);
    }

    const resolved = await resolveMercadoPagoPayment(accessToken, json);
    const checkoutUrl = resolved.checkoutUrl;
    const pixCode = resolved.pixCode;

    const { error: txUpdateError } = await supabaseAdmin.from("transactions")
      .update({ payment_method: "mercadopago", notes: `mp_order:${json.id}` })
      .eq("id", tx.id);
    if (txUpdateError) throw txUpdateError;

    const { error: insertError } = await supabaseAdmin.from("mercadopago_payments").insert({
      transaction_id: tx.id,
      user_id: tx.user_id,
      tracking_id: tx.tracking_id,
      order_id: json.id,
      preference_id: json.id,
      checkout_url: checkoutUrl,
      qr_code: pixCode,
      mp_payment_id: resolved.paymentId,
      mp_status: resolved.statusDetail ? `${resolved.status ?? ""}:${resolved.statusDetail}`.replace(/^:/, "") : resolved.status,
      internal_status: "created",
      amount,
      currency: "BRL",
    });
    if (insertError) throw insertError;

    return {
      preferenceId: json.id,
      checkoutUrl,
      pixCode,
      qrCodeBase64: resolved.qrCodeBase64,
    };
  });
