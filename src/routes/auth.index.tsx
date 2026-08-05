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
  fullName: z.string().trim().min(2, "Nombre muy corto").max(80),
  username: z
    .string()
    .trim()
    .min(3, "Usuario: mínimo 3 caracteres")
    .max(24, "Usuario muy largo")
    .regex(/^[a-zA-Z0-9._-]+$/, "Usuario: sólo letras, números, . _ -"),
  phone: z.string().trim().min(8, "Teléfono inválido").max(24),
  password: z.string().min(6, "Contraseña: mínimo 6 caracteres").max(72),
});

function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // signup
  const [sFullName, setSFullName] = useState("");
  const [sUsername, setSUsername] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sCpf, setSCpf] = useState("");
  const [sCountry, setSCountry] = useState("BR");
  const [sPassword, setSPassword] = useState("");

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
      phone: sPhone,
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

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("No se pudo iniciar con Google");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      goNext();
    } catch {
      toast.error("No se pudo iniciar con Google");
      setLoading(false);
    }
  }


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
              <p className="text-xs text-muted-foreground">
                Tu sesión queda guardada en este dispositivo: la próxima vez entras directo.
              </p>
              <SubmitButton loading={loading}>Entrar</SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Field label="Nombre completo" value={sFullName} onChange={setSFullName} placeholder="João da Silva" />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">País</span>
                <select
                  value={sCountry}
                  onChange={(e) => setSCountry(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </label>
              <Field label="Nombre de usuario" value={sUsername} onChange={setSUsername} placeholder="joaosilva" autoComplete="username" />
              <Field label="Teléfono" value={sPhone} onChange={setSPhone} placeholder="+55 11 90000-0000" />
              {sCountry === "BR" && (
                <Field label="CPF" value={sCpf} onChange={setSCpf} placeholder="000.000.000-00" />
              )}
              <Field label="Contraseña" type="password" value={sPassword} onChange={setSPassword} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">
                Sin correo: entras con tu usuario, teléfono {sCountry === "BR" ? "o CPF " : ""}y contraseña.
              </p>
              <SubmitButton loading={loading}>Crear cuenta VIP</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete}
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
