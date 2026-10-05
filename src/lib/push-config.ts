let cachedPublicKey: string | null = null;

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getVapidPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;

  const response = await fetch("/api/public/push/dispatch", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Las notificaciones push no están configuradas.");

  const body = (await response.json()) as { publicKey?: string };
  const key = body.publicKey?.trim();
  if (!key) throw new Error("Falta la clave pública de notificaciones.");

  cachedPublicKey = key;
  return key;
}

export function subscriptionUsesVapidKey(
  subscription: PushSubscription,
  publicKey: string,
): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;

  const expected = urlBase64ToUint8Array(publicKey);
  const actual = new Uint8Array(current);
  if (actual.length !== expected.length) return false;

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

export async function ensurePushSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const publicKey = await getVapidPublicKey();
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !subscriptionUsesVapidKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (subscription) return subscription;

  const keyBytes = urlBase64ToUint8Array(publicKey);
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes.buffer.slice(
      keyBytes.byteOffset,
      keyBytes.byteOffset + keyBytes.byteLength,
    ) as ArrayBuffer,
  });
}
