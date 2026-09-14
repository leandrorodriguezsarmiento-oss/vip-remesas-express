import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  trackingId: z.string().trim().min(1).max(60),
});

export async function POST(req: Request) {
  // 1) Sesión válida (cookie httpOnly). Nunca confiar en el body para user_id.
  const supabase = await getSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUserId = userRes.user.id;

  // 2) Validar input.
  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad request" },
      { status: 400 },
    );
  }

  // 3) Lookup filtrado por owner: si el tracking_id no pertenece al usuario,
  //    devolvemos 404 idéntico al "no existe" para no filtrar existencia.
  const { data: tx, error: findErr } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,status,tracking_id")
    .eq("tracking_id", payload.trackingId)
    .eq("user_id", authUserId)
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }
  if (!tx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 4) Doble chequeo defensivo (defense-in-depth aunque el filtro ya lo garantiza).
  if (tx.user_id !== authUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5) Si ya no está pending, es idempotente: devolvemos el estado actual sin tocar nada.
  if (tx.status !== "pending") {
    return NextResponse.json({ ok: true, status: tx.status, idempotent: true });
  }

  // 6) Update atómico con guardas (owner + estado): evita races si dos requests llegan
  //    a la vez o si el estado cambió entre el SELECT y el UPDATE.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("transactions")
    .update({ status: "processing" })
    .eq("id", tx.id)
    .eq("user_id", authUserId)
    .eq("status", "pending")
    .select("id,status")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  if (!updated) {
    // Alguien más (o el propio usuario) cambió el estado en la ventana de carrera.
    const { data: fresh } = await supabaseAdmin
      .from("transactions")
      .select("status")
      .eq("id", tx.id)
      .eq("user_id", authUserId)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      status: fresh?.status ?? "unknown",
      idempotent: true,
    });
  }

  // TODO: reemplazar por verificación real con proveedor PIX (webhook firmado o pull).
  return NextResponse.json({ ok: true, status: updated.status });
}
