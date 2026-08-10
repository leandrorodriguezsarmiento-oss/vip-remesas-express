import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STATUS_TEXT: Record<string, { label: string; body: string }> = {
  pending: { label: "Pendiente", body: "Recibimos tu solicitud y está en cola para revisión." },
  processing: { label: "En proceso", body: "Tu solicitud está siendo procesada por nuestro equipo." },
  completed: { label: "Completada", body: "¡Listo! Tu solicitud fue completada con éxito." },
  rejected: { label: "Rechazada", body: "Tu solicitud fue rechazada. Contáctanos por WhatsApp para más detalles." },
};

/**
 * Envía por EmailJS el aviso de cambio de estado de una remesa.
 * Sólo admin/organizador pueden dispararlo; el contenido se compone en el
 * servidor (el cliente no puede elegir destinatario ni texto).
 */
export const sendTransactionStatusEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transactionId: z.string().uuid(),
        status: z.enum(["pending", "processing", "completed", "rejected"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isOrg } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "organizador",
    });
    if (!isAdmin && !isOrg) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await (supabaseAdmin as any)
      .from("transactions")
      .select("id, user_id, amount_send, currency_send, recipient_name")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error) throw error;
    if (!tx) return { sent: false, reason: "not_found" };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(tx.user_id);
    const email = userRes?.user?.email;
    if (!email) return { sent: false, reason: "no_email" };

    const info = STATUS_TEXT[data.status];
    const { sendEmailJs } = await import("./emailjs.server");
    return sendEmailJs({
      to_email: email,
      to_name: (userRes?.user?.user_metadata?.full_name as string | undefined) ?? "",
      subject: `VIP Remesas · Remesa ${info.label}`,
      message: [
        `Estado: ${info.label}`,
        info.body,
        tx.recipient_name ? `Beneficiario: ${tx.recipient_name}` : "",
        tx.amount_send ? `Monto enviado: ${tx.amount_send} ${tx.currency_send ?? ""}` : "",
        "",
        "Gracias por confiar en VIP Remesas.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  });
