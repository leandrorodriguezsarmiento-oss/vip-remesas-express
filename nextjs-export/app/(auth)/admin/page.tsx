"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/remittance";
import { toast } from "sonner";
import { Shield, Loader2, Trash2, Plus, Check, Smartphone, BarChart3 } from "lucide-react";

type Tab = "tx" | "recargas" | "rates" | "promos" | "users" | "payments" | "reports";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tx");
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/auth");
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!data) return router.replace("/dashboard");
      setChecked(true);
    })();
  }, [router]);
  if (!checked) return <div className="flex justify-center pt-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold shadow-gold"><Shield className="h-5 w-5 text-primary-foreground" /></div>
        <div><h1 className="font-display text-2xl font-bold">Panel admin</h1><p className="text-xs text-muted-foreground">VIP Remesas</p></div>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1 text-[10px] font-medium">
        {[["tx","Remesas"],["recargas","Recargas"],["reports","Reportes"],["rates","Tasas"],["promos","Promos"],["payments","Pagos"],["users","Usuarios"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`shrink-0 rounded-lg px-3 py-2 ${tab === id ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>{label}</button>
        ))}
      </div>
      {tab === "tx" && <TxTab />}
      {tab === "recargas" && <RecargasTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "rates" && <RatesTab />}
      {tab === "promos" && <PromosTab />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

function TxTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["a-tx"], queryFn: async () => (await supabase.from("transactions").select("*").order("created_at",{ascending:false}).limit(50)).data ?? [] });
  const upd = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { await supabase.from("transactions").update({ status }).eq("id", id); },
    onSuccess: () => { toast.success("Actualizado"); qc.invalidateQueries({ queryKey: ["a-tx"] }); },
  });
  return (
    <div className="space-y-2">
      {q.data?.map((t) => (
        <div key={t.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex justify-between text-sm">
            <div><div className="font-semibold">{t.recipient_name}</div><div className="text-[11px] text-muted-foreground">{t.tracking_id}</div></div>
            <div className="text-right"><div className="font-bold text-gold">{formatMoney(Number(t.total_brl), t.origin_currency || "BRL")}</div></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {["pending","processing","completed","rejected"].map((s) => (
              <button key={s} onClick={() => upd.mutate({ id: t.id, status: s })}
                className={`rounded-full px-2 py-1 text-[10px] ${t.status === s ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}>{s}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecargasTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey:["a-rec"], queryFn: async () => (await supabase.from("recargas_requests").select("*").order("created_at",{ascending:false}).limit(100)).data ?? [] });
  const upd = useMutation({
    mutationFn: async ({id,status}:{id:string;status:string}) => { await supabase.from("recargas_requests").update({status}).eq("id",id); },
    onSuccess: () => { toast.success("OK"); qc.invalidateQueries({queryKey:["a-rec"]}); },
  });
  const pending = q.data?.filter((r) => r.status === "pending").length ?? 0;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-gold" />
        <div><p className="text-xs text-muted-foreground">Pendientes</p><p className="font-display text-xl font-bold text-gold">{pending}</p></div>
      </div>
      {q.data?.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex justify-between text-sm">
            <div><div className="font-semibold">{r.phone}</div><div className="text-[11px] text-muted-foreground">{r.promo_title}</div></div>
            <div className="font-bold text-gold">{formatMoney(Number(r.price_brl),"BRL")}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {["pending","processing","completed","rejected"].map((s) => (
              <button key={s} onClick={() => upd.mutate({id:r.id,status:s})}
                className={`rounded-full px-2 py-1 text-[10px] ${r.status===s ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}>{s}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsTab() {
  const q = useQuery({ queryKey:["a-rep"], queryFn: async () => (await supabase.from("transactions").select("total_brl,status,created_at").order("created_at",{ascending:false}).limit(500)).data ?? [] });
  const byDay = new Map<string, { total: number; count: number }>();
  q.data?.forEach((t) => {
    const d = new Date(t.created_at).toISOString().slice(0,10);
    const b = byDay.get(d) ?? { total: 0, count: 0 };
    b.total += Number(t.total_brl); b.count += 1; byDay.set(d, b);
  });
  const days = Array.from(byDay.entries()).sort((a,b) => b[0].localeCompare(a[0])).slice(0,14);
  const total = days.reduce((s,[,v]) => s+v.total, 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gold/40 bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Total</p><p className="font-display text-lg font-bold text-gold">{formatMoney(total,"BRL")}</p></div>
        <div className="rounded-xl border border-gold/40 bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Remesas</p><p className="font-display text-lg font-bold text-gold">{days.reduce((s,[,v])=>s+v.count,0)}</p></div>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-3"><BarChart3 className="h-4 w-4 text-gold" /><p className="text-xs font-semibold uppercase text-muted-foreground">Por día</p></div>
        <ul className="divide-y divide-border text-sm">
          {days.map(([d,v]) => (
            <li key={d} className="flex justify-between p-3">
              <div><div className="font-medium">{new Date(d).toLocaleDateString("es")}</div><div className="text-[11px] text-muted-foreground">{v.count} remesas</div></div>
              <div className="font-bold text-gold">{formatMoney(v.total,"BRL")}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RatesTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey:["a-rates"], queryFn: async () => (await supabase.from("rates").select("*").order("origin_country")).data ?? [] });
  const upd = useMutation({
    mutationFn: async (r: any) => { await supabase.from("rates").update({rate:r.rate, active:r.active}).eq("id",r.id); },
    onSuccess: () => { toast.success("OK"); qc.invalidateQueries({queryKey:["a-rates"]}); qc.invalidateQueries({queryKey:["rates"]}); },
  });
  return (
    <div className="space-y-2">
      {q.data?.map((r) => (
        <RateEditor key={r.id} row={r} onSave={(v) => upd.mutate({id:r.id, ...v})} />
      ))}
    </div>
  );
}
function RateEditor({row,onSave}:{row:any;onSave:(v:{rate:number;active:boolean})=>void}) {
  const [rate,setRate] = useState(String(row.rate)); const [active,setActive] = useState(row.active);
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex justify-between text-xs font-semibold"><span>{row.origin_country}·{row.method_category}·{row.dest_currency}</span>
        <label className="flex gap-1"><input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} className="h-3 w-3"/>Activa</label>
      </div>
      <input value={rate} onChange={(e)=>setRate(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
      <button onClick={()=>onSave({rate:Number(rate),active})} className="w-full rounded-lg bg-gradient-gold px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-gold"><Check className="inline h-3 w-3 mr-1"/>Guardar</button>
    </div>
  );
}

function PromosTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey:["a-promos"], queryFn: async () => (await supabase.from("promos").select("*").order("price_brl")).data ?? [] });
  const add = useMutation({
    mutationFn: async (p:{title:string;description:string;price_brl:number;bonus_label:string}) => { await supabase.from("promos").insert(p); },
    onSuccess: () => { toast.success("Añadida"); qc.invalidateQueries({queryKey:["a-promos"]}); qc.invalidateQueries({queryKey:["promos"]}); },
  });
  const del = useMutation({
    mutationFn: async (id:string) => { await supabase.from("promos").delete().eq("id",id); },
    onSuccess: () => { qc.invalidateQueries({queryKey:["a-promos"]}); qc.invalidateQueries({queryKey:["promos"]}); },
  });
  const [t,setT] = useState(""); const [d,setD] = useState(""); const [p,setP] = useState(""); const [b,setB] = useState("");
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 space-y-2">
        <input placeholder="Título" value={t} onChange={(e)=>setT(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <input placeholder="Descripción" value={d} onChange={(e)=>setD(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Precio BRL" value={p} onChange={(e)=>setP(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          <input placeholder="Bono" value={b} onChange={(e)=>setB(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
        </div>
        <button onClick={()=>{if(!t||!p)return; add.mutate({title:t,description:d,price_brl:Number(p),bonus_label:b}); setT("");setD("");setP("");setB("");}}
          className="w-full rounded-lg bg-gradient-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-gold"><Plus className="inline h-3 w-3 mr-1"/>Añadir</button>
      </div>
      {q.data?.map((pr) => (
        <div key={pr.id} className="flex justify-between rounded-xl border border-border bg-card p-3">
          <div><div className="text-sm font-semibold">{pr.title}</div><div className="text-[11px] text-muted-foreground">{pr.bonus_label}</div></div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gold">{formatMoney(Number(pr.price_brl),"BRL")}</span>
            <button onClick={()=>del.mutate(pr.id)} className="p-1 text-destructive"><Trash2 className="h-4 w-4"/></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey:["a-pm"], queryFn: async () => (await supabase.from("payment_methods").select("*").order("origin_country")).data ?? [] });
  const save = useMutation({
    mutationFn: async (p:any) => { await supabase.from("payment_methods").insert(p); },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({queryKey:["a-pm"]}); qc.invalidateQueries({queryKey:["payment-methods"]}); },
  });
  const del = useMutation({
    mutationFn: async (id:string) => { await supabase.from("payment_methods").delete().eq("id",id); },
    onSuccess: () => { qc.invalidateQueries({queryKey:["a-pm"]}); },
  });
  const [origin,setOrigin] = useState("US"); const [label,setLabel] = useState(""); const [ins,setIns] = useState("");
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/40 bg-card p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select value={origin} onChange={(e)=>setOrigin(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
            <option value="US">US</option><option value="EU">EU</option><option value="BR">BR</option>
          </select>
          <input placeholder="Etiqueta (Zelle, IBAN)" value={label} onChange={(e)=>setLabel(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
        </div>
        <textarea rows={4} value={ins} onChange={(e)=>setIns(e.target.value)} placeholder="Titular:&#10;IBAN/Email:&#10;Banco:" className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs font-mono" />
        <button onClick={()=>{if(!label||!ins)return;save.mutate({origin_country:origin,label,instructions:ins,active:true,sort_order:99});setLabel("");setIns("");}}
          className="w-full rounded-lg bg-gradient-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-gold"><Plus className="inline h-3 w-3 mr-1"/>Añadir</button>
      </div>
      {q.data?.map((p) => (
        <div key={p.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex justify-between text-xs"><span className="font-semibold text-gold">{p.origin_country} · {p.label}</span><button onClick={()=>del.mutate(p.id)} className="text-destructive"><Trash2 className="h-4 w-4"/></button></div>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{p.instructions}</pre>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey:["a-users"], queryFn: async () => (await supabase.from("profiles").select("*").order("created_at",{ascending:false}).limit(100)).data ?? [] });
  const del = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/admin/delete-user", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
    },
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({queryKey:["a-users"]}); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  return (
    <div className="space-y-2">
      {q.data?.map((u) => (
        <div key={u.id} className="flex justify-between rounded-xl border border-border bg-card p-3">
          <div><div className="text-sm font-semibold">{u.full_name || "(sin nombre)"}</div><div className="text-[11px] text-muted-foreground">{u.phone}</div></div>
          <button onClick={()=>{if(confirm(`¿Eliminar a ${u.full_name || "usuario"}?`)) del.mutate(u.id)}} className="p-2 text-destructive"><Trash2 className="h-4 w-4"/></button>
        </div>
      ))}
    </div>
  );
}
