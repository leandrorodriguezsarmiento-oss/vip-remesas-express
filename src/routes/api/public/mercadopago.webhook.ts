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
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!accessToken || !secret) return new Response("Payment webhook not configured", { status: 503 });

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

        // Firma obligatoria cuando el secreto está configurado: si falta el
        // header o no coincide, se rechaza (no se puede saltar omitiéndolo).
        const signatureHeader = request.headers.get("x-signature");
        const requestId = request.headers.get("x-request-id");
        if (!signatureHeader || !requestId) {
          return new Response("Missing signature", { status: 401 });
        }
          const parts = Object.fromEntries(
            signatureHeader.split(",").map((p) => p.trim().split("=") as [string, string]),
          );
          const ts = parts.ts;
          const v1 = parts.v1;
          if (!ts || !v1) return new Response("Invalid signature", { status: 401 });
          const dataId = payload.data?.id ?? "";
          const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
          const expected = createHmac("sha256", secret).update(manifest).digest("hex");
          const a = Buffer.from(v1);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
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
          currency_id?: string;
        };

        const trackingId = payment.external_reference;
        if (!trackingId) return Response.json({ ok: true, skipped: "no external_reference" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: paymentRow } = await supabaseAdmin
          .from("mercadopago_payments")
          .select("id,transaction_id,user_id,amount,currency,mp_payment_id")
          .eq("tracking_id", trackingId)
          .maybeSingle();
        if (!paymentRow) return new Response("Unknown payment reference", { status: 404 });
        if (paymentRow.mp_payment_id === String(paymentId)) return Response.json({ ok: true, duplicate: true });
        if (payment.currency_id !== paymentRow.currency || Math.abs(Number(payment.transaction_amount) - Number(paymentRow.amount)) > 0.009) {
          return new Response("Payment amount or currency mismatch", { status: 409 });
        }

        const map: Record<string, "pending_payment" | "payment_confirmed" | "rejected"> = {
          approved: "payment_confirmed",
          authorized: "payment_confirmed",
          in_process: "pending_payment",
          pending: "pending_payment",
          rejected: "rejected",
          cancelled: "rejected",
          refunded: "rejected",
          charged_back: "rejected",
        };
        const newStatus = map[payment.status ?? ""] ?? "pending_payment";

        // Un pago aprobado/autorizado confirma el cobro: registramos paid_at
        // para que el panel admin reciba el aviso con sonido.
        const paidNow = ["approved", "authorized"].includes(payment.status ?? "");
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("transactions")
          .update({ status: newStatus, ...(paidNow ? { paid_at: now, payment_confirmed_at: now } : {}) })
          .eq("id", paymentRow.transaction_id)
          .eq("user_id", paymentRow.user_id);
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
          .eq("id", paymentRow.id)
          .is("mp_payment_id", null);

        await supabaseAdmin.from("transaction_audit_log").insert({
          transaction_id: paymentRow.transaction_id,
          actor_id: null,
          action: `mercadopago_${payment.status ?? "unknown"}`,
          from_status: null,
          to_status: newStatus,
          details: { payment_id: String(paymentId) },
        });

        return Response.json({ ok: true, trackingId, status: newStatus });

      },
    },
  },
});
