import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import {
  completePasswordReset,
  requestPasswordResetCode,
  verifyPasswordResetCode,
} from "@/lib/auth-verification.functions";

type Step = "email" | "code" | "password" | "done";

export function PasswordResetFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = useServerFn(requestPasswordResetCode);
  const verifyCode = useServerFn(verifyPasswordResetCode);
  const completeReset = useServerFn(completePasswordReset);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestCode({ data: { email } });
      setStep("code");
      toast.success("Si ese correo está registrado, recibirás un código de 6 dígitos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar la recuperación.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast.error("Escribe el código de 6 dígitos.");
    setLoading(true);
    try {
      await verifyCode({ data: { email, code } });
      setStep("password");
      toast.success("Código correcto.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código inválido o expirado.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden.");
    setLoading(true);
    try {
      await completeReset({ data: { email, password } });
      setStep("done");
      toast.success("Contraseña actualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
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

          {step === "email" && (
            <form onSubmit={submitEmail} className="mt-5 space-y-4">
              <ResetField
                label="Tu correo registrado"
                type="email"
                value={email}
                onChange={(value) => setEmail(value.trim())}
                autoComplete="email"
              />
              <Submit loading={loading}>Enviar código</Submit>
              <BackButton onClick={onBack} />
            </form>
          )}

          {step === "code" && (
            <form onSubmit={submitCode} className="mt-5 space-y-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Revisa <span className="text-gold">{email}</span>. El código vence en 10 minutos.
              </p>
              <ResetField
                label="Código de 6 dígitos"
                value={code}
                onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <Submit loading={loading}>Verificar código</Submit>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full text-center text-sm text-muted-foreground"
              >
                Cambiar correo
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={submitPassword} className="mt-5 space-y-4">
              <ResetField
                label="Nueva contraseña"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <ResetField
                label="Confirmar contraseña"
                type="password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
              <Submit loading={loading}>Guardar contraseña</Submit>
            </form>
          )}

          {step === "done" && (
            <div className="mt-5 space-y-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Tu contraseña fue actualizada. Ya puedes entrar con tu usuario, correo o teléfono.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="w-full rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold"
              >
                Volver a entrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResetField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "numeric" | "email";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold"
      />
    </label>
  );
}

function Submit({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-center text-sm text-muted-foreground"
    >
      Volver
    </button>
  );
}
