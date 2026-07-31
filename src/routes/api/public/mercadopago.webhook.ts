import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook de Mercado Pago (IPN v2). Verifica la firma `x-signature` cuando el
 * secreto `MERCADOPAGO_WEBHOOK_SECRET` está configurado y actualiza el estado
 * de la transacción correspondiente.
 *
 * Docs: https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */
export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!accessToken) return new Response("Not configured", { status: 503 });

        const rawBody = await request.text();
        let payload: {
          action?: string;
          type?: string;
          data?: { id?: string };
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        // Firma opcional pero recomendada
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        const signatureHeader = request.headers.get("x-signature");
        const requestId = request.headers.get("x-request-id");
        if (secret && signatureHeader) {
          // Formato: "ts=xxx,v1=hash"
          const parts = Object.fromEntries(
            signatureHeader.split(",").map((p) => p.trim().split("=") as [string, string]),
          );
          const ts = parts.ts;
          const v1 = parts.v1;
          const dataId = payload.data?.id ?? "";
          if (ts && v1 && requestId) {
            const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
            const expected = createHmac("sha256", secret).update(manifest).digest("hex");
            const a = Buffer.from(v1);
            const b = Buffer.from(expected);
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              return new Response("Invalid signature", { status: 401 });
            }
          }
        }

        // Solo procesamos eventos de pagos
        const paymentId = payload.data?.id;
        if (!paymentId || (payload.type && payload.type !== "payment")) {
          return Response.json({ ok: true, skipped: true });
        }

        // Consultar el pago con Mercado Pago para obtener estado auténtico
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!mpRes.ok) {
          return new Response(`MP lookup failed: ${mpRes.status}`, { status: 502 });
        }
        const payment = (await mpRes.json()) as {
          status?: string;
          external_reference?: string;
          transaction_amount?: number;
        };

        const trackingId = payment.external_reference;
        if (!trackingId) return Response.json({ ok: true, skipped: "no external_reference" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Mapear estado de MP → tx_status
        const map: Record<string, "pending" | "processing" | "completed" | "rejected"> = {
          approved: "processing", // aprobado por MP → pasa a "procesando" hasta que admin confirme entrega
          in_process: "processing",
          pending: "pending",
          authorized: "processing",
          rejected: "rejected",
          cancelled: "rejected",
          refunded: "rejected",
          charged_back: "rejected",
        };
        const newStatus = map[payment.status ?? ""] ?? "pending";

        const { error } = await supabaseAdmin
          .from("transactions")
          .update({ status: newStatus })
          .eq("tracking_id", trackingId);
        if (error) return new Response(error.message, { status: 500 });

        // Actualizar historial de pagos Mercado Pago
        await supabaseAdmin
          .from("mercadopago_payments")
          .update({
            mp_payment_id: String(paymentId),
            mp_status: payment.status ?? null,
            internal_status: newStatus,
            amount: Number(payment.transaction_amount ?? 0) || undefined,
          })
          .eq("tracking_id", trackingId);

        return Response.json({ ok: true, trackingId, status: newStatus });

      },
    },
  },
});
