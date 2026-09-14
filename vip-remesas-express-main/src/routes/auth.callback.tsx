import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [message, setMessage] = useState("Completando inicio de sesión...");

  useEffect(() => {
    let cancelled = false;

    const finishOAuth = async () => {
      const url = new URL(window.location.href);
      const next = safeNext(url.searchParams.get("next"));
      const errorCode = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      if (errorCode || errorDescription) {
        throw new Error(errorDescription || errorCode || "Google rechazó la autenticación.");
      }

      const code = url.searchParams.get("code");
      if (!code) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          window.location.replace(next);
          return;
        }
        throw new Error("Google no devolvió el código de autenticación.");
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error("No se pudo establecer la sesión.");
      }

      if (!cancelled) {
        setMessage("¡Sesión iniciada! Redirigiendo...");
        window.history.replaceState({}, document.title, "/auth/callback");
        window.location.replace(next);
      }
    };

    finishOAuth().catch((error: unknown) => {
      if (cancelled) return;
      console.error("[OAuth callback]", error);
      const text = error instanceof Error ? error.message : "No se pudo iniciar sesión con Google";
      toast.error(text);
      setMessage("No se pudo completar el inicio de sesión.");
      window.setTimeout(() => {
        window.location.replace("/auth/");
      }, 1800);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <BrandMark />
        <Loader2 className="mt-6 h-8 w-8 animate-spin text-gold" />
        <p className="mt-4 text-sm font-semibold">{message}</p>
      </div>
    </div>
  );
}
