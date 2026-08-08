import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Activa o quita el rol de organizador (sólo el admin dueño puede hacerlo). */
export const setOrganizerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; enabled: boolean }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId requerido");
    if (typeof input.enabled !== "boolean") throw new Error("enabled requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("No se pudo verificar rol");
    if (!isAdmin) throw new Error("Solo el admin puede asignar organizadores");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: "organizador" });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "organizador");
      if (error) throw new Error(error.message);
    }
    return { ok: true, enabled: data.enabled };
  });


export const deleteUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") {
      throw new Error("userId requerido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    // Verificar que el llamador es admin
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("No se pudo verificar rol");
    if (!isAdmin) throw new Error("Solo admin puede eliminar usuarios");
    if (data.userId === context.userId) {
      throw new Error("No puedes eliminar tu propia cuenta admin");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
