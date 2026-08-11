/** Etiqueta de estado reutilizable (remesas, recargas y pedidos). */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    processing: "bg-brand-sky/20 text-brand-sky",
    completed: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };
  const label: Record<string, string> = {
    pending: "Pendiente",
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
