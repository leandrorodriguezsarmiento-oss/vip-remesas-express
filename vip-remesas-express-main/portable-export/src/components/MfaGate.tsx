import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Loader2, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Candado de seguridad para cuentas staff (admin y organizador).
 *
 * Se pide en CADA apertura de la app (la llave vive en `sessionStorage`, que
 * muere al cerrar la pestaña/app):
 *  - si hay doble factor TOTP activo → código del autenticador (AAL2 real);
 *  - si no hay TOTP → código de 6 dígitos enviado al correo de la cuenta.
 *
 * Así, aunque alguien clone la contraseña, no puede entrar al panel ni cambiar
 * las cuentas de envío sin el segundo factor.
 */
type Mode = "checking" | "unlocked" | "totp" | "enroll" | "error";

export function MfaGate({
  userId,
  email,
  children,
}: {
  userId: string;
  email: string | null | undefined;
  children: React.ReactNode;
}) {
  const storageKey = `vip_staff_unlock:${userId}`;
  const [mode, setMode] = useState<Mode>("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [errorText, setErrorText] = useState("");

  const unlock = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* modo privado */
    }
    setMode("unlocked");
  }, [storageKey]);

  useEffect(() => {
    let alive = true;
    setMode("checking");
    setErrorText("");
    (async () => {
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .in("role", ["admin", "organizador"]);
        if (!alive) return;
        const list = (roles ?? []).map((r) => r.role as string);
        if (list.length === 0) return setMode("unlocked");

        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
        const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!alive) return;

        if (totp) {
          // Con TOTP activo la sesión debe llegar a AAL2 de verdad.
          if (aal.data?.currentLevel === "aal2") return unlock();
          setFactorId(totp.id);
          return setMode("totp");
        }
        return setMode("enroll");
      } catch (e) {
        console.error("[mfa-gate]", e);
        if (alive) {
          setErrorText("No se pudo comprobar la seguridad. Revisa tu conexión e inténtalo otra vez.");
          setMode("error");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, storageKey, unlock, retryKey]);

  async function submitTotp() {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (error) throw error;
      unlock();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setBusy(false);
      setCode("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (mode === "unlocked") return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-vip px-5">
      <div className="w-full max-w-sm rounded-2xl border border-gold/40 bg-card p-6 shadow-glow">
        <div className="mb-4 flex items-center gap-2">
          <BrandMark className="h-9 w-9" />
          <span className="font-display text-lg font-extrabold">VIP Remesas</span>
        </div>

        {mode === "checking" ? (
          <div className="flex items-center gap-2 py-6 text-sm font-bold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando seguridad…
          </div>
        ) : (
          mode === "enroll" ? (
            <>
              <h1 className="flex items-center gap-2 font-display text-xl font-extrabold"><ShieldCheck className="h-5 w-5 text-gold" />Doble factor obligatorio</h1>
              <p className="mt-2 text-sm font-bold text-muted-foreground">Activa el autenticador TOTP en Ajustes antes de abrir el panel administrativo.</p>
              <a href="/settings" className="mt-4 block w-full rounded-xl bg-gradient-gold px-4 py-3 text-center text-sm font-extrabold text-primary-foreground shadow-gold">Abrir ajustes de seguridad</a>
            </>
          ) : mode === "error" ? (
            <>
              <h1 className="font-display text-xl font-extrabold">Acceso bloqueado</h1>
              <p className="mt-2 text-sm font-bold text-destructive">{errorText}</p>
              <button onClick={() => setRetryKey((n) => n + 1)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-extrabold text-primary-foreground"><RefreshCw className="h-4 w-4" />Reintentar</button>
            </>
          ) : (
          <>
            <h1 className="flex items-center gap-2 font-display text-xl font-extrabold">
               <ShieldCheck className="h-5 w-5 text-gold" />
              Verificación de staff
            </h1>
            <p className="mt-2 text-xs font-bold text-muted-foreground">
              Escribe los 6 dígitos de tu app de autenticación para abrir el panel.
            </p>

            {mode === "totp" && (
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                placeholder="000000"
                className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-3 text-center text-2xl font-extrabold tracking-[0.4em] outline-none focus:border-gold"
              />
            )}

            <button
              onClick={() => {
                void submitTotp();
              }}
              disabled={busy || code.length !== 6}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-extrabold text-primary-foreground shadow-gold disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Desbloquear
            </button>

            <button
              onClick={() => void signOut()}
              className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-bold text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> Salir de la cuenta
            </button>
          </>
          )
        )}
      </div>
    </div>
  );
}
