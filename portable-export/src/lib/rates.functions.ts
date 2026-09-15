import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createRateAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    origin_country: string;
    origin_currency: string;
    method_category: string;
    dest_currency: string;
    rate: number;
    time_min_minutes: number;
    time_max_minutes: number;
    min_amount: number;
    active: boolean;
  }) => {
    if (!input?.origin_country || !input.origin_currency || !input.method_category || !input.dest_currency) {
      throw new Error("País, moneda de origen, método y moneda destino son obligatorios");
    }
    if (!Number.isFinite(input.rate) || input.rate <= 0) throw new Error("La tasa debe ser mayor que 0");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Solo el administrador puede crear tasas");

    const { data: row, error } = await supabaseAdmin
      .from("rates")
      .insert({
        origin_country: data.origin_country.trim().toUpperCase(),
        origin_currency: data.origin_currency.trim().toUpperCase(),
        method_category: data.method_category.trim().toLowerCase(),
        dest_currency: data.dest_currency.trim().toUpperCase(),
        rate: data.rate,
        time_min_minutes: data.time_min_minutes,
        time_max_minutes: data.time_max_minutes,
        min_amount: data.min_amount,
        active: data.active,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
