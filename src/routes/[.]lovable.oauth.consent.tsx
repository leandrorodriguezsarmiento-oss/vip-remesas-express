import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";

// Typed shim for the beta supabase.auth.oauth namespace.
type OAuthDetails = {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] };
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  scopes?: string[];
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult<OAuthDetails>>;
  approveAuthorization: (
    id: string,
  ) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
  denyAuthorization: (
    id: string,
  ) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
};
const authOauth = () =>
  (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id:
      typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/auth", search: { next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get(
      "authorization_id",
    )!;
    const { data, error } = await authOauth().getAuthorizationDetails(
      authorizationId,
    );
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen bg-gradient-vip p-6">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-xl font-bold">No se pudo cargar la autorización</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName =
    details?.client?.name ?? details?.client?.client_name ?? "una aplicación";
  const scopeList =
    details?.scopes ??
    (typeof details?.scope === "string" ? details.scope.split(" ") : []);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const oauth = authOauth();
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor no devolvió URL de redirección.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen bg-gradient-vip px-5 py-8">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-5 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold shadow-gold">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold">VIP Remesas</span>
        </div>

        <h1 className="font-display text-2xl font-bold">
          Conectar {clientName} a tu cuenta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esto permite que <strong>{clientName}</strong> use VIP Remesas como tú.
        </p>

        <div className="mt-5 rounded-xl border border-border bg-background/50 p-4 text-sm">
          <p className="font-semibold">Se compartirá:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Tu identidad básica (correo).</li>
            <li>Acceso de solo lectura a tus remesas y notificaciones.</li>
            <li>Consulta pública de tasas de cambio.</li>
          </ul>
          {scopeList.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Permisos solicitados: {scopeList.join(", ")}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Aprobar y conectar
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent disabled:opacity-60"
          >
            Denegar
          </button>
        </div>
      </div>
    </main>
  );
}
