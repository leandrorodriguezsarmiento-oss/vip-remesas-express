import { useEffect, useState, type ReactNode } from "react";

export function SplashScreen({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 650);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B1B3A]">
      <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
        <img
          src="/icon-192-v8.png"
          alt="VIP Remesas"
          width={112}
          height={112}
          className="h-28 w-28 rounded-2xl object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.35)]"
        />
        <p className="mt-5 text-xs font-semibold tracking-[0.35em] text-[#E7C766]/80">
          ENVÍA COMO VIP
        </p>
      </div>
      <div className="absolute bottom-10 h-1 w-32 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-full origin-left animate-[shrink_0.65s_linear_forwards] rounded-full bg-[#E7C766]" />
      </div>
    </div>
  );
}
