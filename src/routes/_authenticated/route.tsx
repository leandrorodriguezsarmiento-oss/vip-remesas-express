import { createFileRoute, Outlet, Link, redirect, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Send, LogOut, Smartphone, Shield, Bell, Settings as SettingsIcon, Store } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { SectionMenu } from "@/components/SectionMenu";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notify-sound";
import { preloadAppImages } from "@/lib/preload-images";
import bgFlags from "@/assets/bg-flags.jpg";
import { MfaGate } from "@/components/MfaGate";




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
        .in("role", ["admin", "organizador"]);
      const roles = (data ?? []).map((r) => r.role as string);
      return roles.includes("admin") || roles.includes("organizador");
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
              toast(n.title, {
                description: n.body ?? undefined,
                duration: 4000,
                dismissible: true,
                classNames: {
                  toast: "font-bold",
                  title: "text-sm font-extrabold text-foreground",
                  description: "text-xs font-bold text-foreground/80",
                },
              });

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

  // Las notificaciones no se guardan: al cerrar el panel (ya vistas) se eliminan.
  async function clearNotifications() {
    await supabase.from("notifications").delete().eq("user_id", user.id);
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

  // Descarga anticipada de imágenes para que la app se sienta rápida.
  useEffect(() => { preloadAppImages(); }, []);

  // El perfil admin no envía remesas: sólo gestiona. El historial vive en Ajustes.
  const nav = admin
    ? ([
        { to: "/admin", icon: Shield, label: "Panel", grad: "bg-gradient-sky" },
        { to: "/settings", icon: SettingsIcon, label: "Ajustes", grad: "bg-gradient-emerald" },
      ] as const)
    : ([
        { to: "/dashboard", icon: Home, label: "Inicio", grad: "bg-gradient-sky" },
        { to: "/recargas", icon: Smartphone, label: "Recargas", grad: "bg-gradient-emerald" },
        { to: "/send", icon: Send, label: "Remesas", grad: "bg-gradient-rose" },
        { to: "/tienda", icon: Store, label: "VipShop", grad: "bg-gradient-amber" },
        { to: "/settings", icon: SettingsIcon, label: "Ajustes", grad: "bg-gradient-gold" },
      ] as const);


  return (
    <MfaGate userId={user.id} email={user.email}>
    <div className="relative min-h-screen bg-gradient-vip pb-24">
      {/* Fondo opaco con las banderas de Brasil y Cuba */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center opacity-[0.09]"
        style={{ backgroundImage: `url(${bgFlags})` }}
      />
      <div className="relative z-10">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2">
          <SectionMenu items={nav} />
          <Link to={admin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <BrandMark className="h-8 w-8" />
            <span className="font-display text-base font-extrabold">VIP Remesas</span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => { if (showNotif) void clearNotifications(); setShowNotif((s) => !s); }}
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
              <p className="text-xs font-bold uppercase text-muted-foreground">Notificaciones</p>
              <button onClick={() => { void clearNotifications(); setShowNotif(false); }} className="text-xs font-bold text-gold">
                Cerrar y borrar
              </button>
            </div>
            {notifs.data && notifs.data.length === 0 && (
              <p className="text-xs font-semibold text-muted-foreground">Sin notificaciones.</p>
            )}
            <ul className="space-y-2">
              {notifs.data?.map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-background/60 p-2">
                  <div className="text-sm font-extrabold text-foreground">{n.title}</div>
                  {n.body && <div className="text-xs font-bold text-foreground/80">{n.body}</div>}
                  <div className="text-[10px] font-semibold text-muted-foreground">{new Date(n.created_at).toLocaleString("es")}</div>
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
          {nav.map(({ to, icon: Icon, label, grad }) => {
            const active = path === to || path.startsWith(`${to}/`);
            return (
              <Link key={to} to={to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-extrabold transition-colors ${active ? "text-gold" : "text-muted-foreground"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-xl transition-transform ${active ? `${grad} text-white shadow-glow scale-105` : "bg-secondary"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      </div>
    </div>
    </MfaGate>
  );
}
