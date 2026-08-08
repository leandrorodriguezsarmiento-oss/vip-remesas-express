import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeAlias, syntheticEmail, isEmailLike } from "@/lib/alias";
import { z } from "zod";

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9._-]+$/),
  phone: z.string().trim().min(8).max(24),
  email: z.string().trim().email().max(255),
  cpf: z.string().trim().optional(),
  country: z.string().trim().min(2).max(4),
  password: z.string().min(6).max(72),
});

/** Resuelve usuario / teléfono / CPF / correo al email interno de la cuenta. */
export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string }) =>
    z.object({ identifier: z.string().trim().min(3).max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (isEmailLike(data.identifier)) {
      const email = data.identifier.trim().toLowerCase();
      const { data: row } = await supabaseAdmin
        .from("login_aliases")
        .select("auth_email")
        .ilike("alias", email)
        .maybeSingle();
      return { email: (row?.auth_email as string | undefined) ?? email };
    }

    const candidates = Array.from(
      new Set([
        normalizeAlias("username", data.identifier),
        normalizeAlias("phone", data.identifier),
      ].filter((v) => v.length >= 3)),
    );
    for (const alias of candidates) {
      const { data: row } = await supabaseAdmin
        .from("login_aliases")
        .select("auth_email")
        .ilike("alias", alias)
        .maybeSingle();
      if (row?.auth_email) return { email: row.auth_email as string };
    }
    return { email: null as string | null };
  });


/** Crea la cuenta sin correo: usuario + teléfono (+ CPF si Brasil) + contraseña. */
export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const username = normalizeAlias("username", data.username);
    const phone = normalizeAlias("phone", data.phone);
    const cpf = data.cpf ? normalizeAlias("cpf", data.cpf) : "";

    if (username.length < 3) throw new Error("Nombre de usuario inválido");
    if (phone.length < 8) throw new Error("Teléfono inválido");
    if (data.country === "BR" && cpf.length !== 11) throw new Error("El CPF debe tener 11 dígitos");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const aliases = [
      { alias: username, kind: "username" as const },
      { alias: phone, kind: "phone" as const },
      ...(cpf ? [{ alias: cpf, kind: "cpf" as const }] : []),
    ];

    for (const a of aliases) {
      const { data: taken } = await supabaseAdmin
        .from("login_aliases")
        .select("id")
        .ilike("alias", a.alias)
        .maybeSingle();
      if (taken) {
        throw new Error(
          a.kind === "username"
            ? "Ese nombre de usuario ya está en uso"
            : a.kind === "phone"
              ? "Ese teléfono ya tiene una cuenta"
              : "Ese CPF ya tiene una cuenta",
        );
      }
    }

    const authEmail = syntheticEmail(username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName.trim(),
        phone: data.phone.trim(),
        username,
        cpf,
        country: data.country,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear la cuenta");

    const { error: aliasErr } = await supabaseAdmin.from("login_aliases").insert(
      aliases.map((a) => ({
        alias: a.alias,
        kind: a.kind,
        auth_email: authEmail,
        user_id: created.user.id,
      })),
    );
    if (aliasErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("No se pudo registrar el identificador. Intenta con otro usuario.");
    }

    return { email: authEmail };
  });

/** Guarda/actualiza los alias de una cuenta existente (desde Ajustes). */
export const updateMyAliases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z.string().trim().max(24).optional(),
        phone: z.string().trim().max(24).optional(),
        cpf: z.string().trim().max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("login_aliases")
      .select("auth_email")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    const authEmail =
      (existing?.auth_email as string | undefined) ??
      (context.claims as { email?: string } | null)?.email;
    if (!authEmail) throw new Error("Cuenta sin identificador base");

    const rows = [
      data.username ? { alias: normalizeAlias("username", data.username), kind: "username" } : null,
      data.phone ? { alias: normalizeAlias("phone", data.phone), kind: "phone" } : null,
      data.cpf ? { alias: normalizeAlias("cpf", data.cpf), kind: "cpf" } : null,
    ].filter((r): r is { alias: string; kind: string } => !!r && r.alias.length >= 3);

    for (const r of rows) {
      const { data: taken } = await supabaseAdmin
        .from("login_aliases")
        .select("id, user_id")
        .ilike("alias", r.alias)
        .maybeSingle();
      if (taken && taken.user_id !== context.userId) {
        throw new Error(`El identificador ${r.alias} ya está en uso`);
      }
      if (!taken) {
        await supabaseAdmin.from("login_aliases").insert({
          alias: r.alias,
          kind: r.kind,
          auth_email: authEmail,
          user_id: context.userId,
        });
      }
    }
    return { ok: true };
  });

/** El usuario pide verificar su cuenta: avisa al admin. */
export const requestAccountVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, phone, username")
      .eq("id", context.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const rows = (admins ?? []).map((a) => ({
      user_id: a.user_id as string,
      title: "Verificación solicitada",
      body: `${profile?.full_name || profile?.username || "Un usuario"} (${profile?.phone ?? "s/tel"}) pidió verificar su cuenta.`,
    }));
    if (rows.length) await supabaseAdmin.from("notifications").insert(rows);
    return { ok: true };
  });
