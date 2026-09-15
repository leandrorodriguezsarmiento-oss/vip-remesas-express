import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  fields: z.record(z.string(), z.string()).refine((r) => Object.keys(r).length <= 20),
});

/** Traduce al portugués (Brasil) los textos del currículo. */
export const translateCvToPortuguese = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const entries = Object.entries(data.fields).filter(([, v]) => v.trim().length > 0);
    if (entries.length === 0) return { fields: data.fields };

    const apiKey = process.env["AI_API_KEY"] || process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Servicio de traducción no configurado");

    const legacyLovable = !process.env["AI_API_KEY"] && !!process.env["LOVABLE_API_KEY"];
    const apiUrl = process.env["AI_API_URL"] || (legacyLovable
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions");
    const model = process.env["AI_MODEL"] || (legacyLovable ? "google/gemini-2.5-flash" : "gpt-4o-mini");
    const payload = Object.fromEntries(entries);

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Eres traductor profesional de currículos. Traduce cada valor del JSON del español al portugués de Brasil, con vocabulario natural de recursos humanos. Conserva exactamente las mismas claves, los saltos de línea y los datos personales (nombres propios, teléfonos, correos, siglas como CPF o CRNM). Responde SOLO con JSON válido.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Demasiadas traducciones seguidas. Intenta en un minuto.");
    if (res.status === 402) throw new Error("Sin créditos de IA disponibles.");
    if (!res.ok) throw new Error(`No se pudo traducir el currículo (${res.status})`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content) as Record<string, unknown>; }
    catch { throw new Error("Respuesta de traducción inválida"); }

    const out: Record<string, string> = { ...data.fields };
    for (const key of Object.keys(payload)) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return { fields: out };
  });
