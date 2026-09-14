import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  promoId: z.string().uuid(),
  phone: z.string().trim().min(3).max(40),
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

  // Authoritative promo lookup — never trust client price/title.
  const { data: promo, error: promoErr } = await supabaseAdmin
    .from("promos")
    .select("id,title,price_brl,active")
    .eq("id", payload.promoId)
    .maybeSingle();
  if (promoErr) return NextResponse.json({ error: promoErr.message }, { status: 500 });
  if (!promo || !promo.active) return NextResponse.json({ error: "Promoción no disponible" }, { status: 400 });

  const { error } = await supabaseAdmin.from("recargas_requests").insert({
    user_id: userRes.user.id,
    phone: payload.phone,
    promo_id: promo.id,
    promo_title: promo.title,
    price_brl: promo.price_brl,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
