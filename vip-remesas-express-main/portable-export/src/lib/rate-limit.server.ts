/**
 * Control de intentos (anti fuerza bruta) para endpoints públicos sensibles.
 *
 * Se apoya en la función `consume_rate_limit` de la base (SECURITY DEFINER,
 * sólo ejecutable por el servidor), así el contador es compartido entre todas
 * las instancias del worker y no se puede saltar reiniciando la conexión.
 */
export async function consumeRateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
  blockSeconds: number;
}): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as never as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }>;
  }).rpc("consume_rate_limit", {
    _key: opts.key,
    _limit: opts.limit,
    _window_seconds: opts.windowSeconds,
    _block_seconds: opts.blockSeconds,
  });
  // Si el control falla, preferimos bloquear el intento antes que abrir la puerta.
  if (error) return false;
  return data === true;
}

export async function resetRateLimit(key: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as never as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  }).rpc("reset_rate_limit", { _key: key });
}

/** IP del solicitante según las cabeceras del proxy (Cloudflare / Nginx). */
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
