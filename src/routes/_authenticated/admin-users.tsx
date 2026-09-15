import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-users")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: AdminUsersInfo,
});

function AdminUsersInfo() {
  const q = useQuery({
    queryKey: ["admin-users-info"],
    queryFn: async () => {
      const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, email, phone, province, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      const roleByUser = new Map<string, string[]>();
      for (const r of roles ?? []) roleByUser.set(r.user_id, [...(roleByUser.get(r.user_id) ?? []), r.role]);
      return (profiles ?? []).map((p) => ({ ...p, roles: roleByUser.get(p.id) ?? [] }));
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-card p-4 shadow-card">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-xl font-extrabold">Información de usuarios</h1>
          <p className="text-xs text-muted-foreground">Nombre de usuario, datos y rol de cada cuenta.</p>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando usuarios…</p>}
      {q.isError && <p className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">No se pudo cargar la información.</p>}

      <div className="space-y-2">
        {q.data?.map((u) => (
          <div key={u.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-gold">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-foreground">{u.full_name || "(sin nombre)"}</span>
                  {u.roles.map((role) => (
                    <span key={role} className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-extrabold uppercase text-gold">{role}</span>
                  ))}
                </div>
                <div className="rounded-lg border border-gold/30 bg-background/60 px-2 py-1.5 text-xs font-extrabold text-gold">
                  Usuario: @{u.username || "sin usuario"}
                </div>
                <div className="grid grid-cols-1 gap-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
                  <span>Correo: {u.email || "sin correo"}</span>
                  <span>Teléfono: {u.phone || "sin teléfono"}</span>
                  <span>Provincia: {u.province || "Sin provincia"}</span>
                  <span>Alta: {new Date(u.created_at).toLocaleString("es")}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
