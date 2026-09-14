/** Etiqueta de estado reutilizable (remesas, recargas y pedidos). */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    pending_payment: "bg-warning/20 text-warning",
    payment_reported: "bg-brand-amber/20 text-brand-amber",
    payment_confirmed: "bg-success/20 text-success",
    processing: "bg-brand-sky/20 text-brand-sky",
    completed: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };
  const label: Record<string, string> = {
    pending: "Pendiente",
    pending_payment: "Pendiente de pago",
    payment_reported: "Pago pendiente de verificación",
    payment_confirmed: "Pago confirmado",
    processing: "Procesando",
    completed: "Completado",
    rejected: "Rechazado",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold ${map[status] || ""}`}>
      {label[status] || status}
    </span>
  );
}
