import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { sendVerificationCode } from "@/lib/auth-verification.functions";
import { Sparkles, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nombre muy corto").max(80),
  email: z.string().trim().email("Correo inválido").max(255),
  phone: z.string().trim().min(8, "Teléfono inválido").max(20),
});
const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "Requerido"),
});

function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const navigate = useNavigate();

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showOtpOption, setShowOtpOption] = useState(false);

  // signup
  const [sFullName, setSFullName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPhone, setSPhone] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setShowOtpOption(false);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("not confirmed") ||
        msg.includes("confirm") ||
        msg.includes("verified") ||
        msg.includes("verificado") ||
        msg.includes("invalid login credentials")
      ) {
        setShowOtpOption(true);
        return toast.error("No pudimos validar tus datos. Envía un código de acceso a tu correo.");
      }
      return toast.error(error.message);
    }
    if (!remember) sessionStorage.setItem("vip-no-remember", "1");
    toast.success("¡Bienvenido de vuelta!");
    navigate({ to: "/dashboard" });
  }

  async function sendOtp(targetEmail: string, mode: "signup" | "login") {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: mode === "signup",
        data:
          mode === "signup"
            ? { full_name: sFullName, phone: sPhone }
            : undefined,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({
      to: "/auth/verify",
      search: { email: targetEmail, mode },
    });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({
      fullName: sFullName,
      email: sEmail,
      phone: sPhone,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    await sendOtp(sEmail, "signup");
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("No se pudo iniciar sesión con Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

  return (
    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold shadow-gold">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold">VIP Remesas</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-secondary p-1">
            <button
              onClick={() => { setTab("login"); setShowOtpOption(false); }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === "login" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}
            >Entrar</button>
            <button
              onClick={() => { setTab("signup"); setShowOtpOption(false); }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === "signup" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}
            >Crear cuenta</button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {showOtpOption && (
                <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Cuenta sin acceso</p>
                      <p className="mt-1 text-muted-foreground">
                        No pudimos validar tu correo o contraseña. Te enviaremos un código de acceso a <span className="font-medium text-foreground">{email}</span>.
                      </p>
                      <button
                        type="button"
                        onClick={() => sendOtp(email, "login")}
                        disabled={loading}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground shadow-gold disabled:opacity-70"
                      >
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Enviar código de acceso
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
              <Field label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-[color:var(--gold)]" />
                  Recordarme
                </label>
                <button type="button" onClick={() => setShowForgot(true)} className="font-medium text-gold hover:opacity-80">
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <SubmitButton loading={loading}>Entrar</SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Field label="Nombre completo" value={sFullName} onChange={setSFullName} placeholder="João da Silva" />
              <Field label="Correo electrónico" type="email" value={sEmail} onChange={setSEmail} placeholder="tu@correo.com" />
              <Field label="Teléfono" value={sPhone} onChange={setSPhone} placeholder="+55 11 90000-0000" />
              <p className="text-xs text-muted-foreground">
                Te enviaremos un código de verificación a tu correo. Después podrás crear tu contraseña.
              </p>
              <SubmitButton loading={loading}>Crear cuenta VIP</SubmitButton>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o continúa con <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.9 0 3.6.65 4.95 1.93l3.69-3.69C18.32 1.19 15.4 0 12 0 7.31 0 3.26 2.69 1.28 6.61l4.3 3.34C6.6 6.98 9.05 5.04 12 5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.47c-.28 1.4-1.12 2.59-2.38 3.4l3.65 2.84c2.14-1.97 3.75-4.9 3.75-8.48z"/><path fill="#FBBC05" d="M5.58 14.35a7.14 7.14 0 010-4.7L1.28 6.31A11.98 11.98 0 000 12c0 1.94.46 3.77 1.28 5.39l4.3-3.04z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.65-2.84c-1.02.68-2.31 1.08-4.29 1.08-2.95 0-5.4-1.94-6.42-4.61l-4.3 3.04C3.26 21.31 7.31 24 12 24z"/></svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}

function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("Ingresa tu correo");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Revisa tu correo para restablecer la contraseña.");
    onBack();
  }
  return (
    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h1 className="font-display text-2xl font-bold">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un enlace para restablecerla.</p>
          <form onSubmit={send} className="mt-5 space-y-4">
            <Field label="Correo" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
            <SubmitButton loading={loading}>Enviar enlace</SubmitButton>
            <button type="button" onClick={onBack} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
              Volver
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold"
      />
    </label>
  );
}

function SubmitButton({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button type="submit" disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70">
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
