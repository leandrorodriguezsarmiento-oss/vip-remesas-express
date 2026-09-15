import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Crea una Order PIX real de Mercado Pago para una transacción existente. */
export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Mercado Pago no está configurado. Agrega MERCADOPAGO_ACCESS_TOKEN.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("id,user_id,tracking_id,total_brl,recipient_name,status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error) throw error;
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.user_id !== context.userId) throw new Error("No autorizado");
    if (tx.status !== "pending_payment" && tx.status !== "pending") throw new Error("La transacción no está pendiente de pago");

    const { data: existing } = await supabaseAdmin
      .from("mercadopago_payments")
      .select("order_id,checkout_url,qr_code")
      .eq("transaction_id", tx.id)
      .eq("internal_status", "created")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.order_id && existing.checkout_url && existing.qr_code) {
      return { preferenceId: existing.order_id, checkoutUrl: existing.checkout_url, pixCode: existing.qr_code };
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(tx.user_id);
    if (authError) throw authError;
    const payerEmail = authUser.user?.email;
    if (!payerEmail) throw new Error("El usuario no tiene un email válido para Mercado Pago");

    const amount = Number(tx.total_brl);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto de pago inválido");

    const siteUrl = process.env.PUBLIC_SITE_URL;
    if (!siteUrl || !siteUrl.startsWith("https://")) throw new Error("Falta configurar PUBLIC_SITE_URL con HTTPS");

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
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `vip-remesa-${tx.id}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      transactions?: { payments?: Array<{ payment_method?: { ticket_url?: string; qr_code?: string; qr_code_base64?: string } }> };
    };
    if (!res.ok || !json.id) throw new Error(json.message || `Mercado Pago rechazó la Order (HTTP ${res.status})`);

    const payment = json.transactions?.payments?.[0];
    const checkoutUrl = payment?.payment_method?.ticket_url;
    const pixCode = payment?.payment_method?.qr_code;
    if (!checkoutUrl || !pixCode) throw new Error("Mercado Pago no devolvió el QR PIX esperado");

    await supabaseAdmin.from("transactions")
      .update({ payment_method: "mercadopago", notes: `mp_order:${json.id}` })
      .eq("id", tx.id);

    const { error: insertError } = await supabaseAdmin.from("mercadopago_payments").insert({
      transaction_id: tx.id,
      user_id: tx.user_id,
      tracking_id: tx.tracking_id,
      order_id: json.id,
      preference_id: json.id,
      checkout_url: checkoutUrl,
      qr_code: pixCode,
      internal_status: "created",
      amount,
      currency: "BRL",
    });
    if (insertError) throw insertError;

    return {
      preferenceId: json.id,
      checkoutUrl,
      pixCode,
      qrCodeBase64: payment?.payment_method?.qr_code_base64 ?? null,
    };
  });
