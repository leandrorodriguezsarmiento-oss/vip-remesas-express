import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requestAccountVerification, updateMyAliases } from "@/lib/account.functions";
import { COUNTRIES, SUPPORT_WHATSAPP_URL } from "@/lib/alias";
import { isSoundEnabled, setSoundEnabled, playNotificationSound } from "@/lib/notify-sound";
import { PushToggle } from "@/components/PushToggle";
import {
  Loader2, User, Camera, Globe, Users, ShieldCheck, MessageCircle, Bell, Trash2, Save, Plus, KeyRound, Eye, EyeOff,
  Clock as ClockIcon,
} from "lucide-react";
import { toast } from "sonner";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/IJPFYGrhrc4JAddkp1ohnI?s=cl&p=a&ilr=0&amv=3";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
  head: () => ({
    meta: [
      { title: "Configuración de tu cuenta | VIP Remesas" },
      { name: "description", content: "Edita tu perfil, foto, idioma, contactos guardados y verifica tu cuenta VIP Remesas." },
      { property: "og:title", content: "Configuración de tu cuenta | VIP Remesas" },
      { property: "og:description", content: "Perfil, foto, idioma, contactos y verificación de tu cuenta VIP Remesas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  username: string | null;
  cpf: string | null;
  country: string;
  avatar_url: string | null;
  verified: boolean;
  preferred_language: string;
  province: string | null;
};

function Settings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, username, cpf, country, avatar_url, verified, preferred_language, province")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Profile | null;
    },
  });


  const staff = useQuery({
    queryKey: ["is-staff", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).in("role", ["admin", "organizador"]);
      return (data ?? []).length > 0;
    },
  });

  return (
    <div className="space-y-5">
      <div className="animate-rise">
        <h1 className="font-display text-2xl font-extrabold">Configuración</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">Tu perfil, contactos, historial e idioma.</p>
      </div>

      {profile.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {profile.data && <ProfileCard profile={profile.data} onSaved={() => qc.invalidateQueries({ queryKey: ["profile", user.id] })} />}
      <HistoryCard />
      <PasswordCard />
      {staff.data && <TwoFactorCard />}
      {profile.data && <LanguageCard profile={profile.data} />}
      <NotificationsCard />
      {profile.data && <VerificationCard verified={profile.data.verified} />}
      <ContactsCard userId={user.id} />
      <SupportCard />



    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-gold">{icon}</span>
        <h2 className="font-display text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ProfileCard({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [cpf, setCpf] = useState(profile.cpf ?? "");
  const [country, setCountry] = useState(profile.country ?? "BR");
  const [province, setProvince] = useState(profile.province ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const syncAliases = useServerFn(updateMyAliases);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!profile.avatar_url) return setAvatarPreview(null);
      const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 3600);
      if (alive) setAvatarPreview(data?.signedUrl ?? null);
    })();
    return () => { alive = false; };
  }, [profile.avatar_url]);

  const save = useMutation({
    mutationFn: async () => {
      if (fullName.trim().length < 2) throw new Error("Nombre muy corto");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          username: username.trim() || null,
          cpf: cpf.replace(/\D/g, "") || null,
          country,
        })
        .eq("id", profile.id);
      if (error) throw error;
      await syncAliases({ data: { username: username.trim(), phone: phone.trim(), cpf } });
    },
    onSuccess: () => { toast.success("Perfil actualizado"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  async function uploadAvatar(file: File) {
    if (file.size > 4 * 1024 * 1024) return toast.error("La imagen no puede pasar de 4 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", profile.id);
      if (error) throw error;
      toast.success("Foto actualizada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card icon={<User className="h-5 w-5" />} title="Mi cuenta">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-gold/50 bg-secondary">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <User className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-gradient-gold shadow-gold">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-foreground" /> : <Camera className="h-3.5 w-3.5 text-primary-foreground" />}
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }} />
          </label>
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.full_name || "Sin nombre"}</p>
          <p className="text-xs text-muted-foreground">
            {profile.username ? `@${profile.username}` : "Sin usuario"} · {profile.verified ? "Verificado" : "Sin verificar"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Input label="Nombre completo" value={fullName} onChange={setFullName} />
        <Input label="Teléfono" value={phone} onChange={setPhone} />
        <Input label="Nombre de usuario" value={username} onChange={setUsername} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">País</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold">
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        {country === "BR" && <Input label="CPF" value={cpf} onChange={setCpf} />}
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-60">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios
        </button>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (pwd.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
      if (pwd !== confirm) throw new Error("Las contraseñas no coinciden");
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contraseña actualizada"); setPwd(""); setConfirm(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Card icon={<KeyRound className="h-5 w-5" />} title="Mi contraseña">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        Por seguridad, la contraseña actual no se puede mostrar. Escribe una nueva y usa el ojo para verla.
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nueva contraseña</span>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <input type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-transparent py-2.5 text-sm outline-none" />
            <button type="button" onClick={() => setShow((s) => !s)} className="text-muted-foreground hover:text-gold"
              aria-label={show ? "Ocultar contraseña" : "Ver contraseña"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Repetir contraseña</span>
          <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold" />
        </label>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-60">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Cambiar contraseña
        </button>
      </div>
    </Card>
  );
}

function LanguageCard({ profile }: { profile: Profile }) {

  const [lang, setLang] = useState(profile.preferred_language || "es");
  const save = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from("profiles").update({ preferred_language: value }).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Idioma guardado"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Card icon={<Globe className="h-5 w-5" />} title="Idioma de la app">
      <div className="grid grid-cols-3 gap-2">
        {[["es", "Español"], ["pt", "Português"], ["en", "English"]].map(([code, label]) => (
          <button key={code}
            onClick={() => { setLang(code); save.mutate(code); }}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${lang === code ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border bg-background text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function NotificationsCard() {
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(isSoundEnabled()), []);
  return (
    <Card icon={<Bell className="h-5 w-5" />} title="Notificaciones">
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Sonido de aviso</span>
          <input type="checkbox" checked={sound}
            onChange={(e) => {
              setSound(e.target.checked);
              setSoundEnabled(e.target.checked);
              if (e.target.checked) playNotificationSound();
            }}
            className="h-5 w-9 accent-[color:var(--gold)]" />
        </label>
        <PushToggle />
      </div>
    </Card>
  );
}

function VerificationCard({ verified }: { verified: boolean }) {
  const ask = useServerFn(requestAccountVerification);
  const m = useMutation({
    mutationFn: () => ask({ data: undefined as never }),
    onSuccess: () => toast.success("Solicitud enviada. Te avisaremos al verificar."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  return (
    <Card icon={<ShieldCheck className="h-5 w-5" />} title="Verificar mi cuenta">
      {verified ? (
        <p className="text-sm text-muted-foreground">Tu cuenta ya está verificada ✅</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Verifica tu cuenta para subir tus límites de envío. Nuestro equipo revisa tus datos.
          </p>
          <button onClick={() => m.mutate()} disabled={m.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold/50 px-4 py-2.5 text-sm font-semibold text-gold disabled:opacity-60">
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Solicitar verificación
          </button>
        </>
      )}
    </Card>
  );
}

function ContactsCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", country: "CU", delivery_method: "transferencia", address: "" });

  const list = useQuery({
    queryKey: ["recipients", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Un mismo contacto (nombre + teléfono) se muestra una sola vez.
      const seen = new Set<string>();
      return (data ?? []).filter((r) => {
        const key = `${(r.full_name ?? "").trim().toLowerCase()}|${(r.phone ?? "").replace(/\D/g, "")}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });


  const add = useMutation({
    mutationFn: async () => {
      if (form.full_name.trim().length < 2) throw new Error("Nombre del contacto muy corto");
      if (form.phone.trim().length < 6) throw new Error("Teléfono inválido");
      const { error } = await supabase.from("recipients").insert({
        user_id: userId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        country: form.country,
        delivery_method: form.delivery_method,
        address: form.address.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contacto guardado");
      setForm({ full_name: "", phone: "", country: "CU", delivery_method: "transferencia", address: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["recipients", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipients", userId] }),
  });

  return (
    <Card icon={<Users className="h-5 w-5" />} title="Contactos guardados">
      <ul className="space-y-2">
        {list.data?.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.full_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {r.phone} · {r.delivery_method}
                {(r as { address?: string | null }).address ? ` · ${(r as { address?: string | null }).address}` : ""}
              </p>
            </div>
            <button onClick={() => del.mutate(r.id)} className="rounded-md p-2 text-muted-foreground hover:text-destructive" aria-label="Eliminar contacto">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {list.data && list.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no guardaste contactos.</p>
      )}

      {open ? (
        <div className="mt-3 space-y-3 rounded-lg border border-gold/40 p-3">
          <Input label="Nombre del contacto" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Input label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Entrega</span>
            <select value={form.delivery_method} onChange={(e) => setForm({ ...form, delivery_method: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </label>
          {form.delivery_method === "efectivo" && (
            <Input label="Dirección de entrega" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          )}
          <div className="flex gap-2">
            <button onClick={() => add.mutate()} disabled={add.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-gold px-3 py-2 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-60">
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground hover:border-gold/60 hover:text-gold">
          <Plus className="h-4 w-4" /> Agregar contacto
        </button>
      )}
    </Card>
  );
}

function SupportCard() {
  return (
    <Card icon={<MessageCircle className="h-5 w-5" />} title="Atención al cliente">
      <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold">
        <MessageCircle className="h-4 w-4" /> Escribir por WhatsApp
      </a>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">+55 95 98100-6775</p>
      <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-emerald px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-95">
        <Users className="h-4 w-4" /> Grupos de WhatsApp
      </a>
    </Card>
  );
}

function HistoryCard() {
  return (
    <Card icon={<ClockIcon className="h-5 w-5" />} title="Mi historial">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        Revisa tus remesas y recargas agrupadas por día.
      </p>
      <Link to="/history"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-violet px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-95">
        <ClockIcon className="h-4 w-4" /> Ver historial
      </Link>
    </Card>
  );
}

/** Doble factor (TOTP) para admin y organizadores. */
function TwoFactorCard() {
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const factors = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp ?? [];
    },
  });

  const verified = (factors.data ?? []).some((f) => f.status === "verified");

  async function start() {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setQr(data.totp.qr_code);
      setFactorId(data.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      setEnrolling(false);
    }
  }

  async function confirm() {
    if (!factorId) return;
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (error) throw error;
      toast.success("Doble factor activado");
      setQr(null); setFactorId(null); setCode(""); setEnrolling(false);
      void factors.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    }
  }

  async function disable(id: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error(error.message);
    toast.success("Doble factor desactivado");
    void factors.refetch();
  }

  return (
    <Card icon={<ShieldCheck className="h-5 w-5" />} title="Autenticación de doble factor">
      {verified ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-success">Activado ✅</p>
          {(factors.data ?? []).filter((f) => f.status === "verified").map((f) => (
            <button key={f.id} onClick={() => void disable(f.id)}
              className="w-full rounded-lg border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive">
              Desactivar doble factor
            </button>
          ))}
        </div>
      ) : qr ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Escanea el código con Google Authenticator y escribe los 6 dígitos.
          </p>
          <img src={qr} alt="Código QR de doble factor" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" placeholder="000000"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-center text-lg font-extrabold tracking-widest outline-none focus:border-gold" />
          <button onClick={() => void confirm()} disabled={code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60">
            Activar
          </button>
        </div>
      ) : (
        <button onClick={() => void start()} disabled={enrolling}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold/50 px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-60">
          {enrolling && <Loader2 className="h-4 w-4 animate-spin" />} Activar doble factor
        </button>
      )}
    </Card>
  );
}


function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold" />
    </label>
  );
}
