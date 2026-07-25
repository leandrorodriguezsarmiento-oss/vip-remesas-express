import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_transactions",
  title: "Listar remesas",
  description: "Lista las remesas del usuario autenticado, más recientes primero.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Cantidad máxima de remesas a devolver (por defecto 20)."),
    status: z
      .enum(["pending", "processing", "completed", "rejected", "cancelled"])
      .optional()
      .describe("Filtrar por estado."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    let q = supabase
      .from("transactions")
      .select(
        "tracking_id, status, origin_country, dest_currency, amount_brl, amount_dest, recipient_name, recipient_phone, created_at",
      )
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
