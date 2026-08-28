import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerAccount, resolveLoginIdentifier } from "@/lib/account.functions";
import { COUNTRIES } from "@/lib/alias";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nombre muy corto")
    .max(80)
    .regex(/^[a-zA-ZÀ-ÿ' ]+$/, "El nombre sólo admite letras"),
  username: z
    .string()
    .trim()
    .min(3, "Usuario: mínimo 3 caracteres")
    .max(24, "Usuario muy largo")
    .regex(/^[a-zA-Z0-9._-]+$/, "Usuario: sólo letras, números, . _ -"),
  phone: z.string().trim().min(8, "Teléfono inválido").max(24),
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(6, "Contraseña: mínimo 6 caracteres").max(72),
});

/** Sólo letras y espacios para nombres. */
function onlyLetters(v: string): string {
  return v.replace(/[^a-zA-ZÀ-ÿ' ]/g, "");
}

/** Sólo dígitos, conservando un + inicial. */
function onlyDigits(v: string, keepPlus = false): string {
  const plus = keepPlus && v.trim().startsWith("+");
  const digits = v.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}

/** CPF con puntos y guion automáticos: 111.222.333-44 */
function formatCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  let out = d.slice(0, 3);
  if (d.length > 3) out += `.${d.slice(3, 6)}`;
  if (d.length > 6) out += `.${d.slice(6, 9)}`;
  if (d.length > 9) out += `-${d.slice(9, 11)}`;
  return out;
}

/** Teléfono: prefijo del país + cantidad exacta de dígitos permitida. */
const PHONE_RULES: Record<string, { prefix: string; max: number }> = {
  BR: { prefix: "+55", max: 12 },
  MX: { prefix: "+52", max: 10 },
  US: { prefix: "+1", max: 10 },
  CU: { prefix: "+53", max: 8 },
};

function formatPhone(v: string, country: string): string {
  const rule = PHONE_RULES[country] ?? { prefix: "+", max: 15 };
  const bare = rule.prefix.slice(1);
  const digits = onlyDigits(v).replace(new RegExp(`^${bare}`), "").slice(0, rule.max);
  return digits ? `${rule.prefix} ${digits}` : `${rule.prefix} `;
}


function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const navigate = useNavigate();


  // login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // signup
  const [sFullName, setSFullName] = useState("");
  const [sUsername, setSUsername] = useState("");
  const [sPhone, setSPhone] = useState("+55 ");
  const [sEmail, setSEmail] = useState("");
  const [sCpf, setSCpf] = useState("");
  const [sCountry, setSCountry] = useState("BR");
  const [sPassword, setSPassword] = useState("");

  function changeCountry(code: string) {
    setSCountry(code);
    setSPhone(formatPhone("", code));
    if (code !== "BR") setSCpf("");
  }


  const resolve = useServerFn(resolveLoginIdentifier);
  const register = useServerFn(registerAccount);

  const { next: nextParam } = Route.useSearch();
  const nextPath = safeNext(nextParam);

  function goNext() {
    if (nextPath) window.location.href = nextPath;
    else navigate({ to: "/dashboard" });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (identifier.trim().length < 3) return toast.error("Ingresa tu usuario, teléfono o CPF");
    if (!password) return toast.error("Ingresa tu contraseña");
    setLoading(true);
    try {
      const { email } = await resolve({ data: { identifier } });
      if (!email) throw new Error("No encontramos esa cuenta");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Usuario o contraseña incorrectos");
      toast.success("¡Bienvenido de vuelta!");
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({
      fullName: sFullName,
      username: sUsername,
      phone: sPhone.replace(/\D/g, ""),
      email: sEmail,
      password: sPassword,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (sCountry === "BR" && sCpf.replace(/\D/g, "").length !== 11) {
      return toast.error("Para Brasil el CPF es obligatorio (11 dígitos)");
    }
    setLoading(true);
    try {
      const { email } = await register({
        data: {
          fullName: sFullName,
          username: sUsername,
          phone: sPhone,
          email: sEmail,
          cpf: sCpf,
          country: sCountry,
          password: sPassword,
        },
      });

      const { error } = await supabase.auth.signInWithPassword({ email, password: sPassword });
      if (error) throw new Error(error.message);
      toast.success("¡Cuenta creada! Ya puedes enviar remesas.");
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (result.error) {
        toast.error("No se pudo iniciar con Google");
        setLoading(false);
        return;
      }
      return;
    } catch {
      toast.error("No se pudo iniciar con Google");
      setLoading(false);
    }
  }
  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

  return (

    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <BrandMark />
          <span className="font-display text-lg font-bold">VIP Remesas</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-secondary p-1">
            <button
              onClick={() => setTab("login")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === "login" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}
            >Entrar</button>
            <button
              onClick={() => setTab("signup")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === "signup" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground"}`}
            >Crear cuenta</button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field
                label="Usuario, teléfono o CPF"
                value={identifier}
                onChange={setIdentifier}
                placeholder="joaosilva / 55119... / 000.000.000-00"
                autoComplete="username"
              />
              <Field
                label="Contraseña"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm font-semibold text-gold underline-offset-2 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
              <p className="text-xs text-muted-foreground">
                Tu sesión queda guardada en este dispositivo: la próxima vez entras directo.
              </p>
              <SubmitButton loading={loading}>Entrar</SubmitButton>
            </form>

          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Field label="Nombre completo" value={sFullName} onChange={(v) => setSFullName(onlyLetters(v))} placeholder="João da Silva" />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">País</span>
                <select
                  value={sCountry}
                  onChange={(e) => changeCountry(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </label>
              <Field label="Nombre de usuario" value={sUsername} onChange={setSUsername} placeholder="joaosilva" autoComplete="username" />
              <Field
                label="Teléfono"
                value={sPhone}
                onChange={(v) => setSPhone(formatPhone(v, sCountry))}
                placeholder="+55 11900000000"
                inputMode="tel"
              />
              <Field label="Correo electrónico" type="email" value={sEmail} onChange={(v) => setSEmail(v.trim())} placeholder="tu@correo.com" autoComplete="email" />
              {sCountry === "BR" && (
                <Field
                  label="CPF"
                  value={sCpf}
                  onChange={(v) => setSCpf(formatCpf(v))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              )}
              <Field label="Contraseña" type="password" value={sPassword} onChange={setSPassword} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">
                Entras con tu usuario, teléfono, correo {sCountry === "BR" ? "o CPF " : ""}y contraseña.
              </p>

              <SubmitButton loading={loading}>Crear cuenta VIP</SubmitButton>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o continúa con <div className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-gold disabled:opacity-70"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 5.04c1.9 0 3.6.65 4.95 1.93l3.69-3.69C18.32 1.19 15.4 0 12 0 7.31 0 3.26 2.69 1.28 6.61l4.3 3.34C6.6 6.98 9.05 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.47c-.28 1.4-1.12 2.59-2.38 3.4l3.65 2.84c2.14-1.97 3.75-4.9 3.75-8.48z" />
              <path fill="#FBBC05" d="M5.58 14.35a7.14 7.14 0 010-4.7L1.28 6.31A11.98 11.98 0 000 12c0 1.94.46 3.77 1.28 5.39l4.3-3.04z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.65-2.84c-1.02.68-2.31 1.08-4.29 1.08-2.95 0-5.4-1.94-6.42-4.61l-4.3 3.04C3.26 21.31 7.31 24 12 24z" />
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, autoComplete, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  autoComplete?: string; inputMode?: "text" | "tel" | "numeric" | "email";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
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

/** Recuperación de contraseña por correo (enlace seguro de Lovable Cloud). */
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return toast.error("Escribe un correo válido");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error("No se pudo enviar el correo. Intenta de nuevo.");
    setSent(true);
    toast.success("Te enviamos un enlace para crear una contraseña nueva.");
  }

  return (
    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <BrandMark />
          <span className="font-display text-lg font-bold">VIP Remesas</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h1 className="font-display text-2xl font-extrabold">Recuperar contraseña</h1>
          {sent ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Revisa tu correo <span className="text-gold">{email}</span> y abre el enlace para crear tu
                contraseña nueva.
              </p>
              <button type="button" onClick={onBack} className="w-full rounded-lg border border-border px-4 py-3 text-sm font-bold">
                Volver a entrar
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="mt-5 space-y-4">
              <Field label="Tu correo registrado" type="email" value={email} onChange={(v) => setEmail(v.trim())} placeholder="tu@correo.com" autoComplete="email" />
              <SubmitButton loading={loading}>Enviar enlace</SubmitButton>
              <button type="button" onClick={onBack} className="w-full text-center text-sm text-muted-foreground">
                Volver
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
