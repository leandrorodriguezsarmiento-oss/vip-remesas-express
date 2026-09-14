import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Renders a scannable QR image for a PIX "copia e cola" payload. */
export function PixQrCode({ value, fileName = "pix-qr.png" }: { value: string; fileName?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setError(false);
    // Browser-only import: keeps the QR encoder out of the SSR bundle.
    import("qrcode")
      .then((mod) =>
        mod.toDataURL(value, {
          width: 512,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        }),
      )
      .then((url) => { if (active) setDataUrl(url); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid h-[220px] w-[220px] place-items-center rounded-xl border border-border bg-white p-3">
        {dataUrl ? (
          <img src={dataUrl} alt="Código QR para pagar con PIX" className="h-full w-full object-contain" />
        ) : error ? (
          <span className="px-4 text-center text-xs text-muted-foreground">
            No se pudo generar el QR. Usa el código copia y pega.
          </span>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
      {dataUrl && (
        <a
          href={dataUrl}
          download={fileName}
          onClick={() => toast.success("QR descargado")}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:border-gold"
        >
          <Download className="h-3.5 w-3.5" /> Guardar QR
        </a>
      )}
    </div>
  );
}
