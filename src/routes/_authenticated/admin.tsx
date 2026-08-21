import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { CUBA_PROVINCES } from "@/lib/provinces";
import { deleteUserAsAdmin, listOrganizers, setOrganizerRole, setUserProvince } from "@/lib/admin.functions";
import { sendTransactionStatusEmail } from "@/lib/emails.functions";

import { toast } from "sonner";
import { Shield, Loader2, Trash2, Plus, Check, RefreshCw, Smartphone, Zap, BarChart3, CreditCard, Copy, UserCheck, Folder, FolderOpen, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id)
      .in("role", ["admin", "organizador"]);
    const roles = (data ?? []).map((r) => r.role as string);
    if (roles.length === 0) throw redirect({ to: "/dashboard" });
    return { isAdmin: roles.includes("admin") };
  },
  component: AdminPanel,
});

type Tab = "tx" | "recargas" | "rates" | "promos" | "users" | "api" | "banners" | "payments" | "mp" | "reports" | "store" | "orders" | "myday";

function AdminPanel() {
  const { isAdmin, user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("tx");

  const tabs: [Tab, string][] = isAdmin
    ? [
        ["tx", "Remesas"], ["recargas", "Recargas"], ["orders", "Pedidos"], ["reports", "Reportes"],
        ["myday", "Mi día"],
        ["rates", "Tasas"], ["promos", "Promos"], ["banners", "Banners"],
        ["store", "VipShop"],
        ["payments", "Cuentas de pago"], ["mp", "Mercado Pago"], ["users", "Usuarios"], ["api", "API"],
      ]
    : [["tx", "Remesas"], ["recargas", "Recargas"], ["orders", "Pedidos"], ["myday", "Mi día"], ["store", "VipShop"]];


  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold shadow-gold">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">
            {isAdmin ? "Panel admin" : "Panel organizador"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Control total de VIP Remesas" : "Procesa remesas y recargas"}
          </p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1 text-[10px] font-medium">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`shrink-0 rounded-lg px-3 py-2 ${tab === id ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "tx" && <TransactionsTab isAdmin={isAdmin} />}
      {tab === "orders" && <StoreOrdersTab isAdmin={isAdmin} />}
      {tab === "recargas" && <RecargasTab isAdmin={isAdmin} />}
      {tab === "myday" && <MyWorkTab userId={user.id} />}
      {tab === "store" && <StoreTab />}


      {isAdmin && tab === "reports" && <ReportsTab />}
      {isAdmin && tab === "rates" && <RatesTab />}
      {isAdmin && tab === "promos" && <PromosTab />}
      {isAdmin && tab === "banners" && <BannersTab />}
      {isAdmin && tab === "payments" && <PaymentMethodsTab />}
      {isAdmin && tab === "mp" && <MercadoPagoTab />}
      {isAdmin && tab === "users" && <UsersTab />}
      {isAdmin && tab === "api" && <ApiTab />}
    </div>
  );
}



// ----------------- Transacciones -----------------
const STATUS_ES: Record<string, string> = {
  pending: "Pendiente", processing: "Procesando", completed: "Completada", rejected: "Rechazada",
};

type AdminTx = {
  recipient_name: string;
  recipient_phone: string;
  recipient_card?: string | null;
  delivery_method: string;
  method_category?: string | null;
  amount_dest?: number | string | null;
  dest_currency?: string | null;
  notes?: string | null;
};

/** Datos que el admin necesita copiar de un toque: efectivo → nombre + dirección + monto; transferencia → teléfono + tarjeta + monto. */
function CopyBlock({ tx }: { tx: AdminTx }) {
  const marker = `${tx.method_category ?? ""} ${tx.delivery_method ?? ""}`.toLowerCase();
  const efectivo = marker.includes("efectivo") || marker.includes("cash");
  const address = (tx.notes || "").replace(/^Dirección de entrega:\s*/i, "");
  const monto = tx.amount_dest != null
    ? formatMoney(Number(tx.amount_dest), tx.dest_currency || "CUP")
    : "";
  const tipo = efectivo ? "Efectivo (entrega en mano)" : "Transferencia a tarjeta";
  const lines = efectivo
    ? [
        ["Tipo de remesa", tipo],
        ["Nombre", tx.recipient_name],
        ["Teléfono", tx.recipient_phone],
        ["Dirección", address],
        ["Monto a entregar", monto],
      ]
    : [
        ["Tipo de remesa", tipo],
        ["Nombre", tx.recipient_name],
        ["Teléfono", tx.recipient_phone],
        ["Tarjeta", tx.recipient_card || ""],
        ["Monto a enviar", monto],
      ];
  const shown = lines.filter(([, v]) => (v ?? "").trim().length > 0) as [string, string][];
  if (shown.length === 0) return null;

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  return (
    <div className="mt-2 space-y-1 rounded-lg border border-gold/40 bg-background/60 p-2">
      {shown.map(([label, value]) => (
        <button key={label} onClick={() => copy(value, label)}
          className="flex w-full items-start gap-2 text-left text-[12px] font-bold text-foreground hover:text-gold">
          <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
          <span className="min-w-0 break-words">
            <span className="text-muted-foreground">{label}: </span>{value}
          </span>
        </button>
      ))}
      <button
        onClick={() => copy(shown.map(([l, v]) => `${l}: ${v}`).join("\n"), "Todo")}
        className="w-full rounded-md bg-gradient-gold px-2 py-1 text-[11px] font-bold text-primary-foreground">
        Copiar todo
      </button>
    </div>
  );
}



// ----------------- Organizadores (asignación) -----------------
type Organizer = { id: string; full_name: string | null; email: string | null; province: string | null };

function useOrganizers(enabled: boolean) {
  const list = useServerFn(listOrganizers);
  return useQuery<Organizer[]>({
    queryKey: ["organizers"],
    queryFn: async () => (await list()) as Organizer[],
    enabled,
    staleTime: 60_000,
  });
}

function orgLabel(o: Organizer) {
  return `${o.full_name || o.email || "Organizador"}${o.province ? ` · ${o.province}` : ""}`;
}

function OrgPicker({
  organizers,
  value,
  onChange,
}: { organizers: Organizer[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">Organizador que procesa</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-primary/40 bg-background px-2 py-1.5 text-[11px] font-bold">
        <option value="">Todos los organizadores</option>
        {organizers.map((o) => <option key={o.id} value={o.id}>{orgLabel(o)}</option>)}
      </select>
    </label>
  );
}

function AssignedBadge({ organizers, id }: { organizers: Organizer[]; id: string | null | undefined }) {
  if (!id) return null;
  const o = organizers.find((x) => x.id === id);
  return (
    <p className="text-[10px] font-extrabold text-primary">
      Asignado a: {o ? orgLabel(o) : "organizador"}
    </p>
  );
}

function TransactionsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"active" | "done">("active");
  const q = useQuery({
    queryKey: ["admin-tx"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const organizers = useOrganizers(isAdmin);
  const [assign, setAssign] = useState<Record<string, string>>({});

  const upd = useMutation({
    mutationFn: async ({ id, status, assignedTo }: { id: string; status: "pending" | "processing" | "completed" | "rejected"; assignedTo?: string | null }) => {
      const patch: { status: typeof status; assigned_to?: string | null } = { status };
      if (status === "processing") patch.assigned_to = assignedTo || null;
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw error;
      try {
        await sendTransactionStatusEmail({ data: { transactionId: id, status } });
      } catch {
        /* el correo es complementario: no bloquea el cambio de estado */
      }
    },
    onSuccess: () => { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["admin-tx"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });


  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const all = q.data ?? [];
  const active = all.filter((t) => t.status === "pending" || t.status === "processing");
  const done = all.filter((t) => t.status === "completed" || t.status === "rejected");
  const rows = view === "active" ? active : done;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-xs font-medium">
        <button onClick={() => setView("active")}
          className={`rounded-lg px-3 py-2 ${view === "active" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
          Pendientes ({active.length})
        </button>
        <button onClick={() => setView("done")}
          className={`rounded-lg px-3 py-2 ${view === "done" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
          Historial ({done.length})
        </button>
      </div>

      {rows.map((t) => (
        <div key={t.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold text-destructive">
                <span className="mr-1 text-gold">#{(t as { order_no?: number }).order_no ?? "—"}</span>
                {t.recipient_name}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                {new Date(t.created_at).toLocaleString("es")}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                {(t as { origin_country?: string }).origin_country ?? "BR"} →
                {" "}{t.dest_currency} ({(t as { method_category?: string }).method_category ?? "—"})
              </div>
              <CopyBlock tx={t as AdminTx} />
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-destructive">
                {formatMoney(Number(t.total_brl), (t as { origin_currency?: string }).origin_currency || "BRL")}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                → {formatMoney(Number(t.amount_dest), t.dest_currency)}
              </div>
            </div>
          </div>

          <AssignedBadge organizers={organizers.data ?? []} id={(t as { assigned_to?: string | null }).assigned_to} />
          {isAdmin && t.status !== "completed" && t.status !== "rejected" && (
            <AssignAndSend
              organizers={organizers.data ?? []}
              value={assign[t.id] ?? (t as { assigned_to?: string | null }).assigned_to ?? ""}
              onChange={(v) => setAssign((prev) => ({ ...prev, [t.id]: v }))}
              onSend={(orgId) => upd.mutate({ id: t.id, status: "processing", assignedTo: orgId })}
              disabled={upd.isPending}
            />
          )}
          <div className="flex flex-wrap gap-1">
            {(isAdmin ? (["pending", "completed", "rejected"] as const) : (["completed"] as const)).map((s) => (
              <button key={s}
                onClick={() => upd.mutate({ id: t.id, status: s })}
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${t.status === s ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}>
                {STATUS_ES[s]}
              </button>
            ))}
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {view === "active" ? "No hay remesas pendientes." : "Sin remesas en el historial."}
        </p>
      )}
    </div>
  );
}


// ----------------- Tasas -----------------
function RatesTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rates").select("*")
        .order("origin_country").order("method_category").order("dest_currency");
      if (error) throw error;
      return data;
    },
  });
  const upd = useMutation({
    mutationFn: async (r: { id: string; rate: number; time_min_minutes: number; time_max_minutes: number; active: boolean }) => {
      const { error } = await supabase.from("rates").update({
        rate: r.rate, time_min_minutes: r.time_min_minutes, time_max_minutes: r.time_max_minutes, active: r.active,
        updated_at: new Date().toISOString(),
      }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tasa actualizada"); qc.invalidateQueries({ queryKey: ["admin-rates"] }); qc.invalidateQueries({ queryKey: ["rates"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-2">
      {q.data?.map((r) => (
        <RateEditor key={r.id} row={r} onSave={(v) => upd.mutate({ id: r.id, ...v })} />
      ))}
    </div>
  );
}

function RateEditor({ row, onSave }: {
  row: { id: string; origin_country: string; method_category: string; dest_currency: string; rate: number; time_min_minutes: number; time_max_minutes: number; active: boolean };
  onSave: (v: { rate: number; time_min_minutes: number; time_max_minutes: number; active: boolean }) => void;
}) {
  const [rate, setRate] = useState(String(row.rate));
  const [tMin, setTMin] = useState(String(row.time_min_minutes));
  const [tMax, setTMax] = useState(String(row.time_max_minutes));
  const [active, setActive] = useState(row.active);
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{row.origin_country} · {row.method_category} · {row.dest_currency}</span>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
            className="h-3 w-3 accent-[color:var(--gold)]" />
          Activa
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <MiniInput label="Tasa" value={rate} onChange={setRate} />
        <MiniInput label="Min min" value={tMin} onChange={setTMin} />
        <MiniInput label="Max min" value={tMax} onChange={setTMax} />
      </div>
      <button
        onClick={() => onSave({ rate: Number(rate), time_min_minutes: Number(tMin), time_max_minutes: Number(tMax), active })}
        className="flex w-full items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-gold">
        <Check className="h-3 w-3" /> Guardar
      </button>
    </div>
  );
}

function MiniInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-gold outline-none" />
    </label>
  );
}

// ----------------- Promos -----------------
function PromosTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promos").select("*").order("price_brl");
      if (error) throw error;
      return data;
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Promo eliminada"); qc.invalidateQueries({ queryKey: ["admin-promos"] }); qc.invalidateQueries({ queryKey: ["promos"] }); },
  });
  const add = useMutation({
    mutationFn: async (p: { title: string; description: string; price_brl: number; bonus_label: string; image_url: string | null }) => {
      const { error } = await supabase.from("promos").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Promo creada"); qc.invalidateQueries({ queryKey: ["admin-promos"] }); qc.invalidateQueries({ queryKey: ["promos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  const toggle = useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const { error } = await supabase.from("promos").update({ active: v.active }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promos"] }); qc.invalidateQueries({ queryKey: ["promos"] }); qc.invalidateQueries({ queryKey: ["public-promos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const [nt, setNt] = useState(""); const [nd, setNd] = useState("");
  const [np, setNp] = useState(""); const [nb, setNb] = useState("");
  const [gift, setGift] = useState(false);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Nueva promo</p>
        <MiniInput label="Título" value={nt} onChange={setNt} />
        <MiniInput label="Descripción" value={nd} onChange={setNd} />
        <div className="grid grid-cols-2 gap-2">
          <MiniInput label="Precio BRL" value={np} onChange={setNp} />
          <MiniInput label="Bono (texto)" value={nb} onChange={setNb} />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-2">
          <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--gold))]" />
          <span className="text-[11px] font-extrabold">
            Recarga promocional 🎁 (usa el ícono de regalo en vez de Cubacel)
          </span>
        </label>
        <button
          onClick={() => {
            if (!nt || !np) return toast.error("Título y precio requeridos");
            add.mutate({
              title: nt, description: nd, price_brl: Number(np), bonus_label: nb,
              image_url: gift ? "gift" : null,
            });
            setNt(""); setNd(""); setNp(""); setNb(""); setGift(false);
          }}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-gold">
          <Plus className="h-3 w-3" /> Añadir
        </button>
      </div>

      {q.data?.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {p.image_url === "gift" ? "🎁 " : ""}{p.title}
            </div>
            <div className="text-[11px] text-muted-foreground">{p.description}</div>
            <div className="text-[11px] font-medium text-gold">{p.bonus_label}</div>
            <button onClick={() => toggle.mutate({ id: p.id, active: !p.active })}
              className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${p.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
              {p.active ? "Activa" : "Inactiva"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-gold">{formatMoney(Number(p.price_brl), "BRL")}</span>
            <button onClick={() => del.mutate(p.id)} className="rounded-md p-1 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


// ----------------- Usuarios -----------------
function UsersTab() {
  const qc = useQueryClient();
  const delUser = useServerFn(deleteUserAsAdmin);
  const setOrg = useServerFn(setOrganizerRole);
  const setProv = useServerFn(setUserProvince);
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const orgs = new Set((roles ?? []).filter((r) => r.role === "organizador").map((r) => r.user_id));
      const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (data ?? []).map((u) => ({ ...u, isOrganizer: orgs.has(u.id), isAdmin: admins.has(u.id) }));
    },
  });
  const del = useMutation({
    mutationFn: async (userId: string) => delUser({ data: { userId } }),
    onSuccess: () => { toast.success("Usuario eliminado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  const org = useMutation({
    mutationFn: async (v: { userId: string; enabled: boolean }) => setOrg({ data: v }),
    onSuccess: (r) => {
      toast.success(r.enabled ? "Ahora es organizador" : "Ya no es organizador");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  const prov = useMutation({
    mutationFn: async (v: { userId: string; province: string | null }) => setProv({ data: v }),
    onSuccess: () => { toast.success("Provincia actualizada"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="space-y-2">
      {q.data?.map((u) => (
        <div key={u.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{u.full_name || "(sin nombre)"}</div>
              <div className="text-[11px] font-semibold text-muted-foreground">{u.phone || "sin teléfono"}</div>
              <div className="text-[11px] text-muted-foreground truncate">{(u as { email?: string | null }).email || "sin correo"}</div>
              <div className="text-[10px] font-bold text-primary">
                {(u as { province?: string | null }).province || "Sin provincia"}
              </div>
              <div className="text-[10px] text-muted-foreground">Alta: {new Date(u.created_at).toLocaleDateString("es")}</div>

            </div>
            {!u.isAdmin && (
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar a ${u.full_name || "este usuario"}? Se borran sus remesas y datos.`)) {
                    del.mutate(u.id);
                  }
                }}
                className="rounded-md p-2 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {!u.isAdmin && (
            <button
              onClick={() => org.mutate({ userId: u.id, enabled: !u.isOrganizer })}
              disabled={org.isPending}
              className={`flex w-full items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${u.isOrganizer ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border bg-background text-muted-foreground"}`}>
              <UserCheck className="h-3 w-3" />
              {u.isOrganizer ? "Organizador activo" : "Hacer organizador"}
            </button>
          )}
          {!u.isAdmin && (
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Provincia</span>
              <select
                value={(u as { province?: string | null }).province ?? ""}
                disabled={prov.isPending}
                onChange={(e) => prov.mutate({ userId: u.id, province: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold">
                <option value="">Sin provincia</option>
                {CUBA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          )}
          {u.isAdmin && <p className="text-[10px] font-semibold text-gold">Administrador</p>}
        </div>
      ))}

      {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay usuarios.</p>}
    </div>
  );
}


// ----------------- API Recargas -----------------
function ApiTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-recargas-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recargas_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [provider, setProvider] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [keyName, setKeyName] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  // hydrate once
  if (q.data && provider === "" && (q.data.provider ?? "") !== "") {
    setProvider(q.data.provider ?? "");
    setBaseUrl(q.data.api_base_url ?? "");
    setKeyName(q.data.api_key_name ?? "");
    setNotes(q.data.notes ?? "");
    setActive(q.data.active);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!q.data) {
        const { error } = await supabase.from("recargas_config").insert({
          provider, api_base_url: baseUrl, api_key_name: keyName, notes, active,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recargas_config").update({
          provider, api_base_url: baseUrl, api_key_name: keyName, notes, active,
          updated_at: new Date().toISOString(),
        }).eq("id", q.data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Configuración guardada"); qc.invalidateQueries({ queryKey: ["admin-recargas-config"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Proveedor de recargas Cubacel</p>
        <p className="text-[11px] text-muted-foreground">
          Cuando elijas proveedor (Ding, DTOne, etc.) pega aquí su URL base y el nombre del secret con la API key.
          Luego pídeme añadir ese secret y conectaré la llamada real en el flujo de recargas.
        </p>
        <MiniInput label="Proveedor (ej. ding, dtone, mock)" value={provider} onChange={setProvider} />
        <MiniInput label="URL base API" value={baseUrl} onChange={setBaseUrl} />
        <MiniInput label="Nombre del secret (ej. DING_API_KEY)" value={keyName} onChange={setKeyName} />
        <MiniInput label="Notas" value={notes} onChange={setNotes} />
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
            className="h-3 w-3 accent-[color:var(--gold)]" />
          Configuración activa
        </label>
        <div className="flex gap-2">
          <button onClick={() => save.mutate()}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground shadow-gold">
            <Check className="h-3 w-3" /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------- Banners -----------------
function BannersTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");

  const upsert = useMutation({
    mutationFn: async (b: { id?: string; image_url: string; title: string; link_url: string; active?: boolean; sort_order?: number }) => {
      if (b.id) {
        const { error } = await supabase.from("banners").update({
          title: b.title || null, link_url: b.link_url || null, active: b.active, sort_order: b.sort_order,
        }).eq("id", b.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("banners").insert({
          image_url: b.image_url, title: b.title || null, link_url: b.link_url || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["banners", "active"] }); toast.success("Banner guardado"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["banners", "active"] }); toast.success("Banner eliminado"); },
  });

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadStoreImage(file, "banners");
      upsert.mutate({ image_url: url, title, link_url: link });
      setTitle(""); setLink("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/40 bg-card p-3 space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Nuevo banner</p>
        <MiniInput label="Título (opcional)" value={title} onChange={setTitle} />
        <MiniInput label="Enlace (opcional, https://...)" value={link} onChange={setLink} />
        <label className={`flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground shadow-gold ${uploading ? "opacity-60" : ""}`}>
          <Plus className="h-3 w-3" /> {uploading ? "Subiendo…" : "Subir imagen y crear"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.currentTarget.value = ""; }} />
        </label>
        <p className="text-[10px] text-muted-foreground">Recomendado 1600×700, formato JPG o PNG, menos de 2 MB.</p>
      </div>

      {q.data?.map((b) => (
        <div key={b.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
          <img src={b.image_url} alt={b.title ?? ""} loading="lazy" decoding="async" width={640} height={280} className="aspect-[16/7] w-full rounded-lg object-cover" />
          <div className="grid grid-cols-2 gap-2">
            <MiniInput label="Título" value={b.title ?? ""} onChange={(v) => upsert.mutate({ id: b.id, image_url: b.image_url, title: v, link_url: b.link_url ?? "", active: b.active, sort_order: b.sort_order })} />
            <MiniInput label="Orden" value={String(b.sort_order)} onChange={(v) => upsert.mutate({ id: b.id, image_url: b.image_url, title: b.title ?? "", link_url: b.link_url ?? "", active: b.active, sort_order: Number(v) || 0 })} />
          </div>
          <MiniInput label="Enlace" value={b.link_url ?? ""} onChange={(v) => upsert.mutate({ id: b.id, image_url: b.image_url, title: b.title ?? "", link_url: v, active: b.active, sort_order: b.sort_order })} />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={b.active}
                onChange={(e) => upsert.mutate({ id: b.id, image_url: b.image_url, title: b.title ?? "", link_url: b.link_url ?? "", active: e.target.checked, sort_order: b.sort_order })}
                className="h-3 w-3 accent-[color:var(--gold)]" />
              Activo
            </label>
            <button onClick={() => del.mutate(b.id)} className="rounded-md p-1 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay banners. Sube el primero arriba.</p>}
    </div>
  );
}

// ----------------- Recargas Cubacel pendientes -----------------
function RecargasTab({ isAdmin = true }: { isAdmin?: boolean }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"active" | "done">("active");
  const q = useQuery({
    queryKey: ["admin-recargas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recargas_requests")
        .select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
      let profilesById: Record<string, { full_name: string | null; phone: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("id, full_name, phone").in("id", userIds);
        profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, phone: p.phone }]));
      }
      return (data ?? []).map((r) => ({ ...r, profile: profilesById[r.user_id] ?? null }));
    },
  });

  const organizers = useOrganizers(isAdmin);
  const [assign, setAssign] = useState<Record<string, string>>({});

  const upd = useMutation({
    mutationFn: async ({ id, status, assignedTo }: { id: string; status: "pending" | "processing" | "completed" | "rejected"; assignedTo?: string | null }) => {
      const patch: { status: typeof status; assigned_to?: string | null } = { status };
      if (status === "processing") patch.assigned_to = assignedTo || null;
      const { error } = await supabase.from("recargas_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["admin-recargas"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const all = q.data ?? [];
  const active = all.filter((r) => r.status === "pending" || r.status === "processing");
  const done = all.filter((r) => r.status === "completed" || r.status === "rejected");
  const rows = view === "active" ? active : done;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-gold" />
        <div className="flex-1">
          <p className="text-xs uppercase text-muted-foreground">Recargas pendientes</p>
          <p className="font-display text-xl font-bold text-gold">{active.length}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-xs font-medium">
        <button onClick={() => setView("active")}
          className={`rounded-lg px-3 py-2 ${view === "active" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
          Pendientes ({active.length})
        </button>
        <button onClick={() => setView("done")}
          className={`rounded-lg px-3 py-2 ${view === "done" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
          Historial ({done.length})
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                <span className="mr-1 text-gold">#{(r as { order_no?: number }).order_no ?? "—"}</span>
                {r.profile?.full_name || "Usuario"} · {r.phone}
              </div>
              <div className="text-[11px] text-muted-foreground">{r.promo_title}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("es")}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gold">{formatMoney(Number(r.price_brl), "BRL")}</div>
            </div>
          </div>
          <CopyList lines={[
            ["Teléfono a recargar", r.phone],
            ["Recarga", r.promo_title],
            ["Monto pagado", formatMoney(Number(r.price_brl), "BRL")],
          ]} />
          <AssignedBadge organizers={organizers.data ?? []} id={(r as { assigned_to?: string | null }).assigned_to} />
          {isAdmin && r.status !== "completed" && r.status !== "rejected" && (
            <AssignAndSend
              organizers={organizers.data ?? []}
              value={assign[r.id] ?? (r as { assigned_to?: string | null }).assigned_to ?? ""}
              onChange={(v) => setAssign((p) => ({ ...p, [r.id]: v }))}
              onSend={(orgId) => upd.mutate({ id: r.id, status: "processing", assignedTo: orgId })}
              disabled={upd.isPending}
            />
          )}
          <div className="flex flex-wrap gap-1">
            {(isAdmin ? (["pending", "completed", "rejected"] as const) : (["completed"] as const)).map((s) => (
              <button key={s} onClick={() => upd.mutate({ id: r.id, status: s })}
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${r.status === s ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}>
                {STATUS_ES[s]}
              </button>
            ))}
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {view === "active" ? "Sin recargas pendientes." : "Sin recargas en el historial."}
        </p>
      )}
    </div>

  );
}

// ----------------- Reportes: totales por día -----------------
function ReportsTab() {
  const q = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("total_brl, origin_currency, status, created_at")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  // Agrupar por día (últimos 14)
  const byDay = new Map<string, { total: number; count: number; completed: number }>();
  q.data?.forEach((t) => {
    const day = new Date(t.created_at).toISOString().slice(0, 10);
    const b = byDay.get(day) ?? { total: 0, count: 0, completed: 0 };
    b.total += Number(t.total_brl);
    b.count += 1;
    if (t.status === "completed") b.completed += 1;
    byDay.set(day, b);
  });
  const days = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  const grandTotal = days.reduce((s, [, v]) => s + v.total, 0);
  const grandCount = days.reduce((s, [, v]) => s + v.count, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gold/40 bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Total procesado</p>
          <p className="font-display text-lg font-bold text-gold">{formatMoney(grandTotal, "BRL")}</p>
        </div>
        <div className="rounded-xl border border-gold/40 bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Remesas</p>
          <p className="font-display text-lg font-bold text-gold">{grandCount}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <BarChart3 className="h-4 w-4 text-gold" />
          <p className="text-xs font-semibold uppercase text-muted-foreground">Totales por día</p>
        </div>
        <ul className="divide-y divide-border text-sm">
          {days.map(([day, v]) => (
            <li key={day} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{new Date(day).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })}</div>
                <div className="text-[11px] text-muted-foreground">{v.count} remesas · {v.completed} completadas</div>
              </div>
              <div className="font-display text-base font-bold text-gold">{formatMoney(v.total, "BRL")}</div>
            </li>
          ))}
          {days.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin datos aún.</li>}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-gold" />
          <p className="text-xs font-extrabold uppercase text-muted-foreground">Trabajo de cada organizador por día</p>
        </div>
        <OrganizerReports />
      </div>
    </div>
  );
}

// ----------------- Métodos de pago US / EU -----------------
function PaymentMethodsTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("*")
        .order("origin_country").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async (p: { id?: string; origin_country: string; label: string; instructions: string; active: boolean; sort_order: number }) => {
      if (p.id) {
        const { error } = await supabase.from("payment_methods").update({
          label: p.label, instructions: p.instructions, active: p.active, sort_order: p.sort_order, origin_country: p.origin_country,
        }).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_methods").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }); qc.invalidateQueries({ queryKey: ["payment-methods"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }); qc.invalidateQueries({ queryKey: ["payment-methods"] }); },
  });

  const [origin, setOrigin] = useState("US");
  const [label, setLabel] = useState("");
  const [instructions, setInstructions] = useState("");

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Nuevo método de pago</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-muted-foreground">Origen</span>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs">
              <option value="US">US (Estados Unidos)</option>
              <option value="EU">EU (Europa)</option>
              <option value="MX">MX (México)</option>
              <option value="BR">BR (Brasil)</option>
            </select>
          </label>
          <MiniInput label="Etiqueta (Zelle, IBAN…)" value={label} onChange={setLabel} />
        </div>
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-muted-foreground">Instrucciones (multilínea)</span>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-gold outline-none font-mono"
            placeholder="Titular:&#10;Email/IBAN:&#10;Banco:" />
        </label>
        <button
          onClick={() => {
            if (!label || !instructions) return toast.error("Falta etiqueta o instrucciones");
            save.mutate({ origin_country: origin, label, instructions, active: true, sort_order: 99 });
            setLabel(""); setInstructions("");
          }}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-gold">
          <Plus className="h-3 w-3" /> Añadir
        </button>
      </div>

      {q.data?.map((p) => (
        <PaymentEditor key={p.id} row={p} onSave={(v) => save.mutate({ id: p.id, ...v })} onDelete={() => del.mutate(p.id)} />
      ))}
    </div>
  );
}

function PaymentEditor({ row, onSave, onDelete }: {
  row: { id: string; origin_country: string; label: string; instructions: string; active: boolean; sort_order: number };
  onSave: (v: { origin_country: string; label: string; instructions: string; active: boolean; sort_order: number }) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [instructions, setInstructions] = useState(row.instructions);
  const [active, setActive] = useState(row.active);
  const [sortOrder, setSortOrder] = useState(String(row.sort_order));
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gold">{row.origin_country}</span>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
            className="h-3 w-3 accent-[color:var(--gold)]" />
          Activo
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Etiqueta" value={label} onChange={setLabel} />
        <MiniInput label="Orden" value={sortOrder} onChange={setSortOrder} />
      </div>
      <label className="block">
        <span className="mb-0.5 block text-[10px] text-muted-foreground">Instrucciones</span>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-gold outline-none font-mono" />
      </label>
      <div className="flex gap-2">
        <button onClick={() => onSave({ origin_country: row.origin_country, label, instructions, active, sort_order: Number(sortOrder) || 0 })}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-gold">
          <Check className="h-3 w-3" /> Guardar
        </button>
        <button onClick={onDelete} className="rounded-lg border border-destructive/40 bg-card px-3 py-1.5 text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// silence tree-shake
void Loader2; void Zap;



// ----------------- Historial de pagos Mercado Pago -----------------
function MercadoPagoTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-mp-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mercadopago_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const statusStyle = (s: string) =>
    s === "completed" ? "bg-success/15 text-success"
      : s === "processing" ? "bg-primary/15 text-primary"
      : s === "rejected" ? "bg-destructive/15 text-destructive"
      : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Pagos Mercado Pago</p>
            <p className="font-display text-xl font-bold">{q.data?.length ?? 0}</p>
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-mp-payments"] })}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold">
          <RefreshCw className={`h-3 w-3 ${q.isFetching ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {q.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {!q.isLoading && !q.data?.length && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Aún no hay pagos de Mercado Pago registrados.
        </p>
      )}

      {q.data?.map((p) => (
        <div key={p.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{p.tracking_id}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(p.created_at).toLocaleString("es")}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-primary">{formatMoney(Number(p.amount), p.currency)}</div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle(p.internal_status)}`}>
                {p.internal_status}
              </span>
            </div>
          </div>

          <dl className="space-y-1 text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">transactionId</dt>
              <dd className="truncate font-mono">{p.transaction_id}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">preferenceId</dt>
              <dd className="truncate font-mono">{p.preference_id || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">paymentId · estado MP</dt>
              <dd className="truncate font-mono">{p.mp_payment_id || "—"} · {p.mp_status || "—"}</dd>
            </div>
          </dl>

          {p.checkout_url && (
            <div className="flex gap-2">
              <a href={p.checkout_url} target="_blank" rel="noopener noreferrer"
                className="flex-1 truncate rounded-lg border border-border px-2 py-1.5 text-center text-[11px] font-semibold text-primary">
                Abrir checkoutUrl
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(p.checkout_url!); toast.success("Enlace copiado"); }}
                className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold">
                Copiar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ----------------- VipTienda: productos -----------------
type StoreRow = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_brl: number | string;
  images: string[] | null;
  active: boolean;
  sort_order: number;
  province: string | null;
};


/** Sube una imagen al bucket privado y devuelve una URL firmada de larga duración. */
async function uploadStoreImage(file: File, folder = "products"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Solo se permiten imágenes (JPG, PNG o WEBP)");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen pesa más de 8 MB. Usa una más liviana.");
  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = rawExt || (file.type.split("/")[1] ?? "jpg");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("banners").upload(path, file, {
    cacheControl: "31536000", upsert: false, contentType: file.type,
  });
  if (error) {
    const msg = /row-level security|Unauthorized|403/i.test(error.message)
      ? "Tu cuenta no tiene permiso para subir imágenes."
      : error.message;
    throw new Error(msg);
  }
  const { data: signed, error: sErr } = await supabase.storage.from("banners")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr || !signed) throw sErr ?? new Error("No se pudo firmar la imagen");
  return signed.signedUrl;
}


function StoreTab() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("celulares");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [province, setProvince] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);


  const q = useQuery<StoreRow[]>({
    queryKey: ["admin-store"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_products").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as StoreRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-store"] });
    qc.invalidateQueries({ queryKey: ["store-products"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Ponle un nombre al producto");
      const { error } = await supabase.from("store_products").insert({
        category, title: title.trim(), description: description.trim() || null,
        price_brl: Number(price.replace(",", ".")) || 0, images,
        province: province || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh(); setTitle(""); setPrice(""); setDescription(""); setImages([]);
      toast.success("Producto publicado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const update = useMutation({
    mutationFn: async (p: {
      id: string;
      category?: string;
      title?: string;
      description?: string | null;
      price_brl?: number;
      images?: string[];
      active?: boolean;
      sort_order?: number;
      province?: string | null;
    }) => {

      const { id, ...rest } = p;
      const { error } = await supabase.from("store_products").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Producto actualizado"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Producto eliminado"); },
  });

  async function addFiles(files: FileList, target?: StoreRow) {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadStoreImage(f));
      if (target) update.mutate({ id: target.id, images: [...(target.images ?? []), ...urls] });
      else setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/40 bg-card p-3 space-y-2">
        <p className="text-xs font-bold uppercase text-muted-foreground">Nuevo producto</p>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Catálogo</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-gold">
            <option value="celulares">Celulares, tablets y accesorios</option>
            <option value="electrodomesticos">Electrodomésticos</option>
              <option value="alimentos">Alimentos y combos</option>
          </select>
        </label>
        <MiniInput label="Nombre" value={title} onChange={setTitle} />
        <MiniInput label="Precio (BRL)" value={price} onChange={setPrice} />
        <MiniInput label="Descripción" value={description} onChange={setDescription} />
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Provincia</span>
          <select value={province} onChange={(e) => setProvince(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-gold">
            <option value="">Toda Cuba</option>
            {CUBA_PROVINCES.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
          </select>
        </label>

        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((src) => (
              <img key={src} src={src} alt="" loading="lazy" decoding="async" width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        )}
        <label className={`flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-gold/50 px-3 py-2 text-xs font-bold text-gold ${uploading ? "opacity-60" : ""}`}>
          <Plus className="h-3 w-3" /> {uploading ? "Subiendo…" : "Agregar fotos"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
            onChange={(e) => { const fs = e.target.files; if (fs?.length) void addFiles(fs); e.currentTarget.value = ""; }} />
        </label>
        <button onClick={() => create.mutate()} disabled={create.isPending || uploading}
          className="w-full rounded-lg bg-gradient-gold px-3 py-2 text-xs font-bold text-primary-foreground shadow-gold disabled:opacity-60">
          Publicar producto
        </button>
      </div>

      {q.data?.map((p) => (
        <div key={p.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex gap-2 overflow-x-auto">
            {(p.images ?? []).map((src) => (
              <img key={src} src={src} alt="" loading="lazy" decoding="async" width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
          <MiniInput label="Nombre" value={p.title} onChange={(v) => update.mutate({ id: p.id, title: v })} />
          <div className="grid grid-cols-2 gap-2">
            <MiniInput label="Precio BRL" value={String(p.price_brl)} onChange={(v) => update.mutate({ id: p.id, price_brl: Number(v.replace(",", ".")) || 0 })} />
            <MiniInput label="Orden" value={String(p.sort_order)} onChange={(v) => update.mutate({ id: p.id, sort_order: Number(v) || 0 })} />
          </div>
          <MiniInput label="Descripción" value={p.description ?? ""} onChange={(v) => update.mutate({ id: p.id, description: v })} />
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Catálogo</span>
            <select value={p.category} onChange={(e) => update.mutate({ id: p.id, category: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
              <option value="celulares">Celulares, tablets y accesorios</option>
              <option value="electrodomesticos">Electrodomésticos</option>
              <option value="alimentos">Alimentos y combos</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Provincia</span>
            <select value={p.province ?? ""} onChange={(e) => update.mutate({ id: p.id, province: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
              <option value="">Toda Cuba</option>
              {CUBA_PROVINCES.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
            </select>
          </label>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <input type="checkbox" checked={p.active}
                onChange={(e) => update.mutate({ id: p.id, active: e.target.checked })}
                className="h-3 w-3 accent-[color:var(--gold)]" />
              Visible
            </label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-gold/50 px-2 py-1 text-[11px] font-bold text-gold">
                Fotos +
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { const fs = e.target.files; if (fs?.length) void addFiles(fs, p); e.currentTarget.value = ""; }} />
              </label>
              {(p.images ?? []).length > 0 && (
                <button onClick={() => update.mutate({ id: p.id, images: [] })}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold">
                  Borrar fotos
                </button>
              )}
              <button onClick={() => del.mutate(p.id)} className="rounded-md p-1 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
      {q.data && q.data.length === 0 && (
        <p className="text-sm font-semibold text-muted-foreground">Aún no hay productos en VipTienda.</p>
      )}
    </div>
  );
}


// ----------------- VipShop: pedidos -----------------
type StoreOrderRow = {
  id: string;
  order_no: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_id_card: string;
  recipient_address: string;
  items: { title: string; qty: number; price_brl: number; province?: string | null }[] | null;
  total_brl: number | string;
  status: string;
  created_at: string;
  assigned_to?: string | null;
};

function StoreOrdersTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const organizers = useOrganizers(isAdmin);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const q = useQuery<StoreOrderRow[]>({
    queryKey: ["store-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StoreOrderRow[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (p: { id: string; status: string; assignedTo?: string | null }) => {
      const patch: { status: "pending" | "processing" | "completed" | "rejected"; assigned_to?: string | null } = {
        status: p.status as "pending" | "processing" | "completed" | "rejected",
      };
      if (p.status === "processing") patch.assigned_to = p.assignedTo || null;
      const { error } = await supabase.from("store_orders").update(patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["store-orders"] }); toast.success("Pedido actualizado"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const active = (q.data ?? []).filter((o) => o.status === "pending" || o.status === "processing");
  const done = (q.data ?? []).filter((o) => o.status === "completed" || o.status === "rejected");

  const Card = ({ o, i }: { o: StoreOrderRow; i: number }) => {
    const productos = (o.items ?? [])
      .map((it) => `${it.qty}× ${it.title} (${formatMoney(Number(it.price_brl) * it.qty, "BRL")})`)
      .join("\n");
    const lines: [string, string][] = [
      ["Productos a entregar", productos],
      ["Nombre", o.recipient_name],
      ["Teléfono", o.recipient_phone],
      ["Carnet", o.recipient_id_card],
      ["Dirección", o.recipient_address],
      ["Total pagado", formatMoney(Number(o.total_brl), "BRL")],
    ];
    return (
      <div
        style={{ animationDelay: `${i * 40}ms` }}
        className="animate-rise space-y-2 rounded-xl border border-border bg-card p-3 shadow-card"
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-extrabold">Pedido #{o.order_no}</p>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-extrabold uppercase">
            {STATUS_ES[o.status] ?? o.status}
          </span>
        </div>
        <p className="text-[11px] font-bold text-muted-foreground">{new Date(o.created_at).toLocaleString("es")}</p>
        <CopyList lines={lines} />
        <AssignedBadge organizers={organizers.data ?? []} id={o.assigned_to} />
        {isAdmin && o.status !== "completed" && o.status !== "rejected" && (
          <AssignAndSend
            organizers={organizers.data ?? []}
            value={assign[o.id] ?? o.assigned_to ?? ""}
            onChange={(v) => setAssign((p) => ({ ...p, [o.id]: v }))}
            onSend={(orgId) => setStatus.mutate({ id: o.id, status: "processing", assignedTo: orgId })}
            disabled={setStatus.isPending}
          />
        )}
        <div className="flex gap-2">
          {o.status !== "completed" && (
            <button onClick={() => setStatus.mutate({ id: o.id, status: "completed" })}
              className="flex-1 rounded-lg bg-gradient-emerald px-2 py-2 text-[11px] font-extrabold text-white shadow-glow">
              <Check className="mr-1 inline h-3 w-3" />Listo
            </button>
          )}
          {isAdmin && o.status !== "rejected" && o.status !== "completed" && (
            <button onClick={() => setStatus.mutate({ id: o.id, status: "rejected" })}
              className="rounded-lg border border-destructive px-2 py-2 text-[11px] font-extrabold text-destructive">
              Rechazar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {q.isLoading && <p className="text-sm font-bold text-muted-foreground">Cargando pedidos…</p>}
      {q.isError && (
        <p className="rounded-xl border border-destructive/50 bg-card p-3 text-sm font-bold text-destructive">
          No se pudieron cargar los pedidos.
        </p>
      )}
      {!q.isLoading && active.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm font-bold text-muted-foreground">
          No hay pedidos pendientes de VipShop.
        </p>
      )}
      {active.map((o, i) => <Card key={o.id} o={o} i={i} />)}
      {done.length > 0 && (
        <details className="rounded-xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-xs font-extrabold uppercase text-muted-foreground">
            Historial de pedidos ({done.length})
          </summary>
          <div className="mt-2 space-y-2">
            {done.map((o, i) => <Card key={o.id} o={o} i={i} />)}
          </div>
        </details>
      )}
    </div>
  );
}

// ----------------- Utilidades compartidas: copiar / asignar -----------------
/** Lista de datos con copiado individual y "Copiar todo". */
function CopyList({ lines }: { lines: [string, string][] }) {
  const shown = lines.filter(([, v]) => (v ?? "").toString().trim().length > 0);
  if (shown.length === 0) return null;
  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }
  return (
    <div className="space-y-1 rounded-lg border border-gold/40 bg-background/60 p-2">
      {shown.map(([label, value]) => (
        <button key={label} onClick={() => copy(value, label)}
          className="flex w-full items-start gap-2 text-left text-[12px] font-bold text-foreground hover:text-gold">
          <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
          <span className="min-w-0 whitespace-pre-line break-words">
            <span className="text-muted-foreground">{label}: </span>{value}
          </span>
        </button>
      ))}
      <button onClick={() => copy(shown.map(([l, v]) => `${l}: ${v}`).join("\n"), "Todo")}
        className="w-full rounded-md bg-gradient-gold px-2 py-1 text-[11px] font-bold text-primary-foreground">
        Copiar todo
      </button>
    </div>
  );
}

/** Selector obligatorio de organizador + botón de envío (pasa a "Procesando"). */
function AssignAndSend({
  organizers, value, onChange, onSend, disabled,
}: {
  organizers: Organizer[];
  value: string;
  onChange: (v: string) => void;
  onSend: (organizerId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-background/60 p-2">
      <OrgPicker organizers={organizers} value={value} onChange={onChange} />
      <button
        disabled={disabled}
        onClick={() => {
          if (!value) { toast.error("Elige el organizador que va a procesar"); return; }
          onSend(value);
        }}
        className="w-full rounded-lg bg-gradient-sky px-2 py-2 text-[11px] font-extrabold text-white shadow-glow disabled:opacity-60">
        Enviar a organizador (Procesando)
      </button>
      {organizers.length === 0 && (
        <p className="text-[10px] font-bold text-muted-foreground">
          No hay organizadores todavía: actívalos en la pestaña Usuarios.
        </p>
      )}
    </div>
  );
}

// ----------------- Historial diario (organizador / admin) -----------------
type DailyRow = {
  kind: "Remesa" | "Recarga" | "Pedido";
  id: string;
  when: string;
  status: string;
  who: string;
  detail: string;
  amount: number;
  currency: string;
  assigned_to: string | null;
};

function useDailyWork(enabled: boolean, onlyMine: string | null) {
  return useQuery<DailyRow[]>({
    queryKey: ["daily-work", onlyMine ?? "all"],
    enabled,
    queryFn: async () => {
      const tx = supabase.from("transactions")
        .select("id, created_at, status, recipient_name, method_category, total_brl, origin_currency, amount_dest, dest_currency, assigned_to")
        .order("created_at", { ascending: false }).limit(300);
      const rc = supabase.from("recargas_requests")
        .select("id, created_at, status, phone, promo_title, price_brl, assigned_to")
        .order("created_at", { ascending: false }).limit(300);
      const so = supabase.from("store_orders")
        .select("id, created_at, status, recipient_name, total_brl, assigned_to")
        .order("created_at", { ascending: false }).limit(300);
      const [a, b, c] = await Promise.all([tx, rc, so]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      if (c.error) throw c.error;
      const rows: DailyRow[] = [
        ...(a.data ?? []).map((t) => ({
          kind: "Remesa" as const, id: t.id, when: t.created_at, status: t.status as string,
          who: t.recipient_name,
          detail: `${(t.method_category ?? "transferencia") === "efectivo" ? "Efectivo" : "Transferencia"} · ${formatMoney(Number(t.amount_dest), t.dest_currency || "CUP")}`,
          amount: Number(t.total_brl), currency: (t.origin_currency as string) || "BRL",
          assigned_to: (t.assigned_to as string | null) ?? null,
        })),
        ...(b.data ?? []).map((r) => ({
          kind: "Recarga" as const, id: r.id, when: r.created_at, status: r.status as string,
          who: r.phone, detail: r.promo_title, amount: Number(r.price_brl), currency: "BRL",
          assigned_to: (r.assigned_to as string | null) ?? null,
        })),
        ...(c.data ?? []).map((o) => ({
          kind: "Pedido" as const, id: o.id, when: o.created_at, status: o.status as string,
          who: o.recipient_name, detail: "VipShop", amount: Number(o.total_brl), currency: "BRL",
          assigned_to: (o.assigned_to as string | null) ?? null,
        })),
      ];
      const filtered = onlyMine ? rows.filter((r) => r.assigned_to === onlyMine) : rows;
      return filtered.sort((x, y) => (x.when < y.when ? 1 : -1));
    },
  });
}

function dayKey(iso: string) { return new Date(iso).toISOString().slice(0, 10); }
function dayText(key: string) {
  return new Date(key).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" });
}

/** "Mi día": todo lo que un organizador (o el admin) procesó, agrupado por día. */
function MyWorkTab({ userId }: { userId: string }) {
  const q = useDailyWork(true, userId);
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const rows = (q.data ?? []).filter((r) => r.status === "completed" || r.status === "processing");
  const byDay = new Map<string, DailyRow[]>();
  rows.forEach((r) => {
    const k = dayKey(r.when);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  });
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  if (days.length === 0) return <p className="text-sm text-muted-foreground">Todavía no tienes trabajo asignado.</p>;
  return (
    <div className="space-y-3">
      {days.map(([day, list]) => <DaySummaryCard key={day} day={day} list={list} />)}
    </div>
  );
}

function DaySummaryCard({ day, list, title }: { day: string; list: DailyRow[]; title?: string }) {
  const isToday = day === new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(isToday);
  const done = list.filter((r) => r.status === "completed");
  const totalBRL = done.filter((r) => r.currency === "BRL").reduce((s, r) => s + r.amount, 0);
  const counts = {
    Remesa: done.filter((r) => r.kind === "Remesa").length,
    Recarga: done.filter((r) => r.kind === "Recarga").length,
    Pedido: done.filter((r) => r.kind === "Pedido").length,
  };
  const efectivo = done.filter((r) => r.kind === "Remesa" && r.detail.startsWith("Efectivo")).length;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 border-b border-border p-3 text-left transition-colors hover:bg-secondary/50">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${open ? "bg-gradient-gold text-primary-foreground shadow-gold" : "bg-secondary text-gold"}`}>
          {open ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-extrabold capitalize">{title ? `${title} · ${dayText(day)}` : dayText(day)}</span>
          <span className="block text-[11px] font-bold text-muted-foreground">
            {counts.Remesa} remesas ({efectivo} efectivo / {counts.Remesa - efectivo} transferencia) ·{" "}
            {counts.Recarga} recargas · {counts.Pedido} pedidos
          </span>
          <span className="block font-display text-base font-extrabold text-gold">{formatMoney(totalBRL, "BRL")} completado</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
      <ul className="animate-rise divide-y divide-border text-[12px]">

        {list.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-2 p-2">
            <span className="min-w-0">
              <span className="mr-1 rounded bg-secondary px-1 py-0.5 text-[10px] font-extrabold">{r.kind}</span>
              <span className="font-bold">{r.who}</span>
              <span className="block text-[10px] font-semibold text-muted-foreground">
                {r.detail} · {STATUS_ES[r.status] ?? r.status} ·{" "}
                {new Date(r.when).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
            <span className="shrink-0 font-extrabold text-destructive">{formatMoney(r.amount, r.currency)}</span>
          </li>
        ))}
      </ul>
      )}

    </section>
  );
}

/** Reporte del admin: qué hizo cada organizador, por día. */
function OrganizerReports() {
  const organizers = useOrganizers(true);
  const q = useDailyWork(true, null);
  if (q.isLoading || organizers.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const rows = (q.data ?? []).filter((r) => r.assigned_to);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay trabajo asignado a organizadores.</p>;
  }
  const groups = new Map<string, DailyRow[]>();
  rows.forEach((r) => {
    const k = `${r.assigned_to}|${dayKey(r.when)}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  });
  const entries = [...groups.entries()].sort((a, b) => (a[0].split("|")[1] < b[0].split("|")[1] ? 1 : -1));
  return (
    <div className="space-y-3">
      {entries.map(([key, list]) => {
        const [orgId, day] = key.split("|");
        const o = (organizers.data ?? []).find((x) => x.id === orgId);
        return <DaySummaryCard key={key} day={day} list={list} title={o ? orgLabel(o) : "Organizador"} />;
      })}
    </div>
  );
}
