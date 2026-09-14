import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeOAuth() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const next = safeNext(params.get("next"));

      if (!code) {
        if (!cancelled) setError("No recibimos el código de autenticación de Google.");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (exchangeError) {
        console.error("Google OAuth callback error:", exchangeError);
        setError(exchangeError.message || "No se pudo completar el inicio de sesión con Google.");
        return;
      }

      window.location.replace(next);
    }

    void completeOAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-vip px-5">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {error ? (
          <>
            <h1 className="mb-2 text-xl font-bold">No se pudo iniciar sesión</h1>
            <p className="mb-5 max-w-md text-sm text-muted-foreground">{error}</p>
            <a href="/auth/login" className="font-medium underline">
              Volver al inicio de sesión
            </a>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold">Completando inicio de sesión…</h1>
            <p className="text-sm text-muted-foreground">Espera un momento.</p>
          </>
        )}
      </div>
    </main>
  );
}
