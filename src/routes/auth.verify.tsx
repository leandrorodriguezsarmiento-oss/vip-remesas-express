import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendVerificationCode, verifyVerificationCode } from "@/lib/auth-verification.functions";
import { toast } from "sonner";
import { Loader2, MailCheck, Sparkles } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  email: z.string().email(),
});

export const Route = createFileRoute("/auth/verify")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: VerifyCodePage,
});

function VerifyCodePage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const verifyCode = useServerFn(verifyVerificationCode);
  const sendCode = useServerFn(sendVerificationCode);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDemoCode(sessionStorage.getItem("vip-demo-code"));
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    const token = code.join("");
    if (token.length !== 6) return toast.error("Ingresa los 6 dígitos");
    setLoading(true);
    try {
      await verifyCode({ data: { email, code: token } });
      toast.success("Código confirmado");
      navigate({ to: "/auth/set-password", search: { email } });
    } catch (err: any) {
      toast.error(err?.message ?? "Código inválido");
      setCode(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await sendCode({ data: { email, type: "email" } });
      toast.success("Código reenviado. Revisa tu correo.");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo reenviar el código");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold shadow-gold">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold">VIP Remesas</span>
        </Link>

        <div className="rounded-2xl border border-gold/40 bg-card p-6 shadow-card text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-gold shadow-gold">
            <MailCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Verifica tu correo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa el código de 6 dígitos que enviamos a <span className="font-semibold text-foreground">{email}</span>.
          </p>

          <form onSubmit={verify} className="mt-6 space-y-5">
            <div className="flex justify-center gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="h-14 w-12 rounded-xl border border-border bg-background text-center text-2xl font-bold outline-none transition focus:border-gold focus:ring-1 focus:ring-gold"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || code.join("").length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar código
            </button>
          </form>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:border-gold disabled:opacity-70"
            >
              {resending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Reenviar código"}
            </button>
            <Link
              to="/auth"
              className="block w-full rounded-lg px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Volver al inicio de sesión
            </Link>
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            ¿No lo ves? Revisa tu carpeta de spam o correo no deseado.
          </p>

          {demoCode && (
            <div className="mt-4 rounded-lg border border-dashed border-gold/50 bg-gold/10 p-3 text-center">
              <p className="text-[11px] uppercase tracking-wide text-gold">Código de prueba (demo)</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-widest text-foreground">{demoCode}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
