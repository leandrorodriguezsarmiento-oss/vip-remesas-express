import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_rates",
  title: "Tasas de cambio",
  description:
    "Devuelve las tasas activas para enviar remesas a Cuba (origen, método, moneda destino).",
  inputSchema: {
    origin: z.enum(["BR", "EU", "US"]).optional().describe("País de origen."),
    currency: z.enum(["CUP", "MLC", "USD"]).optional().describe("Moneda destino."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ origin, currency }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase.from("rates").select("*").eq("active", true);
    if (origin) q = q.eq("origin_country", origin);
    if (currency) q = q.eq("dest_currency", currency);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rates: data ?? [] },
    };
  },
});
