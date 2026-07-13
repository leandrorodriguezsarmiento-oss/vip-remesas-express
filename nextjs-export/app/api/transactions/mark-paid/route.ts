import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  trackingId: z.string().trim().min(1).max(60),
});

export async function POST(req: Request) {
  const supabase = await getSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bad request" }, { status: 400 });
  }

  // Ownership check before status update.
  const { data: tx, error: findErr } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,status")
    .eq("tracking_id", payload.trackingId)
    .maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!tx || tx.user_id !== userRes.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (tx.status !== "pending") {
    return NextResponse.json({ ok: true, status: tx.status });
  }

  // TODO: reemplaza por verificación real con proveedor PIX (webhook o pull).
  const { error: updErr } = await supabaseAdmin
    .from("transactions")
    .update({ status: "processing" })
    .eq("id", tx.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: "processing" });
}
