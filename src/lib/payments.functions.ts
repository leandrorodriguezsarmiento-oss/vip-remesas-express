import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Crea una Order de Mercado Pago para una transacción existente.
 * El monto y los datos se recalculan server-side desde `transactions`.
 * Para Brasil genera PIX real: QR, copia y pega y link de pago.
 */
export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ transactionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("Mercado Pago no está configurado. Agrega el secreto MERCADOPAGO_ACCESS_TOKEN.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("id,user_id,tracking_id,amount_brl,total_brl,recipient_name,status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error) throw error;
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.user_id !== context.userId) throw new Error("No autorizado");
    if (tx.status !== "pending_payment" && tx.status !== "pending") {
      throw new Error("La transacción no está pendiente de pago");
    }

    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(tx.user_id);
    if (authUserError) throw authUserError;
    const payerEmail = authUser.user?.email;
    if (!payerEmail) throw new Error("El usuario no tiene un email válido para Mercado Pago");

    const { data: existing } = await supabaseAdmin
      .from("mercadopago_payments")
      .select("order_id,preference_id,checkout_url,qr_code")
      .eq("transaction_id", tx.id)
      .eq("internal_status", "created")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.order_id && existing.checkout_url && existing.qr_code) {
      return {
        preferenceId: existing.order_id,
        checkoutUrl: existing.checkout_url,
        pixCode: existing.qr_code,
      };
    }

    const siteUrl = process.env.PUBLIC_SITE_URL;
    if (!siteUrl || !siteUrl.startsWith("https://")) {
      throw new Error("Falta configurar PUBLIC_SITE_URL con el dominio HTTPS");
    }

    const amount = Number(tx.total_brl);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto de pago inválido");

    // La misma clave para la misma transacción evita duplicar una Order si
    // el navegador reintenta por timeout o doble clic.
    const idempotencyKey = `vip-remesa-${tx.id}`;
    const body = {
      type: "online",
      external_reference: tx.tracking_id,
      total_amount: amount.toFixed(2),
      description: `Remesa ${tx.tracking_id}`,
      processing_mode: "automatic",
      transactions: {
        payments: [
          {
            amount: amount.toFixed(2),
            payment_method: {
              id: "pix",
              type: "bank_transfer",
            },
          },
        ],
      },
      payer: { email: payerEmail },
      notification_url: `${siteUrl}/api/public/mercadopago/webhook`,
    };

    const res = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      transactions?: {
        payments?: Array<{
          id?: string;
          status?: string;
          status_detail?: string;
          payment_method?: {
            ticket_url?: string;
            qr_code?: string;
            qr_code_base64?: string;
          };
        }>;
      };
    };
    if (!res.ok || !json.id) {
      throw new Error(json.message || `Mercado Pago rechazó la Order (HTTP ${res.status})`);
    }

    const payment = json.transactions?.payments?.[0];
    const checkoutUrl = payment?.payment_method?.ticket_url;
    const qrCode = payment?.payment_method?.qr_code;
    if (!checkoutUrl || !qrCode) {
      throw new Error("Mercado Pago creó la Order pero no devolvió el PIX esperado");
    }

    await supabaseAdmin
      .from("transactions")
      .update({ payment_method: "mercadopago", notes: `mp_order:${json.id}` })
      .eq("id", tx.id);

    const { error: insertError } = await supabaseAdmin.from("mercadopago_payments").insert({
      transaction_id: tx.id,
      user_id: tx.user_id,
      tracking_id: tx.tracking_id,
      order_id: json.id,
      preference_id: json.id,
      checkout_url: checkoutUrl,
      qr_code: qrCode,
      internal_status: "created",
      amount,
      currency: "BRL",
    });
    if (insertError) throw insertError;

    return {
      preferenceId: json.id,
      checkoutUrl,
      pixCode: qrCode,
      qrCodeBase64: payment?.payment_method?.qr_code_base64 ?? null,
    };
  });


/**
 * Reenvía manualmente una solicitud de recarga al proveedor configurado
 * (tabla `recargas_config`). Solo admin. El proveedor se identifica por
 * `provider` y la clave se lee del secreto nombrado en `api_key_name`.
 */
export const dispatchRechargeToProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ requestId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Solo admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Solo admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("recargas_config")
      .select("provider,api_base_url,api_key_name,active")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) throw new Error("No hay proveedor de recargas activo");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("recargas_requests")
      .select("id,phone,promo_title,price_brl,status,provider_ref")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!req) throw new Error("Recarga no encontrada");
    if (req.status !== "pending") throw new Error("La recarga ya fue procesada");

    if (cfg.provider === "mock" || !cfg.api_base_url || !cfg.api_key_name) {
      throw new Error("Proveedor real de recargas no configurado; la solicitud continúa pendiente");
    }

    const apiKey = process.env[cfg.api_key_name];
    if (!apiKey) {
      throw new Error(
        `Falta el secreto ${cfg.api_key_name} para el proveedor ${cfg.provider}`,
      );
    }

    // Contrato genérico: POST {baseUrl}/recharge  { phone, amount_brl, external_ref }
    const res = await fetch(`${cfg.api_base_url.replace(/\/$/, "")}/recharge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phone: req.phone,
        amount_brl: Number(req.price_brl),
        product: req.promo_title,
        external_ref: req.id,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      message?: string;
    };
    if (!res.ok) {
      await supabaseAdmin
        .from("recargas_requests")
        .update({ status: "rejected", notes: json.message || `HTTP ${res.status}` })
        .eq("id", req.id);
      throw new Error(json.message || `Proveedor respondió ${res.status}`);
    }

    await supabaseAdmin
      .from("recargas_requests")
      .update({
        status: json.status === "completed" ? "completed" : "processing",
        provider_ref: json.id ?? null,
      })
      .eq("id", req.id);

    return { ok: true, provider: cfg.provider, providerRef: json.id ?? null };
  });

/**
 * Botón "Sincronizar" del panel admin: despacha las recargas pendientes al
 * proveedor real y consulta las que están en proceso hasta completarlas.
 */
export const syncRecharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Solo admin");
    const { syncAllRecharges } = await import("@/lib/recargas.server");
    return await syncAllRecharges();
  });