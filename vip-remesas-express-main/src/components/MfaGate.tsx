import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Loader2, LogOut, RefreshCw } from "lucide-react";

type Mode = "checking" | "unlocked" | "error";

export function MfaGate({ userId, children }: { userId: string; email?: string | null; children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("checking");
  const [retryKey, setRetryKey] = useState(0);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let alive = true;
    setMode("checking");
    setErrorText("");

    (async () => {
      try {
        const { error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .in("role", ["admin", "organizador"]);

        if (error) throw error;
        if (!alive) return;
        setMode("unlocked");
      } catch (e) {
        console.error("[staff-gate]", e);
        if (alive) {
          setErrorText("No se pudo comprobar tu sesión. Revisa tu conexión e inténtalo otra vez.");
          setMode("error");
        }
      }
    })();

    return () => { alive = false; };
  }, [userId, retryKey]);

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
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando sesión…
          </div>
        ) : (
          <>
            <h1 className="font-display text-xl font-extrabold">Acceso no disponible</h1>
            <p className="mt-2 text-sm font-bold text-destructive">{errorText}</p>
            <button onClick={() => setRetryKey((n) => n + 1)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-extrabold text-primary-foreground">
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
            <button onClick={() => void signOut()} className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-bold text-destructive">
              <LogOut className="h-3.5 w-3.5" /> Salir de la cuenta
            </button>
          </>
        )}
      </div>
    </div>
  );
}
