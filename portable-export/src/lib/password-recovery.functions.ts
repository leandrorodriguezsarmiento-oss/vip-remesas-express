import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

function requestIp(): string {
  try {
    const headers = getRequest().headers;
    return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    return "unknown";
  }
}

export const sendPasswordRecovery = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().trim().email().max(255) }).parse(input))
  .handler(async ({ data }) => {
    const contactEmail = data.email.toLowerCase();
    const { consumeRateLimit } = await import("./rate-limit.server");
    const allowed = await consumeRateLimit({
      key: `password-recovery:${contactEmail}:${requestIp()}`,
      limit: 4,
      windowSeconds: 900,
      blockSeconds: 900,
    });
    if (!allowed) throw new Error("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: alias } = await supabaseAdmin
      .from("login_aliases")
      .select("auth_email,user_id")
      .eq("kind", "email")
      .ilike("alias", contactEmail)
      .maybeSingle();

    let authEmail = alias?.auth_email as string | undefined;
    let userId = alias?.user_id as string | undefined;

    if (!authEmail || !userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", contactEmail)
        .maybeSingle();
      if (profile?.id) {
        userId = profile.id;
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        authEmail = authUser.user?.email ?? undefined;
      }
    }

    if (!authEmail || !userId) return { sent: true };

    const siteUrl = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://vipremesas.com";
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: authEmail,
      options: { redirectTo: `${siteUrl}/reset-password` },
    });
    if (linkError || !linkData?.properties?.action_link) {
      throw new Error("No se pudo crear el enlace de recuperación.");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const { sendEmailJs } = await import("./emailjs.server");
    const result = await sendEmailJs({
      to_email: contactEmail,
      to_name: profile?.full_name ?? "",
      subject: "VIP Remesas · Recuperar contraseña",
      message: [
        "Abre este enlace para crear una contraseña nueva:",
        linkData.properties.action_link,
        "",
        "El enlace es personal y temporal. Si no solicitaste este cambio, ignora este correo.",
      ].join("\n"),
    });
    if (!result.sent) throw new Error("No se pudo enviar el correo. Intenta de nuevo.");

    return { sent: true };
  });
