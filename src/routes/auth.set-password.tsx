import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setInitialPassword } from "@/lib/auth-verification.functions";
import { toast } from "sonner";
import { Loader2, Sparkles, LockKeyhole } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  email: z.string().email(),
});

export const Route = createFileRoute("/auth/set-password")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { email } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setPasswordFn = useServerFn(setInitialPassword);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Mínimo 6 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setLoading(true);
    try {
      await setPasswordFn({ data: { email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("¡Bienvenido a VIP Remesas!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("weak") || msg.toLowerCase().includes("guess") || msg.toLowerCase().includes("pwned")) {
        toast.error("Contraseña muy débil. Usa una combinación de letras, números y símbolos.");
      } else {
        toast.error(msg || "No se pudo guardar la contraseña");
      }
    } finally {
      setLoading(false);
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

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gradient-gold shadow-gold">
            <LockKeyhole className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Crea tu contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu correo ya está verificado. Define una contraseña segura para proteger tu cuenta.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirmar contraseña</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar contraseña
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
