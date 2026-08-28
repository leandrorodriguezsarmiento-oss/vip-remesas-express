import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";
import { savePushSubscription } from "@/lib/push.functions";

/**
 * Alta automática de notificaciones push: si el navegador ya dio permiso, se
 * vuelve a suscribir en silencio. Si nunca se preguntó, se pide una sola vez
 * al primer toque del usuario (los móviles exigen un gesto para permitir).
 */
export function usePushAutoEnroll(userId: string) {
  const save = useServerFn(savePushSubscription);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    const askedKey = `vip-push-asked:${userId}`;
    let done = false;

    async function subscribe() {
      if (done) return;
      done = true;
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw-push.js")) ??
          (await navigator.serviceWorker.register("/sw-push.js"));
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const sub =
          existing ??
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
      } catch {
        done = false;
      }
    }

    if (Notification.permission === "granted") {
      void subscribe();
      return;
    }
    if (Notification.permission === "denied" || localStorage.getItem(askedKey)) return;

    const onGesture = async () => {
      window.removeEventListener("pointerdown", onGesture);
      localStorage.setItem(askedKey, "1");
      const perm = await Notification.requestPermission();
      if (perm === "granted") void subscribe();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onGesture);
  }, [userId, save]);
}
