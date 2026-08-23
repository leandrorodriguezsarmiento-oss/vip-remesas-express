import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notify-sound";

/**
 * Escucha en vivo las tablas operativas del panel (remesas, recargas y pedidos).
 * Cualquier acción del usuario llega al panel al instante, con aviso y sonido,
 * sin necesidad de refrescar a mano.
 */
export function useLiveAdmin() {
  const qc = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["admin-tx"] });
      qc.invalidateQueries({ queryKey: ["admin-recargas"] });
      qc.invalidateQueries({ queryKey: ["store-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["daily-work"] });
    };

    const channel = supabase.channel("admin-live");
    const tables = [
      { table: "transactions", label: "Nueva remesa" },
      { table: "recargas_requests", label: "Nueva recarga" },
      { table: "store_orders", label: "Nuevo pedido VipShop" },
    ] as const;

    tables.forEach(({ table, label }) => {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table }, () => {
        refresh();
        playNotificationSound();
        toast(label, { description: "Pendiente de procesar en el panel.", duration: 4000 });
      });
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table }, refresh);
    });

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
