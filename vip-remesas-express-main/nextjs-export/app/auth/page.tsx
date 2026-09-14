"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(6).max(72),
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const router = useRouter();

  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [sFullName, setSFullName] = useState(""); const [sEmail, setSEmail] = useState("");
  const [sPhone, setSPhone] = useState(""); const [sPassword, setSPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const p = loginSchema.safeParse({ email, password });
    if (!p.success) return toast.error(p.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Bienvenido!");
    router.push("/dashboard"); router.refresh();
  }
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const p = signupSchema.safeParse({ fullName: sFullName, email: sEmail, phone: sPhone, password: sPassword });
    if (!p.success) return toast.error(p.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: sEmail, password: sPassword,
      options: { emailRedirectTo: window.location.origin, data: { full_name: sFullName, phone: sPhone } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Cuenta creada!");
    router.push("/dashboard"); router.refresh();
  }
  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setLoading(false); toast.error("No se pudo iniciar con Google"); }
  }

  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

  return (
    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold shadow-gold">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold">VIP Remesas</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-secondary p-1">
            <button onClick={() => setTab("login")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "login" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>Entrar</button>
            <button onClick={() => setTab("signup")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "signup" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>Crear cuenta</button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
              <Field label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              <button type="button" onClick={() => setShowForgot(true)} className="text-sm font-medium text-gold">¿Olvidaste tu clave?</button>
              <SubmitButton loading={loading}>Entrar</SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Field label="Nombre completo" value={sFullName} onChange={setSFullName} placeholder="João da Silva" />
              <Field label="Correo electrónico" type="email" value={sEmail} onChange={setSEmail} placeholder="tu@correo.com" />
              <Field label="Teléfono" value={sPhone} onChange={setSPhone} placeholder="+55 11 90000-0000" />
              <Field label="Contraseña" type="password" value={sPassword} onChange={setSPassword} placeholder="Mínimo 6 caracteres" />
              <SubmitButton loading={loading}>Crear cuenta VIP</SubmitButton>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o continúa con <div className="h-px flex-1 bg-border" />
          </div>
          <button onClick={handleGoogle} disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.9 0 3.6.65 4.95 1.93l3.69-3.69C18.32 1.19 15.4 0 12 0 7.31 0 3.26 2.69 1.28 6.61l4.3 3.34C6.6 6.98 9.05 5.04 12 5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.47c-.28 1.4-1.12 2.59-2.38 3.4l3.65 2.84c2.14-1.97 3.75-4.9 3.75-8.48z"/><path fill="#FBBC05" d="M5.58 14.35a7.14 7.14 0 010-4.7L1.28 6.31A11.98 11.98 0 000 12c0 1.94.46 3.77 1.28 5.39l4.3-3.04z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.65-2.84c-1.02.68-2.31 1.08-4.29 1.08-2.95 0-5.4-1.94-6.42-4.61l-4.3 3.04C3.26 21.31 7.31 24 12 24z"/></svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}

function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("Ingresa tu correo");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Revisa tu correo."); onBack();
  }
  return (
    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h1 className="font-display text-2xl font-bold">Recuperar contraseña</h1>
          <form onSubmit={send} className="mt-5 space-y-4">
            <Field label="Correo" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
            <SubmitButton loading={loading}>Enviar enlace</SubmitButton>
            <button type="button" onClick={onBack} className="w-full text-center text-sm text-muted-foreground">Volver</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
    </label>
  );
}
function SubmitButton({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button type="submit" disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70">
      {loading && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}
