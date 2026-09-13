import { useEffect, useState } from "react";
import { Bell, X, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";
import { savePushSubscription } from "@/lib/push.functions";

type Mode = "hidden" | "ask" | "ios-install";

/**
 * Aviso visible para activar notificaciones (sonido y vibración).
 * En iPhone las notificaciones sólo existen si la app está agregada a la
 * pantalla de inicio, así que en ese caso explicamos cómo instalarla.
 */
export function PushPermissionPrompt({ userId }: { userId: string }) {
  const [mode, setMode] = useState<Mode>("hidden");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePushSubscription);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(`vip-push-hide:${userId}`) === "1") return;

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (isIos && !isStandalone) {
      setMode("ios-install");
      return;
    }
    if (!supported) return;
    if (Notification.permission === "default") setMode("ask");
  }, [userId]);

  function dismiss() {
    localStorage.setItem(`vip-push-hide:${userId}`, "1");
    setMode("hidden");
  }

  async function activate() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("No se dieron los permisos de notificación");
        setMode("hidden");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw-push.js")) ??
        (await navigator.serviceWorker.register("/sw-push.js"));
      await navigator.serviceWorker.ready;
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer.slice(
            keyBytes.byteOffset,
            keyBytes.byteOffset + keyBytes.byteLength,
          ) as ArrayBuffer,
        }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await save({
        data: {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent.slice(0, 400),
        },
      });
      navigator.vibrate?.([120, 60, 120]);
      toast.success("Notificaciones activadas");
      setMode("hidden");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo activar");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "hidden") return null;

  return (
    <div className="mx-auto mt-3 w-full max-w-md px-5">
      <div className="animate-rise relative rounded-2xl border border-gold/40 bg-card/95 p-3 shadow-glow backdrop-blur">
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-2.5 pr-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
            {mode === "ask" ? <Bell className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            {mode === "ask" ? (
              <>
                <p className="text-sm font-extrabold">Activa los avisos</p>
                <p className="mt-0.5 text-xs font-bold text-foreground/75">
                  Recibe sonido y vibración cuando cambie el estado de tus envíos.
                </p>
                <button
                  onClick={activate}
                  disabled={busy}
                  className="mt-2 rounded-xl bg-gradient-gold px-3 py-1.5 text-xs font-extrabold text-primary-foreground shadow-gold active:scale-95 disabled:opacity-60"
                >
                  {busy ? "Activando…" : "Permitir notificaciones"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-extrabold">Instala la app en tu iPhone</p>
                <p className="mt-0.5 text-xs font-bold text-foreground/75">
                  Toca Compartir en Safari y elige “Agregar a pantalla de inicio”. Al abrirla desde
                  el ícono podrás permitir las notificaciones con sonido y vibración.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
