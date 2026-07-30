// Server-only helpers para despachar recargas al proveedor real y
// sincronizar su estado hasta "completed".

type RechargeStatus = "pending" | "processing" | "completed" | "rejected";

type ProviderConfig = {
  provider: string;
  api_base_url: string | null;
  api_key_name: string | null;
};

type SyncResult = {
  dispatched: number;
  completed: number;
  rejected: number;
  stillProcessing: number;
  errors: string[];
  provider: string;
};

function normalizeStatus(raw: unknown): RechargeStatus | null {
  const s = String(raw ?? "").toLowerCase();
  if (["completed", "success", "successful", "delivered", "approved", "done"].includes(s)) return "completed";
  if (["processing", "pending", "in_progress", "submitted", "accepted"].includes(s)) return "processing";
  if (["rejected", "failed", "error", "cancelled", "canceled", "declined"].includes(s)) return "rejected";
  return null;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadActiveConfig(): Promise<ProviderConfig> {
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin
    .from("recargas_config")
    .select("provider,api_base_url,api_key_name,active")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No hay proveedor de recargas activo");
  return {
    provider: data.provider,
    api_base_url: data.api_base_url,
    api_key_name: data.api_key_name,
  };
}

function isMock(cfg: ProviderConfig) {
  return cfg.provider === "mock" || !cfg.api_base_url || !cfg.api_key_name;
}

function requireApiKey(cfg: ProviderConfig): string {
  const key = cfg.api_key_name ? process.env[cfg.api_key_name] : undefined;
  if (!key) {
    throw new Error(
      `Falta el secreto ${cfg.api_key_name} para el proveedor ${cfg.provider}`,
    );
  }
  return key;
}

/** Envía una recarga pendiente al proveedor. Devuelve el nuevo estado. */
export async function dispatchRecharge(
  requestId: string,
  cfg?: ProviderConfig,
): Promise<{ status: RechargeStatus; providerRef: string | null }> {
  const supabaseAdmin = await getAdmin();
  const config = cfg ?? (await loadActiveConfig());

  const { data: req, error } = await supabaseAdmin
    .from("recargas_requests")
    .select("id,phone,promo_title,price_brl,status,provider_ref")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!req) throw new Error("Recarga no encontrada");
  if (req.status !== "pending") throw new Error("La recarga ya fue procesada");

  if (isMock(config)) {
    const ref = `mock-${Date.now()}`;
    await supabaseAdmin
      .from("recargas_requests")
      .update({ status: "completed", provider_ref: ref, notes: "Completada en modo mock" })
      .eq("id", req.id);
    return { status: "completed", providerRef: ref };
  }

  const apiKey = requireApiKey(config);
  const res = await fetch(`${config.api_base_url!.replace(/\/$/, "")}/recharge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      phone: req.phone,
      amount_brl: Number(req.price_brl),
      product: req.promo_title,
      external_ref: req.id,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    message?: string;
  };

  if (!res.ok) {
    await supabaseAdmin
      .from("recargas_requests")
      .update({ status: "rejected", notes: json.message || `HTTP ${res.status}` })
      .eq("id", req.id);
    throw new Error(json.message || `Proveedor respondió ${res.status}`);
  }

  const status = normalizeStatus(json.status) ?? "processing";
  await supabaseAdmin
    .from("recargas_requests")
    .update({
      status,
      provider_ref: json.id ?? null,
      notes: json.message ?? null,
    })
    .eq("id", req.id);

  return { status, providerRef: json.id ?? null };
}

/** Consulta el estado en el proveedor de una recarga ya despachada. */
async function pollRecharge(
  req: { id: string; provider_ref: string | null },
  cfg: ProviderConfig,
): Promise<RechargeStatus> {
  const supabaseAdmin = await getAdmin();

  if (isMock(cfg)) {
    await supabaseAdmin
      .from("recargas_requests")
      .update({ status: "completed", notes: "Completada en modo mock" })
      .eq("id", req.id);
    return "completed";
  }

  const apiKey = requireApiKey(cfg);
  const ref = encodeURIComponent(req.provider_ref ?? req.id);
  const res = await fetch(`${cfg.api_base_url!.replace(/\/$/, "")}/recharge/${ref}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Proveedor respondió ${res.status}`);

  const status = normalizeStatus(json.status);
  if (!status || status === "processing") return "processing";

  await supabaseAdmin
    .from("recargas_requests")
    .update({ status, notes: json.message ?? null })
    .eq("id", req.id);
  return status;
}

/**
 * Sincroniza todas las recargas abiertas: despacha las pendientes y consulta
 * el estado de las que ya están en proceso hasta marcarlas completadas.
 */
export async function syncAllRecharges(): Promise<SyncResult> {
  const supabaseAdmin = await getAdmin();
  const cfg = await loadActiveConfig();

  const { data: rows, error } = await supabaseAdmin
    .from("recargas_requests")
    .select("id,status,provider_ref")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  const result: SyncResult = {
    dispatched: 0,
    completed: 0,
    rejected: 0,
    stillProcessing: 0,
    errors: [],
    provider: cfg.provider,
  };

  for (const row of rows ?? []) {
    try {
      const status =
        row.status === "pending"
          ? (await dispatchRecharge(row.id, cfg)).status
          : await pollRecharge(row, cfg);
      if (row.status === "pending") result.dispatched += 1;
      if (status === "completed") result.completed += 1;
      else if (status === "rejected") result.rejected += 1;
      else result.stillProcessing += 1;
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return result;
}
