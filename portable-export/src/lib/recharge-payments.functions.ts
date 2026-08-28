import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Crea una preferencia de pago en Mercado Pago para una recarga Cubacel.
 * El precio se lee siempre de la base de datos (nunca del cliente).
 */
export const createRechargePreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ rechargeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
    if (!accessToken) {
      throw new Error("Mercado Pago no está configurado todavía.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin
      .from("recargas_requests")
      .select("id,user_id,promo_title,price_brl,phone,status")
      .eq("id", data.rechargeId)
      .maybeSingle();
    if (error) throw error;
    if (!r) throw new Error("Recarga no encontrada");
    if (r.user_id !== context.userId) throw new Error("No autorizado");
    if (r.status !== "pending") throw new Error("Esta recarga ya está en proceso");

    const origin =
      process.env["PUBLIC_SITE_URL"] || process.env["PUBLIC_SITE_URL"] || "http://localhost:3000";

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        external_reference: `recarga-${r.id}`,
        items: [
          {
            id: r.id,
            title: `Recarga ${r.promo_title} · ${r.phone}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(r.price_brl),
          },
        ],
        back_urls: { success: `${origin}/recargas`, pending: `${origin}/recargas`, failure: `${origin}/recargas` },
        auto_return: "approved",
        notification_url: `${origin}/api/public/mercadopago/webhook`,
        metadata: { recharge_id: r.id, user_id: r.user_id },
      }),
    });
    const json = (await res.json()) as {
      init_point?: string;
      sandbox_init_point?: string;
      message?: string;
    };
    if (!res.ok) throw new Error(json.message || "Mercado Pago rechazó el pago");

    return { checkoutUrl: json.init_point || json.sandbox_init_point || "" };
  });
