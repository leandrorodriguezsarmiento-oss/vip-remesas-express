import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRole) throw new Error("La cuenta administradora no puede eliminarse desde Ajustes");

    await supabaseAdmin.from("organizer_permissions").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(`No se pudo eliminar la cuenta: ${error.message}`);

    return { ok: true };
  });
