// Clave pública VAPID — se puede exponer al cliente sin problema.
// La privada vive en el secreto VAPID_PRIVATE_JWK del backend.
export const VAPID_PUBLIC_KEY =
  "BJooWCAmlacIeIvufZgXOJ9Vn9uNUeGzc0b31GfFDRsa-Rap9BodwCkzru4IcMvbRKJlwIfXy-MF_4frC6_zw3o";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
