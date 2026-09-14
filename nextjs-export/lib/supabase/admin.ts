import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl?.startsWith("https://") || !serviceRoleKey) {
  throw new Error("Falta la configuración privada de Supabase en el servidor");
}

// Service-role client — SOLO para route handlers en /api/. Nunca importar en componentes.
export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
