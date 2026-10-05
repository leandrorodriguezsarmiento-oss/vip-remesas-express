import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { sendPasswordRecovery } from "@/lib/password-recovery.functions";

export function PasswordResetFlow({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const sendRecovery = useServerFn(sendPasswordRecovery);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await sendRecovery({ data: { email } });
      setSent(true);
      toast.success("Si ese correo está registrado, recibirás el enlace de recuperación.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el correo.");
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

          {sent ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Si <span className="text-gold">{email}</span> está registrado, te enviamos un enlace personal para crear una contraseña nueva.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="w-full rounded-lg border border-border px-4 py-3 text-sm font-bold"
              >
                Volver a entrar
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Tu correo registrado</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value.trim())}
                  autoComplete="email"
                  required
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar enlace
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full text-center text-sm text-muted-foreground"
              >
                Volver
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
