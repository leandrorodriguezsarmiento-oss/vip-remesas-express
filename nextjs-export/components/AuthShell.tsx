"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Home, Send, ClockIcon, LogOut, Sparkles, Smartphone, Shield, Bell } from "lucide-react";

const nav = [
  { to: "/dashboard", icon: Home, label: "Inicio" },
  { to: "/recargas", icon: Smartphone, label: "Recargas" },
  { to: "/send", icon: Send, label: "Remesas" },
  { to: "/history", icon: ClockIcon, label: "Historial" },
] as const;

export function AuthShell({ userId, isAdmin, children }: { userId: string; isAdmin: boolean; children: React.ReactNode }) {
  const router = useRouter(); const path = usePathname(); const qc = useQueryClient();
  const [showNotif, setShowNotif] = useState(false);

  const notifs = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error; return data;
    },
    refetchInterval: 30000,
  });
  const unread = notifs.data?.filter((n) => !n.read).length ?? 0;

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }
  async function signOut() {
    await supabase.auth.signOut(); qc.clear(); router.push("/auth"); router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-vip pb-24">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold shadow-gold">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-base font-bold">VIP Remesas</span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={() => { setShowNotif((s) => !s); if (unread > 0) markAllRead(); }}
            className="relative rounded-md p-2 text-muted-foreground hover:text-gold" aria-label="Notificaciones">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unread}</span>}
          </button>
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gold hover:bg-accent">
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
            {notifs.data && notifs.data.length === 0 && <p className="text-xs text-muted-foreground">Sin notificaciones aún.</p>}
            <ul className="space-y-2">
              {notifs.data?.map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-background/60 p-2">
                  <div className="text-sm font-semibold">{n.title}</div>
                  {n.body && <div className="text-[11px] text-muted-foreground">{n.body}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md px-5 pt-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {nav.map(({ to, icon: Icon, label }) => {
            const active = path === to || (to !== "/dashboard" && path.startsWith(to));
            return (
              <Link key={to} href={to} className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${active ? "text-gold" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
