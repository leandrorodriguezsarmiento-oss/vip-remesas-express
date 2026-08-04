import { createFileRoute, Outlet, Link, redirect, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Send, ClockIcon, LogOut, Smartphone, Shield, Bell, Settings as SettingsIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notify-sound";




export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { next: undefined } });
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

  const [showNotif, setShowNotif] = useState(false);
  const notifs = useQuery({
    queryKey: ["notifications", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Realtime: refetch on any insert/update to my notifications + alerta in-app
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["transactions-all"] });
          queryClient.invalidateQueries({ queryKey: ["recargas-mine"] });
          if (payload.eventType === "INSERT") {
            const n = payload.new as { title?: string; body?: string };
            if (n?.title) {
              playNotificationSound();
              // Aviso tipo WhatsApp: aparece arriba y se cierra solo.
              toast(n.title, { description: n.body ?? undefined, duration: 4000, dismissible: true });
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, queryClient]);




  const unread = notifs.data?.filter((n) => !n.read).length ?? 0;

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { next: undefined }, replace: true });
  }

  const path = location.pathname;
  const admin = isAdmin.data === true;
  // El perfil admin no envía remesas: sólo gestiona.
  const nav = admin
    ? ([
        { to: "/admin", icon: Shield, label: "Panel" },
        { to: "/history", icon: ClockIcon, label: "Historial" },
        { to: "/settings", icon: SettingsIcon, label: "Ajustes" },
      ] as const)
    : ([
        { to: "/dashboard", icon: Home, label: "Inicio" },
        { to: "/recargas", icon: Smartphone, label: "Recargas" },
        { to: "/send", icon: Send, label: "Remesas" },
        { to: "/history", icon: ClockIcon, label: "Historial" },
        { to: "/settings", icon: SettingsIcon, label: "Ajustes" },
      ] as const);


  return (
    <div className="min-h-screen bg-gradient-vip pb-24">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
        <Link to={admin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-base font-bold">VIP Remesas</span>
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowNotif((s) => !s); if (unread > 0) markAllRead(); }}
            className="relative rounded-md p-2 text-muted-foreground hover:text-gold"
            aria-label="Notificaciones">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {unread}
              </span>
            )}
          </button>
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

      {showNotif && (
        <div className="mx-auto mt-2 max-w-md px-5">
          <div className="rounded-xl border border-gold/40 bg-card p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Notificaciones</p>
              <button onClick={() => setShowNotif(false)} className="text-xs text-gold">Cerrar</button>
            </div>
            {notifs.data && notifs.data.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin notificaciones aún.</p>
            )}
            <ul className="space-y-2">
              {notifs.data?.map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-background/60 p-2">
                  <div className="text-sm font-semibold">{n.title}</div>
                  {n.body && <div className="text-[11px] text-muted-foreground">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("es")}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md px-5 pt-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div
          className="mx-auto grid max-w-md"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map(({ to, icon: Icon, label }) => {
            const active = path === to || path.startsWith(`${to}/`);
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
