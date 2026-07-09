import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { toast } from "sonner";
import { Shield, Loader2, Trash2, Plus, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: AdminPanel,
});

type Tab = "tx" | "rates" | "promos" | "users";

function AdminPanel() {
  const [tab, setTab] = useState<Tab>("tx");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold shadow-gold">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Panel admin</h1>
          <p className="text-xs text-muted-foreground">Control total de VIP Remesas</p>
        </div>
      </div>

      <div className="grid grid-cols-4 rounded-xl bg-secondary p-1 text-[11px] font-medium">
        {[
          ["tx", "Remesas"], ["rates", "Tasas"], ["promos", "Promos"], ["users", "Usuarios"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`rounded-lg px-2 py-2 ${tab === id ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "tx" && <TransactionsTab />}
      {tab === "rates" && <RatesTab />}
      {tab === "promos" && <PromosTab />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

// ----------------- Transacciones -----------------
function TransactionsTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-tx"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const upd = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "processing" | "completed" | "rejected" }) => {
      const { error } = await supabase.from("transactions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["admin-tx"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-2">
      {q.data?.map((t) => (
        <div key={t.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{t.recipient_name}</div>
              <div className="text-[11px] text-muted-foreground">
                {t.tracking_id} · {new Date(t.created_at).toLocaleString("es")}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {(t as { origin_country?: string }).origin_country ?? "BR"} →
                {" "}{t.dest_currency} ({(t as { method_category?: string }).method_category ?? "—"})
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gold">
                {formatMoney(Number(t.total_brl), (t as { origin_currency?: string }).origin_currency || "BRL")}
              </div>
              <div className="text-[11px] text-muted-foreground">
                → {formatMoney(Number(t.amount_dest), t.dest_currency)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {["pending", "processing", "completed", "rejected"].map((s) => (
              <button key={s}
                onClick={() => upd.mutate({ id: t.id, status: s })}
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${t.status === s ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
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
    mutationFn: async (p: { title: string; description: string; price_brl: number; bonus_label: string }) => {
      const { error } = await supabase.from("promos").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Promo creada"); qc.invalidateQueries({ queryKey: ["admin-promos"] }); qc.invalidateQueries({ queryKey: ["promos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const [nt, setNt] = useState(""); const [nd, setNd] = useState("");
  const [np, setNp] = useState(""); const [nb, setNb] = useState("");

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
        <button
          onClick={() => {
            if (!nt || !np) return toast.error("Título y precio requeridos");
            add.mutate({ title: nt, description: nd, price_brl: Number(np), bonus_label: nb });
            setNt(""); setNd(""); setNp(""); setNb("");
          }}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-gold">
          <Plus className="h-3 w-3" /> Añadir
        </button>
      </div>

      {q.data?.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{p.title}</div>
            <div className="text-[11px] text-muted-foreground">{p.description}</div>
            <div className="text-[11px] font-medium text-gold">{p.bonus_label}</div>
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
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="space-y-2">
      {q.data?.map((u) => (
        <div key={u.id} className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-semibold">{u.full_name || "(sin nombre)"}</div>
          <div className="text-[11px] text-muted-foreground">{u.phone || "sin teléfono"}</div>
          <div className="text-[10px] text-muted-foreground">Alta: {new Date(u.created_at).toLocaleDateString("es")}</div>
        </div>
      ))}
      {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay usuarios.</p>}
    </div>
  );
}

// silence the Loader2 tree-shake in some paths
void Loader2;
