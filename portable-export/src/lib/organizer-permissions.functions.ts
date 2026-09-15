import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const ORGANIZER_PERMISSIONS = ["remesas", "recargas", "tienda"] as const;
type OrganizerPermission = (typeof ORGANIZER_PERMISSIONS)[number];

const permissionSchema = z.enum(ORGANIZER_PERMISSIONS);
const updateSchema = z.object({
  userId: z.string().uuid(),
  permissions: z.array(permissionSchema).max(ORGANIZER_PERMISSIONS.length),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("No se pudo verificar el rol");
  if (!data) throw new Error("Solo el administrador puede gestionar permisos");
}

export const getOrganizerPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("organizer_permissions")
      .select("permission")
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.permission as OrganizerPermission);
  });

export const setOrganizerPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("El administrador no necesita permisos de organizador");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isOrganizer, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: data.userId,
      _role: "organizador",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isOrganizer) throw new Error("El usuario no es organizador");

    const { error: deleteError } = await supabaseAdmin
      .from("organizer_permissions")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);

    if (data.permissions.length) {
      const { error: insertError } = await supabaseAdmin
        .from("organizer_permissions")
        .insert(data.permissions.map((permission) => ({ user_id: data.userId, permission })));
      if (insertError) throw new Error(insertError.message);
    }
    return { ok: true, permissions: data.permissions };
  });
