import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { deleteUserAsAdmin } from "@/lib/admin.functions";
import { syncRecharges } from "@/lib/payments.functions";
import { toast } from "sonner";
import { Shield, Loader2, Trash2, Plus, Check, RefreshCw, Smartphone, Zap, BarChart3, CreditCard } from "lucide-react";

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

type Tab = "tx" | "recargas" | "rates" | "promos" | "users" | "api" | "banners" | "payments" | "mp" | "reports";

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
          ["payments", "Pagos US/EU"], ["mp", "Mercado Pago"], ["users", "Usuarios"], ["api", "API"],
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
      {tab === "mp" && <MercadoPagoTab />}
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
        <div className="flex gap-2">
          <button onClick={() => save.mutate()}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground shadow-gold">
            <Check className="h-3 w-3" /> Guardar
          </button>
          <SyncRecargasButton />
        </div>
      </div>
    </div>
  );
}

// Botón reutilizable: despacha recargas pendientes al proveedor y actualiza estados
function SyncRecargasButton({ full = false }: { full?: boolean }) {
  const qc = useQueryClient();
  const sync = useServerFn(syncRecharges);
  const m = useMutation({
    mutationFn: async () => await sync({ data: undefined }),
    onSuccess: (r) => {
      const parts = [
        `${r.dispatched} despachadas`,
        `${r.completed} completadas`,
        r.rejected ? `${r.rejected} rechazadas` : null,
        r.stillProcessing ? `${r.stillProcessing} en proceso` : null,
      ].filter(Boolean).join(" · ");
      toast.success(`Sincronizado (${r.provider}): ${parts}`);
      if (r.errors.length) toast.error(r.errors[0]);
      qc.invalidateQueries({ queryKey: ["admin-recargas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al sincronizar"),
  });
  return (
    <button
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className={`${full ? "w-full" : ""} flex items-center justify-center gap-1 rounded-lg border border-gold/40 bg-card px-3 py-2 text-xs font-semibold text-gold disabled:opacity-60`}>
      {m.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Sincronizar
    </button>
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

// ----------------- Recargas Cubacel pendientes -----------------
function RecargasTab() {
  const qc = useQueryClient();
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

  const upd = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "processing" | "completed" | "rejected" }) => {
      const { error } = await supabase.from("recargas_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["admin-recargas"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const pendingCount = q.data?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-gold" />
        <div className="flex-1">
          <p className="text-xs uppercase text-muted-foreground">Recargas pendientes</p>
          <p className="font-display text-xl font-bold text-gold">{pendingCount}</p>
        </div>
        <SyncRecargasButton />
      </div>
      {q.data?.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {r.profile?.full_name || "Usuario"} · {r.phone}
              </div>
              <div className="text-[11px] text-muted-foreground">{r.promo_title}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("es")}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gold">{formatMoney(Number(r.price_brl), "BRL")}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["pending", "processing", "completed", "rejected"] as const).map((s) => (
              <button key={s} onClick={() => upd.mutate({ id: r.id, status: s })}
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${r.status === s ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
      {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">Sin recargas pendientes.</p>}
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
