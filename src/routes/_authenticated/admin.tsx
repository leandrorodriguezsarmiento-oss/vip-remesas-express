import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { deleteUserAsAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Shield, Loader2, Trash2, Plus, Check, RefreshCw, Smartphone, Zap, BarChart3 } from "lucide-react";

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

type Tab = "tx" | "recargas" | "rates" | "promos" | "users" | "api" | "banners" | "payments" | "reports";

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

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1 text-[10px] font-medium">
        {[
          ["tx", "Remesas"], ["recargas", "Recargas"], ["reports", "Reportes"],
          ["rates", "Tasas"], ["promos", "Promos"], ["banners", "Banners"],
          ["payments", "Pagos US/EU"], ["users", "Usuarios"], ["api", "API"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`shrink-0 rounded-lg px-3 py-2 ${tab === id ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "tx" && <TransactionsTab />}
      {tab === "recargas" && <RecargasTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "rates" && <RatesTab />}
      {tab === "promos" && <PromosTab />}
      {tab === "banners" && <BannersTab />}
      {tab === "payments" && <PaymentMethodsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "api" && <ApiTab />}
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
            {(["pending", "processing", "completed", "rejected"] as const).map((s) => (
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
  const qc = useQueryClient();
  const delUser = useServerFn(deleteUserAsAdmin);
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const del = useMutation({
    mutationFn: async (userId: string) => delUser({ data: { userId } }),
    onSuccess: () => { toast.success("Usuario eliminado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="space-y-2">
      {q.data?.map((u) => (
        <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{u.full_name || "(sin nombre)"}</div>
            <div className="text-[11px] text-muted-foreground">{u.phone || "sin teléfono"}</div>
            <div className="text-[10px] text-muted-foreground">Alta: {new Date(u.created_at).toLocaleDateString("es")}</div>
          </div>
          <button
            onClick={() => {
              if (confirm(`¿Eliminar a ${u.full_name || "este usuario"}? Se borran sus remesas y datos.`)) {
                del.mutate(u.id);
              }
            }}
            className="rounded-md p-2 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </button>
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
        <button onClick={() => save.mutate()}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground shadow-gold">
          <Check className="h-3 w-3" /> Guardar
        </button>
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
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("banners").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      // Signed URL válido 10 años (bucket privado con lectura pública vía RLS)
      const { data: signed, error: sErr } = await supabase.storage.from("banners")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) throw sErr ?? new Error("No se pudo firmar la imagen");
      upsert.mutate({ image_url: signed.signedUrl, title, link_url: link });
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
          <img src={b.image_url} alt={b.title ?? ""} className="aspect-[16/7] w-full rounded-lg object-cover" />
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

// silence the Loader2 tree-shake in some paths
void Loader2;

