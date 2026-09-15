import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: string;
      cause?: Array<{ code?: string | number; description?: string }>;
      transactions?: {
        payments?: Array<{
          payment_method?: {
            ticket_url?: string;
            qr_code?: string;
            qr_code_base64?: string;
          };
        }>;
      };
    };

    if (!res.ok || !json.id) {
      const cause = json.cause?.map((item) => `${item.code ?? ""} ${item.description ?? ""}`.trim()).filter(Boolean).join(" | ");
      const detail = cause || json.message || json.error || `HTTP ${res.status}`;
      throw new Error(`Mercado Pago rechazó la Order: ${detail}`);
    }

    const payment = json.transactions?.payments?.[0];
    const checkoutUrl = payment?.payment_method?.ticket_url ?? null;
    const pixCode = payment?.payment_method?.qr_code;
    if (!pixCode) {
      throw new Error("Mercado Pago creó la Order, pero no devolvió qr_code PIX.");
    }

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
