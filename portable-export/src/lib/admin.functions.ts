import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const transactionActionSchema = z.object({
  transactionId: z.string().uuid(),
  action: z.enum(["confirm_payment", "start_processing", "complete", "reject"]),
  assignedTo: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(300).optional(),
});

class WorkflowRuleError extends Error {}
const rule = (message: string): never => { throw new WorkflowRuleError(message); };

type WorkflowResult =
  | { ok: true; status: "payment_confirmed" | "processing" | "completed" | "rejected" }
  | { ok: false; message: string };

export const updateTransactionWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => {
    const parsed = transactionActionSchema.safeParse(input);
    if (!parsed.success) throw new WorkflowRuleError("Datos inválidos para esta acción");
    return parsed.data;
  })
  .handler(async ({ data, context }): Promise<WorkflowResult> => {
   try {
    const [{ data: isAdmin }, { data: isOrganizer }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "organizador" }),
    ]);
    if (!isAdmin && !isOrganizer) rule("No autorizado");
    if (!isAdmin) {
      const { data: canRemesas, error: permissionError } = await context.supabase.rpc("has_organizer_permission", { _user_id: context.userId, _permission: "remesas" });
      if (permissionError) throw new Error("No se pudo verificar el permiso de remesas");
      if (!canRemesas) rule("No tienes permiso para gestionar remesas");
    }
    if (!isAdmin && !["complete", "reject"].includes(data.action)) rule("Solo el administrador puede confirmar pagos o asignar remesas");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await supabaseAdmin.from("transactions").select("id,status,assigned_to,payment_reported_at,payment_confirmed_at").eq("id", data.transactionId).maybeSingle();
    if (error) throw error;
    if (!tx) rule("Remesa no encontrada");
    if (!isAdmin && tx!.assigned_to !== context.userId) rule("Esta remesa no está asignada a ti");

    const now = new Date().toISOString();
    const current = tx!.status;
    let toStatus: "payment_confirmed" | "processing" | "completed" | "rejected";
    let patch: { status: "payment_confirmed" | "processing" | "completed" | "rejected"; paid_at?: string; payment_confirmed_at?: string; payment_confirmed_by?: string; assigned_to?: string; payment_rejected_at?: string; payment_rejection_reason?: string };
    if (data.action === "confirm_payment") {
      if (current !== "payment_reported" || !tx!.payment_reported_at) rule("El cliente aún no informó este pago");
      toStatus = "payment_confirmed";
      patch = { status: toStatus, paid_at: now, payment_confirmed_at: now, payment_confirmed_by: context.userId };
    } else if (data.action === "start_processing") {
      if (current !== "payment_confirmed" || !tx!.payment_confirmed_at) rule("Primero confirma el pago recibido");
      if (!data.assignedTo) rule("Elige un organizador");
      toStatus = "processing";
      patch = { status: toStatus, assigned_to: data.assignedTo! };
    } else if (data.action === "complete") {
      if (current !== "processing") rule("La remesa debe estar en proceso");
      toStatus = "completed";
      patch = { status: toStatus };
    } else {
      if (!["payment_reported", "payment_confirmed", "processing"].includes(current)) rule("Esta remesa no se puede rechazar");
      const reason = (data.reason ?? "").trim();
      if (reason.length < 3) rule("Escribe un motivo de al menos 3 caracteres");
      toStatus = "rejected";
      patch = { status: toStatus, payment_rejected_at: now, payment_rejection_reason: reason };
    }

    const { error: updateError } = await supabaseAdmin.from("transactions").update(patch).eq("id", tx!.id).eq("status", current);
    if (updateError) throw updateError;
    const { error: auditError } = await supabaseAdmin.from("transaction_audit_log").insert({ transaction_id: tx!.id, actor_id: context.userId, action: data.action, from_status: current, to_status: toStatus, details: { assigned_to: data.assignedTo ?? null, reason: data.reason ?? null } });
    if (auditError) throw auditError;
    return { ok: true, status: toStatus };
   } catch (e) {
     if (e instanceof WorkflowRuleError) return { ok: false, message: e.message };
     throw e;
   }
  });

export const setOrganizerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; enabled: boolean }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId requerido");
    if (typeof input.enabled !== "boolean") throw new Error("enabled requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw new Error("No se pudo verificar rol");
    if (!isAdmin) throw new Error("Solo el admin puede asignar organizadores");
    if (data.userId === context.userId) throw new Error("No puedes cambiar tu propio rol admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "organizador" });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
      return { ok: true, enabled: true, permissionsConfigured: false };
    }
    const { error: permissionError } = await supabaseAdmin.from("organizer_permissions").delete().eq("user_id", data.userId);
    if (permissionError) throw new Error(permissionError.message);
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "organizador");
    if (error) throw new Error(error.message);
    return { ok: true, enabled: false, permissionsConfigured: false };
  });

export const deleteUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw new Error("No se pudo verificar rol");
    if (!isAdmin) throw new Error("Solo admin puede eliminar usuarios");
    if (data.userId === context.userId) throw new Error("No puedes eliminar tu propia cuenta admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: permissionsError } = await supabaseAdmin.from("organizer_permissions").delete().eq("user_id", data.userId);
    if (permissionsError) throw new Error(`No se pudieron limpiar los permisos del usuario: ${permissionsError.message}`);
    const { error: rolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (rolesError) throw new Error(`No se pudieron limpiar los roles del usuario: ${rolesError.message}`);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(`No se pudo eliminar la cuenta: ${error.message}`);
    return { ok: true };
  });

export const setUserProvince = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; province: string | null }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId requerido");
    const province = input.province ? String(input.province).trim() : null;
    if (province && province.length > 60) throw new Error("Provincia inválida");
    return { userId: input.userId, province };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw new Error("No se pudo verificar rol");
    if (!isAdmin) throw new Error("Solo el admin puede cambiar la provincia");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ province: data.province }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, province: data.province };
  });

export const listOrganizers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo el admin puede ver los organizadores");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: rolesErr } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "organizador");
    if (rolesErr) throw new Error(rolesErr.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [] as { id: string; full_name: string | null; email: string | null; province: string | null }[];
    const { data: profs, error } = await supabaseAdmin.from("profiles").select("id, full_name, email, province").in("id", ids);
    if (error) throw new Error(error.message);
    return (profs ?? []).map((p) => ({ id: p.id, full_name: p.full_name, email: p.email ?? null, province: p.province ?? null }));
  });
