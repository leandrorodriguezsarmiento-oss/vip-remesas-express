import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CODE_TTL_MINUTES = 10;

type VerificationCodeRow = {
  id: string;
  user_id: string;
  email: string;
  code: string;
  type: string;
  expires_at: string;
  verified: boolean;
  created_at: string;
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function findUserByEmail(adminClient: any, email: string) {
  try {
    const { data, error } = await adminClient.auth.admin.getUserByEmail(email);
    if (!error && data?.user) return data.user;
  } catch {
    // fallback below
  }
  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  return data.users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
}

export const sendVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        type: z.enum(["email", "phone"]).default("email"),
        fullName: z.string().optional(),
        phone: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existingUser = await findUserByEmail(supabaseAdmin, data.email);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: false,
        user_metadata: {
          full_name: data.fullName ?? "",
          phone: data.phone ?? "",
        },
      });
      if (createError) throw createError;
      if (!newUser.user) throw new Error("No se pudo crear el usuario");
      userId = newUser.user.id;
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await (supabaseAdmin as any)
      .from("verification_codes")
      .insert({
        user_id: userId,
        email: data.email,
        code,
        type: data.type,
        expires_at: expiresAt,
      });
    if (insertError) throw insertError;

    // SLOT: reemplazar por envío real vía email o WhatsApp
    // await sendCodeViaEmail(data.email, code);
    // await sendCodeViaWhatsApp(data.phone, code);

    return { email: data.email, code };
  });

export const verifyVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        code: z.string().length(6),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error: selectError } = (await (supabaseAdmin as any)
      .from("verification_codes")
      .select("*")
      .eq("email", data.email)
      .eq("code", data.code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)) as { data: VerificationCodeRow[] | null; error: any };
    if (selectError) throw selectError;
    if (!rows || rows.length === 0) throw new Error("Código inválido o expirado");

    const row = rows[0];

    const [{ error: updateError }, { error: confirmError }] = await Promise.all([
      (supabaseAdmin as any).from("verification_codes").update({ verified: true }).eq("id", row.id),
      supabaseAdmin.auth.admin.updateUserById(row.user_id, { email_confirm: true }),
    ]);
    if (updateError) throw updateError;
    if (confirmError) throw confirmError;

    return { success: true };
  });

export const setInitialPassword = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const user = await findUserByEmail(supabaseAdmin, data.email);
    if (!user) throw new Error("Usuario no encontrado");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
    });
    if (error) throw error;

    return { success: true };
  });
