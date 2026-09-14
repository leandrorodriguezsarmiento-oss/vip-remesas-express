import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SectionItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  grad: string;
};

/** Menú de secciones que se abre en diagonal desde la izquierda. */
export function SectionMenu({ items }: { items: readonly SectionItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú de secciones"
        className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-sky text-white shadow-glow transition-transform active:scale-95"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-foreground/40 backdrop-blur-sm"
          />
          <div className="absolute left-3 top-3 w-[16rem] rounded-2xl border border-border bg-card bg-dots p-3 shadow-glow">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-sm font-extrabold">Secciones</p>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-md p-1 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {items.map(({ to, label, icon: Icon, grad }, i) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  style={{ animationDelay: `${i * 45}ms`, marginLeft: `${i * 10}px` }}
                  className="animate-diagonal flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-extrabold transition-transform hover:border-gold active:scale-[0.98]"
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-lg text-white shadow-glow ${grad}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
