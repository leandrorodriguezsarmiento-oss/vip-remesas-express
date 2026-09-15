import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setOrganizerPermissions, ORGANIZER_PERMISSIONS } from "@/lib/organizer-permissions.functions";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Shield, Store, Smartphone, WalletCards } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizer-permissions")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: OrganizerPermissionsPage,
});

type Permission = (typeof ORGANIZER_PERMISSIONS)[number];
type Organizer = { id: string; username: string | null; full_name: string | null; email: string | null; province: string | null; permissions: Permission[] };
const labels: Record<Permission, { title: string; description: string; icon: typeof Shield }> = {
  remesas: { title: "Remesas", description: "Gestionar remesas asignadas", icon: WalletCards },
  recargas: { title: "Recargas", description: "Gestionar recargas", icon: Smartphone },
  tienda: { title: "Tienda", description: "Gestionar VipShop y pedidos", icon: Store },
};

function OrganizerPermissionsPage() {
  const savePermissions = useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: Permission[] }) => setOrganizerPermissions({ data: { userId, permissions } }),
    onSuccess: () => toast.success("Permisos guardados correctamente"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudieron guardar los permisos"),
  });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, Permission[]>>({});
  const organizers = useQuery<Organizer[]>({
    queryKey: ["organizers-permissions"],
    queryFn: async () => {
      const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }, { data: permissionRows, error: permissionsError }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "organizador"),
        supabase.from("profiles").select("id, username, full_name, email, province"),
        supabase.from("organizer_permissions").select("user_id, permission"),
      ]);
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;
      if (permissionsError) throw permissionsError;
      const ids = new Set((roles ?? []).map((r) => r.user_id));
      const byUser = new Map<string, Permission[]>();
      for (const row of permissionRows ?? []) {
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
        if (ORGANIZER_PERMISSIONS.includes(row.permission as Permission)) byUser.get(row.user_id)!.push(row.permission as Permission);
      }
      return (profiles ?? []).filter((p) => ids.has(p.id)).map((p) => ({ id: p.id, username: p.username ?? null, full_name: p.full_name ?? null, email: p.email ?? null, province: p.province ?? null, permissions: byUser.get(p.id) ?? [] }));
    },
  });
  useEffect(() => { if (organizers.data) { const next: Record<string, Permission[]> = {}; for (const o of organizers.data) next[o.id] = o.permissions; setEditing(next); } }, [organizers.data]);
  const toggle = (id: string, permission: Permission) => setEditing((current) => { const p = current[id] ?? []; return { ...current, [id]: p.includes(permission) ? p.filter((x) => x !== permission) : [...p, permission] }; });

  return <div className="mx-auto max-w-5xl space-y-5 p-4">
    <button onClick={() => window.history.back()} className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</button>
    <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold shadow-gold"><Shield className="h-6 w-6 text-primary-foreground" /></div><div><h1 className="font-display text-2xl font-bold">Organizadores y permisos</h1><p className="text-xs text-muted-foreground">Aquí puedes ver el nombre de usuario y los permisos de cada organizador.</p></div></div>
    {organizers.isLoading && <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Cargando organizadores...</div>}
    {organizers.error && <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive">No se pudieron cargar los organizadores.</div>}
    <div className="grid gap-4 md:grid-cols-2">{(organizers.data ?? []).map((o) => { const permissions = editing[o.id] ?? []; return <div key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3"><div><div className="text-lg font-extrabold">{o.username ? `@${o.username}` : "Sin nombre de usuario"}</div><div className="text-sm font-semibold">{o.full_name || "Sin nombre completo"}</div>{o.email && <div className="text-xs text-muted-foreground">{o.email}</div>}{o.province && <div className="text-xs text-muted-foreground">{o.province}</div>}</div><span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-extrabold uppercase text-gold">Organizador</span></div>
      <div className="space-y-2">{ORGANIZER_PERMISSIONS.map((permission) => { const meta = labels[permission]; const Icon = meta.icon; const checked = permissions.includes(permission); return <button key={permission} type="button" onClick={() => toggle(o.id, permission)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${checked ? "border-gold bg-gold/10" : "border-border bg-background"}`}><span className={`grid h-9 w-9 place-items-center rounded-lg ${checked ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}><Icon className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-bold">{meta.title}</span><span className="block text-[11px] text-muted-foreground">{meta.description}</span></span><span className={`grid h-6 w-6 place-items-center rounded-full border ${checked ? "border-gold bg-gradient-gold text-primary-foreground" : "border-border"}`}>{checked && <Check className="h-4 w-4" />}</span></button>; })}</div>
      <button type="button" disabled={savePermissions.isPending} onClick={() => savePermissions.mutate({ userId: o.id, permissions })} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{savePermissions.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar permisos de este organizador</button>
    </div>; })}</div>
  </div>;
}
