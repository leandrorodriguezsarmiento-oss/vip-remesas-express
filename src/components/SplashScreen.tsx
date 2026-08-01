import { useEffect, useState, type ReactNode } from "react";

export function SplashScreen({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ease-in-out">
      <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <div className="relative h-32 w-32">
          <img
            src="/icon-512.png"
            alt="VIP Remesas"
            className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.45)]"
          />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-[0.15em] text-[#D4AF37] drop-shadow-[0_2px_12px_rgba(212,175,55,0.35)]">
          VIP REMESAS
        </h1>
        <p className="mt-2 text-sm font-medium tracking-widest text-[#D4AF37]/70">
          Envía dinero como VIP
        </p>
      </div>
      <div className="absolute bottom-10 h-1 w-40 overflow-hidden rounded-full bg-[#D4AF37]/20">
        <div className="h-full w-full origin-left animate-[shrink_1.8s_linear_forwards] rounded-full bg-[#D4AF37]" />
      </div>
    </div>
  );
}
