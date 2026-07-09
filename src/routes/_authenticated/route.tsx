import { createFileRoute, Outlet, Link, redirect, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Send, ClockIcon, LogOut, Sparkles, Smartphone, Shield } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isAdmin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const path = location.pathname;
  const nav = [
    { to: "/dashboard", icon: Home,      label: "Inicio" },
    { to: "/recargas",  icon: Smartphone,label: "Recargas" },
    { to: "/send",      icon: Send,      label: "Remesas" },
    { to: "/history",   icon: ClockIcon, label: "Historial" },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-vip pb-24">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold shadow-gold">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-base font-bold">VIP Remesas</span>
        </Link>
        <div className="flex items-center gap-1">
          {isAdmin.data && (
            <Link to="/admin"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gold hover:bg-accent"
              aria-label="Admin">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
          <button onClick={signOut} className="rounded-md p-2 text-muted-foreground hover:text-gold" aria-label="Salir">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {nav.map(({ to, icon: Icon, label }) => {
            const active =
              path === to ||
              (to === "/send" && path.startsWith("/send")) ||
              (to === "/recargas" && path.startsWith("/recargas"));
            return (
              <Link key={to} to={to}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${active ? "text-gold" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
