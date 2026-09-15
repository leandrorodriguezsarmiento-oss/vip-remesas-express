import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-[#0B1B3A] px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3">
          <img src="/icon-192-v8.png" alt="VIP Remesas" width={56} height={56} className="h-14 w-14 rounded-2xl" />
          <div>
            <div className="text-xl font-bold">VIP Remesas</div>
            <div className="text-xs font-semibold tracking-[0.25em] text-[#E7C766]">ENVÍA COMO VIP</div>
          </div>
        </div>
        <section className="mt-12">
          <p className="text-sm font-bold uppercase tracking-wider text-[#E7C766]">VIP Remesas</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">Envía dinero como VIP a Cuba.</h1>
          <p className="mt-4 text-base text-white/70">Remesas, recargas y servicios para Cuba desde Brasil.</p>
        </section>
        <div className="mt-10 space-y-3">
          <Link to="/auth" search={{ next: undefined }} className="block w-full rounded-xl bg-[#E7C766] px-6 py-4 text-center font-bold text-[#0B1B3A]">Crear cuenta / Entrar</Link>
          <Link to="/auth" search={{ next: undefined }} className="block w-full rounded-xl border border-[#E7C766]/50 px-6 py-4 text-center font-semibold">Acceder a mi cuenta</Link>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Remesas</div><div className="mt-1 text-xs text-white/60">Brasil → Cuba</div></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Recargas</div><div className="mt-1 text-xs text-white/60">Cubacel</div></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Tasas</div><div className="mt-1 text-xs text-white/60">Actualizadas</div></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">Seguro</div><div className="mt-1 text-xs text-white/60">Cuenta protegida</div></div>
        </div>
      </div>
    </main>
  );
}
