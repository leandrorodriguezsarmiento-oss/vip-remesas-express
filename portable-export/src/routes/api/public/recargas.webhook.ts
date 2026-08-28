import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook genérico para proveedores de recargas Cubacel. El proveedor debe
 * enviar HMAC-SHA256 del cuerpo crudo en el header `x-signature`, usando el
 * secreto `RECARGA_WEBHOOK_SECRET`.
 *
 * Body esperado:
 *   { external_ref: uuid, status: "completed"|"processing"|"rejected", provider_ref?: string, message?: string }
 */
const bodySchema = z.object({
  external_ref: z.string().uuid(),
  status: z.enum(["completed", "processing", "rejected"]),
  provider_ref: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
});

export const Route = createFileRoute("/api/public/recargas/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RECARGA_WEBHOOK_SECRET;
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const sig = request.headers.get("x-signature") ?? "";
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(JSON.parse(raw));
        } catch (e) {
          return new Response(
            e instanceof Error ? e.message : "Bad request",
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("recargas_requests")
          .update({
            status: parsed.status,
            provider_ref: parsed.provider_ref ?? undefined,
            notes: parsed.message ?? undefined,
          })
          .eq("id", parsed.external_ref);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
