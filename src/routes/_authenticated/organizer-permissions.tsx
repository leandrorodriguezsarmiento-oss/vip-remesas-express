import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listOrganizers } from "@/lib/admin.functions";
import {
  getOrganizerPermissions,
  setOrganizerPermissions,
  ORGANIZER_PERMISSIONS,
} from "@/lib/organizer-permissions.functions";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Shield, Store, Smartphone, WalletCards } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizer-permissions")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: OrganizerPermissionsPage,
});

type Permission = (typeof ORGANIZER_PERMISSIONS)[number];
type Organizer = { id: string; full_name: string | null; email: string | null; province: string | null };

const labels: Record<Permission, { title: string; description: string; icon: typeof Shield }> = {
  remesas: { title: "Remesas", description: "Ver y procesar las remesas asignadas", icon: WalletCards },
  recargas: { title: "Recargas", description: "Gestionar las recargas asignadas", icon: Smartphone },
  tienda: { title: "Tienda", description: "Gestionar VipShop y sus pedidos", icon: Store },
};

function OrganizerPermissionsPage() {
  const list = useServerFn(listOrganizers);
  const getPermissions = useServerFn(getOrganizerPermissions);
  const savePermissions = useServerFn(setOrganizerPermissions);
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const organizers = useQuery<Organizer[]>({
    queryKey: ["organizers-permissions"],
    queryFn: async () => (await list()) as Organizer[],
  });

  const current = organizers.data?.find((o) => o.id === selected);

  useEffect(() => {
    if (!selected) {
      setPermissions([]);
      return;
    }
    let active = true;
    void getPermissions({ data: { userId: selected } }).then((rows) => {
      if (active) setPermissions(rows as Permission[]);
    }).catch((e) => toast.error(e instanceof Error ? e.message : "No se pudieron cargar los permisos"));
    return () => { active = false; };
  }, [selected, getPermissions]);

  const save = useMutation({
    mutationFn: () => savePermissions({ data: { userId: selected, permissions } }),
    onSuccess: () => {
      toast.success("Permisos del organizador guardados");
      qc.invalidateQueries({ queryKey: ["organizers-permissions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudieron guardar los permisos"),
  });

  const toggle = (permission: Permission) => {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold shadow-gold">
          <Shield className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Organizadores y permisos</h1>
          <p className="text-xs text-muted-foreground">Tú decides exactamente qué puede hacer cada organizador.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <label className="block text-xs font-bold uppercase text-muted-foreground">Selecciona un organizador</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-2 w-full rounded-xl border border-primary/30 bg-background px-3 py-3 text-sm font-bold"
        >
          <option value="">Selecciona...</option>
          {(organizers.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name || o.email || "Organizador"}{o.province ? ` · ${o.province}` : ""}
            </option>
          ))}
        </select>
      </div>

      {current && (
        <div className="space-y-3">
          <div className="rounded-xl border border-gold/30 bg-card p-4">
            <div className="font-bold">{current.full_name || current.email || "Organizador"}</div>
            {current.email && <div className="text-xs text-muted-foreground">{current.email}</div>}
            <div className="mt-1 text-xs text-muted-foreground">Marca solamente los módulos que podrá utilizar.</div>
          </div>

          {ORGANIZER_PERMISSIONS.map((permission) => {
            const meta = labels[permission];
            const Icon = meta.icon;
            const checked = permissions.includes(permission);
            return (
              <button
                key={permission}
                type="button"
                onClick={() => toggle(permission)}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${checked ? "border-gold bg-gold/10" : "border-border bg-card"}`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${checked ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{meta.title}</span>
                  <span className="block text-xs text-muted-foreground">{meta.description}</span>
                </span>
                <span className={`grid h-6 w-6 place-items-center rounded-full border ${checked ? "border-gold bg-gradient-gold text-primary-foreground" : "border-border"}`}>
                  {checked && <Check className="h-4 w-4" />}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-extrabold text-primary-foreground shadow-gold disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar permisos
          </button>
        </div>
      )}
    </div>
  );
}
