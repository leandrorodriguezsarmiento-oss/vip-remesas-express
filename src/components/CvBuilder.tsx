import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Printer, Download, Sparkles, Languages, Loader2 } from "lucide-react";
import { translateCvToPortuguese } from "@/lib/cv-translate.functions";

/**
 * Creador de currículo gratis: el usuario llena el formulario en español,
 * la app lo traduce automáticamente al portugués (Brasil) y genera un PDF A4.
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

// Campos que se traducen (los datos de contacto se mantienen igual).
const TRANSLATABLE: (keyof Cv)[] = ["role", "docs", "about", "experience", "education", "skills", "languages"];

const T = {
  es: {
    fallbackName: "Nombre y apellidos",
    docs: "Documentos",
    about: "Sobre mí",
    experience: "Experiencia laboral",
    education: "Estudios",
    skills: "Habilidades",
    languages: "Idiomas",
    footer: "Currículo creado gratis con VIP Remesas",
  },
  pt: {
    fallbackName: "Nome completo",
    docs: "Documentos",
    about: "Sobre mim",
    experience: "Experiência profissional",
    education: "Formação",
    skills: "Competências",
    languages: "Idiomas",
    footer: "Currículo criado gratuitamente com VIP Remesas",
  },
} as const;

type Lang = keyof typeof T;

function lines(s: string) {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(cv: Cv, lang: Lang) {
  const t = T[lang];
  const block = (title: string, body: string) =>
    body.trim()
      ? `<section><h2>${esc(title)}</h2><ul>${lines(body)
          .map((l) => `<li>${esc(l)}</li>`)
          .join("")}</ul></section>`
      : "";

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8" />
<title>${lang === "pt" ? "Currículo" : "Currículo"} — ${esc(cv.name || "VIP Remesas")}</title>
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
  <h1>${esc(cv.name || t.fallbackName)}</h1>
  ${cv.role ? `<p class="role">${esc(cv.role)}</p>` : ""}
  <p class="contact">${[cv.phone, cv.email, cv.city].filter(Boolean).map(esc).join(" &nbsp;•&nbsp; ")}</p>
  ${cv.docs ? `<p class="contact">${t.docs}: ${esc(cv.docs)}</p>` : ""}
</header>
${cv.about.trim() ? `<section><h2>${t.about}</h2><p>${esc(cv.about.trim())}</p></section>` : ""}
${block(t.experience, cv.experience)}
${block(t.education, cv.education)}
${block(t.skills, cv.skills)}
${cv.languages.trim() ? `<section><h2>${t.languages}</h2><p>${esc(cv.languages.trim())}</p></section>` : ""}
<footer>${t.footer}</footer>
</body></html>`;
}

async function buildPdf(cv: Cv, lang: Lang) {
  const { jsPDF } = await import("jspdf");
  const t = T[lang];
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 18;
  const W = 210 - M * 2;
  let y = M;

  const ensure = (need: number) => {
    if (y + need > 297 - M) {
      doc.addPage();
      y = M;
    }
  };

  // Encabezado
  doc.setFont("times", "bold").setFontSize(22).setTextColor(18, 33, 47);
  doc.text(cv.name.trim() || t.fallbackName, M, y + 6);
  y += 10;

  if (cv.role.trim()) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(15, 118, 110);
    doc.text(cv.role.trim().toUpperCase(), M, y + 2);
    y += 6;
  }

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60, 74, 88);
  const contact = [cv.phone, cv.email, cv.city].map((v) => v.trim()).filter(Boolean).join("  •  ");
  if (contact) {
    doc.text(doc.splitTextToSize(contact, W) as string[], M, y + 2);
    y += 5;
  }
  if (cv.docs.trim()) {
    const docsLines = doc.splitTextToSize(`${t.docs}: ${cv.docs.trim()}`, W) as string[];
    doc.text(docsLines, M, y + 2);
    y += 4 * docsLines.length + 1;
  }

  y += 2;
  doc.setDrawColor(15, 118, 110).setLineWidth(0.8).line(M, y, M + W, y);
  y += 8;

  const heading = (title: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(15, 118, 110);
    doc.text(title.toUpperCase(), M, y);
    y += 2;
    doc.setDrawColor(214, 226, 224).setLineWidth(0.3).line(M, y, M + W, y);
    y += 5;
    doc.setFont("times", "normal").setFontSize(11).setTextColor(18, 33, 47);
  };

  const paragraph = (title: string, body: string) => {
    if (!body.trim()) return;
    heading(title);
    for (const line of doc.splitTextToSize(body.trim(), W) as string[]) {
      ensure(6);
      doc.text(line, M, y);
      y += 5;
    }
    y += 3;
  };

  const bullets = (title: string, body: string) => {
    const items = lines(body);
    if (items.length === 0) return;
    heading(title);
    for (const item of items) {
      const wrapped = doc.splitTextToSize(item, W - 5) as string[];
      wrapped.forEach((line, i) => {
        ensure(6);
        if (i === 0) doc.text("•", M, y);
        doc.text(line, M + 5, y);
        y += 5;
      });
    }
    y += 3;
  };

  paragraph(t.about, cv.about);
  bullets(t.experience, cv.experience);
  bullets(t.education, cv.education);
  bullets(t.skills, cv.skills);
  paragraph(t.languages, cv.languages);

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(122, 135, 148);
  doc.text(t.footer, 105, 297 - 10, { align: "center" });

  return doc;
}

function fileBase(name: string) {
  return (name.trim() || "curriculo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function CvBuilder() {
  const [cv, setCv] = useState<Cv>(EMPTY);
  const [pt, setPt] = useState<Cv | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  const [busy, setBusy] = useState(false);
  const translate = useServerFn(translateCvToPortuguese);

  const set = (k: keyof Cv) => (v: string) => {
    setCv((c) => ({ ...c, [k]: v }));
    setPt(null);
    setLang("es");
  };

  async function ensurePortuguese(): Promise<Cv> {
    if (pt) return pt;
    const fields: Record<string, string> = {};
    for (const k of TRANSLATABLE) fields[k] = cv[k];
    const res = await translate({ data: { fields } });
    const out: Cv = { ...cv, ...(res.fields as Partial<Cv>) };
    setPt(out);
    return out;
  }

  async function resolve(target: Lang): Promise<Cv | null> {
    if (target === "es") return cv;
    try {
      setBusy(true);
      return await ensurePortuguese();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo traducir");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggleLang() {
    if (lang === "pt") return setLang("es");
    if (!cv.name.trim()) return toast.error("Escribe al menos tu nombre");
    const done = await resolve("pt");
    if (done) {
      setLang("pt");
      toast.success("Currículo traducido al portugués");
    }
  }

  async function print() {
    if (!cv.name.trim()) return toast.error("Escribe al menos tu nombre");
    const data = await resolve(lang);
    if (!data) return;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Permite las ventanas emergentes para imprimir");
    w.document.write(buildHtml(data, lang));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  }

  async function download() {
    if (!cv.name.trim()) return toast.error("Escribe al menos tu nombre");
    const data = await resolve(lang);
    if (!data) return;
    try {
      setBusy(true);
      const doc = await buildPdf(data, lang);
      doc.save(`curriculo-${fileBase(cv.name)}${lang === "pt" ? "-pt" : ""}.pdf`);
      toast.success("Currículo descargado en PDF");
    } catch {
      toast.error("No se pudo generar el PDF");
    } finally {
      setBusy(false);
    }
  }

  const preview = lang === "pt" && pt ? pt : cv;

  return (
    <div className="space-y-4">
      <div className="animate-rise relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-amber p-5 text-white shadow-glow">
        <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shine bg-white/40 blur-md" />
        <FileText className="h-7 w-7 animate-float" />
        <p className="mt-2 font-display text-xl font-extrabold drop-shadow">Crea tu currículo gratis</p>
        <p className="mt-1 text-[11px] font-bold text-white/90">
          Escribe en español, tradúcelo al portugués con un toque y descárgalo en PDF. Nada se guarda en internet.
        </p>
      </div>

      <button
        onClick={toggleLang}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/40 bg-secondary/60 px-3 py-3 text-sm font-extrabold text-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4 text-gold" />}
        {lang === "pt" ? "Ver en español" : "Traducir al portugués (PT-BR)"}
      </button>

      {lang === "pt" && pt && (
        <div className="animate-rise space-y-2 rounded-xl border border-emerald-500/30 bg-secondary/50 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Versión en portugués (se descargará así)
          </p>
          {FIELDS.filter(({ key }) => preview[key].trim()).map(({ key, label }) => (
            <p key={key} className="text-[11px] font-bold text-foreground">
              <span className="text-muted-foreground">{label}: </span>
              <span className="whitespace-pre-line">{preview[key]}</span>
            </p>
          ))}
        </div>
      )}

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
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-3 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
        <button
          onClick={download}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-sky px-3 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Descargar PDF
        </button>
      </div>

      <p className="flex items-center gap-2 rounded-xl border border-gold/30 bg-secondary/60 p-3 text-[11px] font-bold text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-gold" />
        Consejo: descarga la versión en portugués, lleva 3 copias impresas y agrega tu WhatsApp bien visible.
      </p>
    </div>
  );
}
