import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notify-sound";

/**
 * Escucha en vivo las tablas operativas del panel (remesas, recargas y pedidos).
 * Las remesas sólo avisan cuando el pago está confirmado (paid_at); las recargas
 * y pedidos avisan al crearse, porque se pagan antes de enviarse.
 */
export function useLiveAdmin(userId?: string) {
  const qc = useQueryClient();


  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["admin-tx"] });
      qc.invalidateQueries({ queryKey: ["admin-recargas"] });
      qc.invalidateQueries({ queryKey: ["store-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["daily-work"] });
      qc.invalidateQueries({ queryKey: ["pending-counts"] });
    };

    const alert = (label: string) => {
      refresh();
      playNotificationSound();
      toast(label, { description: "Pendiente de procesar en el panel.", duration: 4000 });
    };

    const channel = supabase.channel("admin-live");

    // Remesas: avisar sólo al confirmarse el pago.
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, refresh);
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, (payload) => {
      const oldRow = payload.old as { paid_at?: string | null } | null;
      const newRow = payload.new as { paid_at?: string | null } | null;
      if (!oldRow?.paid_at && newRow?.paid_at) alert("Remesa pagada");
      else refresh();
    });

    // Recargas y pedidos: se pagan antes, así que avisan al crearse.
    ([
      { table: "recargas_requests", label: "Nueva recarga" },
      { table: "store_orders", label: "Nuevo pedido VipShop" },
    ] as const).forEach(({ table, label }) => {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table }, () => alert(label));
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table }, refresh);
    });

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
