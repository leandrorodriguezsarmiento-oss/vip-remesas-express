import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Crea un pedido de comida. El servidor es la única fuente de verdad:
 * verifica que el restaurante esté aprobado y activo y recalcula el total
 * con los precios reales del menú, ignorando cualquier monto del cliente.
 */
export const createFoodOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        restaurantId: z.string().uuid(),
        customer: z.object({
          name: z.string().trim().min(2).max(120),
          phone: z.string().trim().min(6).max(40),
          address: z.string().trim().min(8).max(300),
          notes: z.string().trim().max(400).optional().nullable(),
        }),
        items: z
          .array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(50) }))
          .min(1)
          .max(40),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rest, error: restErr } = await supabaseAdmin
      .from("restaurants")
      .select("id,name,br_state,city,approved,active")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (restErr) throw restErr;
    if (!rest || !rest.approved || !rest.active) throw new Error("Restaurante no disponible");

    const ids = data.items.map((i) => i.id);
    const { data: menu, error: menuErr } = await supabaseAdmin
      .from("food_items")
      .select("id,title,price_brl,available")
      .eq("restaurant_id", rest.id)
      .in("id", ids);
    if (menuErr) throw menuErr;

    const lines = data.items.map((line) => {
      const item = (menu ?? []).find((m) => m.id === line.id);
      if (!item || !item.available) throw new Error("Un plato del pedido ya no está disponible");
      return { id: item.id, title: item.title, qty: line.qty, price_brl: Number(item.price_brl) };
    });
    const total = +lines.reduce((s, l) => s + l.price_brl * l.qty, 0).toFixed(2);
    if (total <= 0) throw new Error("El pedido está vacío");

    const { data: inserted, error } = await supabaseAdmin
      .from("food_orders")
      .insert({
        user_id: context.userId,
        restaurant_id: rest.id,
        restaurant_name: rest.name,
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        customer_address: data.customer.address,
        br_state: rest.br_state,
        city: rest.city,
        items: lines,
        total_brl: total,
        notes: data.customer.notes || null,
        status: "pending",
      })
      .select("order_no")
      .single();
    if (error) throw error;

    return { ok: true, orderNo: Number(inserted.order_no), total };
  });
