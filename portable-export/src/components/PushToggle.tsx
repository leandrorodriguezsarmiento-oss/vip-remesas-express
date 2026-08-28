import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";
import { savePushSubscription, deletePushSubscription } from "@/lib/push.functions";

type State = "unsupported" | "denied" | "off" | "on" | "loading";

export function PushToggle({ hideWhenBlocked = false }: { hideWhenBlocked?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(deletePushSubscription);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw-push.js")) ??
          (await navigator.serviceWorker.register("/sw-push.js"));
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
        // Si el usuario ya dio permiso, re-activamos la suscripción automáticamente
        if (!sub && Notification.permission === "granted" && !cancelled) {
          void enable();
        }
      } catch {
        if (!cancelled) setState("off");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permiso de notificaciones denegado");
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await save({
        data: {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent.slice(0, 400),
        },
      });
      setState("on");
      toast.success("Notificaciones activadas");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo activar");
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remove({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notificaciones desactivadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      setState("on");
    }
  }

  if (state === "unsupported") return null;

  if (state === "denied") {
    if (hideWhenBlocked) return null;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <BellOff className="h-4 w-4" />
        Notificaciones bloqueadas en el navegador. Habilítalas desde la configuración del sitio.
      </div>
    );
  }

  const isOn = state === "on";
  return (
    <button
      onClick={isOn ? disable : enable}
      disabled={state === "loading"}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
        isOn
          ? "border-gold/50 bg-card text-foreground"
          : "border-border bg-card hover:border-gold/50"
      }`}
    >
      <span className="flex items-center gap-2">
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isOn ? (
          <Bell className="h-4 w-4 text-gold" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        Notificaciones push
      </span>
      <span className="text-xs text-muted-foreground">
        {isOn ? "Activadas" : "Activar"}
      </span>
    </button>
  );
}
