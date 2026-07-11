import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: adminRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return <AuthShell userId={user.id} isAdmin={!!adminRow}>{children}</AuthShell>;
}
