import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Crea una preferencia de pago en Mercado Pago para una transacción existente.
 * El monto y datos se recalculan server-side desde la tabla `transactions`; no
 * se confía en ningún valor enviado por el cliente.
 *
 * Requiere el secreto `MERCADOPAGO_ACCESS_TOKEN`.
 */
export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ transactionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error(
        "Mercado Pago no está configurado. Agrega el secreto MERCADOPAGO_ACCESS_TOKEN.",
      );
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
    if (tx.status !== "pending") throw new Error("La transacción no está pendiente de pago");

    const origin =
      process.env.PUBLIC_SITE_URL ||
      process.env.VITE_PUBLIC_SITE_URL ||
      process.env["PUBLIC_SITE_URL"] || "http://localhost:3000";

    const body = {
      external_reference: tx.tracking_id,
      items: [
        {
          id: tx.tracking_id,
          title: `Remesa ${tx.tracking_id} · ${tx.recipient_name}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(tx.total_brl),
        },
      ],
      back_urls: {
        success: `${origin}/transaction/${tx.id}`,
        pending: `${origin}/transaction/${tx.id}`,
        failure: `${origin}/transaction/${tx.id}`,
      },
      auto_return: "approved",
      notification_url: `${origin}/api/public/mercadopago/webhook`,
      metadata: { transaction_id: tx.id, user_id: tx.user_id },
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      message?: string;
    };
    if (!res.ok) {
      throw new Error(json.message || "Mercado Pago rechazó la preferencia");
    }

    // Guardar referencia para poder correlacionar con el webhook.
    await supabaseAdmin
      .from("transactions")
      .update({ payment_method: "mercadopago", notes: `mp_pref:${json.id}` })
      .eq("id", tx.id);

    const checkoutUrl = json.init_point || json.sandbox_init_point!;

    // Historial de pagos Mercado Pago (visible en el panel admin)
    await supabaseAdmin.from("mercadopago_payments").insert({
      transaction_id: tx.id,
      user_id: tx.user_id,
      tracking_id: tx.tracking_id,
      preference_id: json.id ?? null,
      checkout_url: checkoutUrl,
      internal_status: "created",
      amount: Number(tx.total_brl),
      currency: "BRL",
    });

    return {
      preferenceId: json.id!,
      checkoutUrl,
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

    // Modo mock: solo marca como processing sin llamar a nada externo.
    if (cfg.provider === "mock" || !cfg.api_base_url || !cfg.api_key_name) {
      await supabaseAdmin
        .from("recargas_requests")
        .update({ status: "processing", provider_ref: `mock-${Date.now()}` })
        .eq("id", req.id);
      return { ok: true, provider: "mock" };
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
