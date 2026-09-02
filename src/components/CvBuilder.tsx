import { useState } from "react";
import { toast } from "sonner";
import { FileText, Printer, Download, Sparkles } from "lucide-react";

/**
 * Creador de currículo gratis (funciona sin internet y sin guardar datos en
 * el servidor): el usuario llena el formulario y se genera un documento
 * listo para imprimir o guardar como PDF.
 */
type Cv = {
  name: string;
  role: string;
  phone: string;
  email: string;
  city: string;
  docs: string;
  about: string;
  experience: string;
  education: string;
  skills: string;
  languages: string;
};

const EMPTY: Cv = {
  name: "",
  role: "",
  phone: "",
  email: "",
  city: "",
  docs: "",
  about: "",
  experience: "",
  education: "",
  skills: "",
  languages: "Español (nativo), Portugués (básico)",
};

const FIELDS: { key: keyof Cv; label: string; hint?: string; area?: boolean }[] = [
  { key: "name", label: "Nombre completo" },
  { key: "role", label: "Puesto que buscas", hint: "Ej.: Ayudante de cocina" },
  { key: "phone", label: "Teléfono / WhatsApp" },
  { key: "email", label: "Correo electrónico" },
  { key: "city", label: "Ciudad y estado en Brasil", hint: "Ej.: Boa Vista, RR" },
  { key: "docs", label: "Documentos que tienes", hint: "Ej.: CPF, CRNM, protocolo de refugio" },
  { key: "about", label: "Sobre mí", area: true, hint: "2 o 3 líneas sobre ti y tus ganas de trabajar" },
  { key: "experience", label: "Experiencia laboral", area: true, hint: "Una línea por trabajo: puesto, lugar y años" },
  { key: "education", label: "Estudios", area: true, hint: "Una línea por título o curso" },
  { key: "skills", label: "Habilidades", area: true, hint: "Ej.: puntualidad, atención al cliente, carga y descarga" },
  { key: "languages", label: "Idiomas" },
];

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function lines(s: string) {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function buildHtml(cv: Cv) {
  const block = (title: string, body: string) =>
    body.trim()
      ? `<section><h2>${esc(title)}</h2><ul>${lines(body)
          .map((l) => `<li>${esc(l)}</li>`)
          .join("")}</ul></section>`
      : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>Currículo — ${esc(cv.name || "VIP Remesas")}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:32px;font-family:Georgia,'Times New Roman',serif;color:#12212f;background:#fff;line-height:1.5}
  header{border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:18px}
  h1{margin:0;font-size:26px;letter-spacing:.5px}
  .role{margin:4px 0 0;font-size:14px;color:#0f766e;font-weight:bold;text-transform:uppercase;letter-spacing:1px}
  .contact{margin-top:8px;font-size:12px;color:#3c4a58}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#0f766e;margin:18px 0 6px;border-bottom:1px solid #d6e2e0;padding-bottom:3px}
  p,li{font-size:13px;margin:0 0 4px}
  ul{margin:0;padding-left:18px}
  footer{margin-top:26px;font-size:10px;color:#7a8794;text-align:center}
  @media print{body{padding:18mm 16mm}@page{size:A4;margin:0}}
</style></head><body>
<header>
  <h1>${esc(cv.name || "Nombre y apellidos")}</h1>
  ${cv.role ? `<p class="role">${esc(cv.role)}</p>` : ""}
  <p class="contact">${[cv.phone, cv.email, cv.city].filter(Boolean).map(esc).join(" &nbsp;•&nbsp; ")}</p>
  ${cv.docs ? `<p class="contact">Documentos: ${esc(cv.docs)}</p>` : ""}
</header>
${cv.about.trim() ? `<section><h2>Sobre mí</h2><p>${esc(cv.about.trim())}</p></section>` : ""}
${block("Experiencia laboral", cv.experience)}
${block("Estudios", cv.education)}
${block("Habilidades", cv.skills)}
${cv.languages.trim() ? `<section><h2>Idiomas</h2><p>${esc(cv.languages.trim())}</p></section>` : ""}
<footer>Currículo creado gratis con VIP Remesas</footer>
</body></html>`;
}

export function CvBuilder() {
  const [cv, setCv] = useState<Cv>(EMPTY);
  const set = (k: keyof Cv) => (v: string) => setCv((c) => ({ ...c, [k]: v }));

  function print() {
    if (!cv.name.trim()) return toast.error("Escribe al menos tu nombre");
    const w = window.open("", "_blank");
    if (!w) return toast.error("Permite las ventanas emergentes para imprimir");
    w.document.write(buildHtml(cv));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  }

  function download() {
    if (!cv.name.trim()) return toast.error("Escribe al menos tu nombre");
    const blob = new Blob([buildHtml(cv)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curriculo-${cv.name.trim().toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Currículo descargado");
  }

  return (
    <div className="space-y-4">
      <div className="animate-rise relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-amber p-5 text-white shadow-glow">
        <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shine bg-white/40 blur-md" />
        <FileText className="h-7 w-7 animate-float" />
        <p className="mt-2 font-display text-xl font-extrabold drop-shadow">Crea tu currículo gratis</p>
        <p className="mt-1 text-[11px] font-bold text-white/90">
          Llena los datos y descárgalo o imprímelo como PDF. Nada se guarda en internet.
        </p>
      </div>

      <div className="space-y-3">
        {FIELDS.map(({ key, label, hint, area }, i) => (
          <label
            key={key}
            style={{ animationDelay: `${i * 30}ms` }}
            className="animate-rise block rounded-xl border border-border bg-card p-3"
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</span>
            {area ? (
              <textarea
                rows={3}
                value={cv[key]}
                onChange={(e) => set(key)(e.target.value)}
                placeholder={hint}
                className="mt-1 w-full resize-y bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground/70"
              />
            ) : (
              <input
                value={cv[key]}
                onChange={(e) => set(key)(e.target.value)}
                placeholder={hint}
                className="mt-1 w-full bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground/70"
              />
            )}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={print}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-3 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-[0.98]"
        >
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </button>
        <button
          onClick={download}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-sky px-3 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-[0.98]"
        >
          <Download className="h-4 w-4" /> Descargar
        </button>
      </div>

      <p className="flex items-center gap-2 rounded-xl border border-gold/30 bg-secondary/60 p-3 text-[11px] font-bold text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-gold" />
        Consejo: lleva 3 copias impresas y agrega tu WhatsApp bien visible.
      </p>
    </div>
  );
}
