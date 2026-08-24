import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PendingCounts = { tx: number; recargas: number; orders: number; total: number };

/**
 * Cuenta lo que falta por procesar (remesas pagadas, recargas y pedidos).
 * Alimenta las alertas 1 · 2 · 3 del panel para que al admin no se le escape nada.
 */
export function usePendingCounts() {
  return useQuery<PendingCounts>({
    queryKey: ["pending-counts"],
    refetchInterval: 10000,
    queryFn: async () => {
      const pend = ["pending", "processing"] as const;
      const [tx, recargas, orders] = await Promise.all([
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .not("paid_at", "is", null)
          .in("status", pend),
        supabase.from("recargas_requests").select("id", { count: "exact", head: true }).in("status", pend),
        supabase.from("store_orders").select("id", { count: "exact", head: true }).in("status", pend),
      ]);
      const a = tx.count ?? 0;
      const b = recargas.count ?? 0;
      const c = orders.count ?? 0;
      return { tx: a, recargas: b, orders: c, total: a + b + c };
    },
  });
}
