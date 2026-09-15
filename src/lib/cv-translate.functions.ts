import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  fields: z.record(z.string(), z.string()).refine((r) => Object.keys(r).length <= 20),
});

async function translateWithoutAi(text: string): Promise<string> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "es");
  url.searchParams.set("tl", "pt");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Servicio de traducción no disponible (${res.status})`);
  const json = (await res.json()) as unknown;
  const chunks = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : [];
  const translated = chunks.map((chunk) => Array.isArray(chunk) ? chunk[0] : "").filter((v): v is string => typeof v === "string").join("");
  if (!translated.trim()) throw new Error("No se recibió una traducción válida");
  return translated;
}

/** Traduce al portugués (Brasil) los textos del currículo. */
export const translateCvToPortuguese = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const entries = Object.entries(data.fields).filter(([, v]) => v.trim().length > 0);
    if (entries.length === 0) return { fields: data.fields };

    const apiKey = process.env["AI_API_KEY"];
    const payload = Object.fromEntries(entries);
    let translated: Record<string, string> = {};

    if (apiKey) {
      const apiUrl = process.env["AI_API_URL"] || "https://api.openai.com/v1/chat/completions";
      const model = process.env["AI_MODEL"] || "gpt-4o-mini";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "Eres traductor profesional de currículos. Traduce cada valor del JSON del español al portugués de Brasil. Conserva exactamente las mismas claves, saltos de línea y datos personales. Responde SOLO con JSON válido.",
            },
            { role: "user", content: JSON.stringify(payload) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`No se pudo traducir el currículo (${res.status})`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      try {
        translated = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Record<string, string>;
      } catch {
        throw new Error("Respuesta de traducción inválida");
      }
    } else {
      for (const [key, value] of entries) {
        translated[key] = await translateWithoutAi(value);
      }
    }

    const out: Record<string, string> = { ...data.fields };
    for (const key of Object.keys(payload)) {
      const value = translated[key];
      if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return { fields: out };
  });
