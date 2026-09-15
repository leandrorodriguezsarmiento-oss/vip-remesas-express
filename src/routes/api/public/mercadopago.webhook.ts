import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!accessToken || !secret) return new Response("Payment webhook not configured", { status: 503 });

        const rawBody = await request.text();
        let payload: { action?: string; type?: string; data?: { id?: string } };
        try { payload = JSON.parse(rawBody); } catch { return new Response("Bad JSON", { status: 400 }); }

        const signatureHeader = request.headers.get("x-signature");
        const requestId = request.headers.get("x-request-id");
        if (!signatureHeader || !requestId) return new Response("Missing signature", { status: 401 });
        const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.trim().split("=") as [string, string]));
        const ts = parts.ts;
        const v1 = parts.v1;
        const dataId = payload.data?.id ?? "";
        if (!ts || !v1 || !dataId) return new Response("Invalid signature", { status: 401 });

        const manifestId = payload.type === "order" ? dataId.toLowerCase() : dataId;
        const manifest = `id:${manifestId};request-id:${requestId};ts:${ts};`;
        const expected = createHmac("sha256", secret).update(manifest).digest("hex");
        const a = Buffer.from(v1);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Invalid signature", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (payload.type === "order") {
          const orderRes = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!orderRes.ok) return new Response(`MP order lookup failed: ${orderRes.status}`, { status: 502 });

          const order = (await orderRes.json()) as {
            external_reference?: string;
            total_amount?: string;
            transactions?: { payments?: Array<{ id?: string; amount?: string; status?: string; payment_method?: { id?: string; type?: string } }> };
          };
          const trackingId = order.external_reference;
          const payment = order.transactions?.payments?.[0];
          if (!trackingId || !payment?.id) return Response.json({ ok: true, skipped: true });

          const { data: paymentRow } = await supabaseAdmin
            .from("mercadopago_payments")
            .select("id,transaction_id,user_id,tracking_id,order_id,amount,currency,mp_payment_id")
            .eq("order_id", dataId)
            .maybeSingle();
          if (!paymentRow) return new Response("Unknown order reference", { status: 404 });
          if (paymentRow.tracking_id !== trackingId) return new Response("Tracking reference mismatch", { status: 409 });

          const { data: tx } = await supabaseAdmin
            .from("transactions")
            .select("id,user_id,tracking_id,total_brl,status")
            .eq("id", paymentRow.transaction_id)
            .eq("user_id", paymentRow.user_id)
            .maybeSingle();
          if (!tx || tx.tracking_id !== trackingId) return new Response("Transaction reference mismatch", { status: 409 });

          if (paymentRow.mp_payment_id === String(payment.id)) return Response.json({ ok: true, duplicate: true });
          if (payment.payment_method?.id !== "pix") return new Response("Unexpected payment method", { status: 409 });

          const expectedAmount = Number(paymentRow.amount);
          const transactionAmount = Number(tx.total_brl);
          const orderAmount = Number(order.total_amount);
          const paidAmount = Number(payment.amount);
          if (![expectedAmount, transactionAmount, orderAmount, paidAmount].every(Number.isFinite)) return new Response("Invalid payment amount", { status: 409 });
          if (Math.abs(expectedAmount - transactionAmount) > 0.009 || Math.abs(orderAmount - transactionAmount) > 0.009 || Math.abs(paidAmount - transactionAmount) > 0.009) {
            return new Response("Payment amount mismatch", { status: 409 });
          }

          const { data: samePayment } = await supabaseAdmin
            .from("mercadopago_payments")
            .select("id,transaction_id")
            .eq("mp_payment_id", String(payment.id))
            .neq("id", paymentRow.id)
            .maybeSingle();
          if (samePayment) return new Response("Payment already linked to another transaction", { status: 409 });

          const statusMap: Record<string, "pending_payment" | "payment_confirmed" | "rejected"> = {
            approved: "payment_confirmed",
            authorized: "payment_confirmed",
            in_process: "pending_payment",
            pending: "pending_payment",
            action_required: "pending_payment",
            rejected: "rejected",
            cancelled: "rejected",
            refunded: "rejected",
            charged_back: "rejected",
          };
          const newStatus = statusMap[payment.status ?? ""] ?? "pending_payment";
          const paidNow = ["approved", "authorized"].includes(payment.status ?? "");
          const now = new Date().toISOString();

          const { error } = await supabaseAdmin.from("transactions")
            .update({ status: newStatus, ...(paidNow ? { paid_at: now, payment_confirmed_at: now } : {}) })
            .eq("id", paymentRow.transaction_id)
            .eq("user_id", paymentRow.user_id);
          if (error) return new Response(error.message, { status: 500 });

          const { error: paymentUpdateError } = await supabaseAdmin.from("mercadopago_payments").update({
            mp_payment_id: String(payment.id),
            mp_status: payment.status ?? null,
            internal_status: newStatus,
          }).eq("id", paymentRow.id).is("mp_payment_id", null);
          if (paymentUpdateError) return new Response(paymentUpdateError.message, { status: 500 });

          await supabaseAdmin.from("transaction_audit_log").insert({
            transaction_id: paymentRow.transaction_id,
            actor_id: null,
            action: `mercadopago_order_${payment.status ?? "unknown"}`,
            from_status: tx.status ?? null,
            to_status: newStatus,
            details: { order_id: dataId, payment_id: String(payment.id), verified_amount: paidAmount },
          });

          return Response.json({ ok: true, trackingId, status: newStatus });
        }

        const paymentId = payload.data?.id;
        if (!paymentId || (payload.type && payload.type !== "payment")) return Response.json({ ok: true, skipped: true });

        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!mpRes.ok) return new Response(`MP lookup failed: ${mpRes.status}`, { status: 502 });
        const payment = (await mpRes.json()) as { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string; payment_method_id?: string };
        const trackingId = payment.external_reference;
        if (!trackingId) return Response.json({ ok: true, skipped: "no external_reference" });

        const { data: paymentRow } = await supabaseAdmin
          .from("mercadopago_payments")
          .select("id,transaction_id,user_id,tracking_id,amount,currency,mp_payment_id")
          .eq("tracking_id", trackingId)
          .maybeSingle();
        if (!paymentRow) return new Response("Unknown payment reference", { status: 404 });
        if (paymentRow.mp_payment_id === String(paymentId)) return Response.json({ ok: true, duplicate: true });
        if (payment.payment_method_id !== "pix") return new Response("Unexpected payment method", { status: 409 });
        if (payment.currency_id !== paymentRow.currency || Math.abs(Number(payment.transaction_amount) - Number(paymentRow.amount)) > 0.009) return new Response("Payment amount or currency mismatch", { status: 409 });

        const map: Record<string, "pending_payment" | "payment_confirmed" | "rejected"> = {
          approved: "payment_confirmed", authorized: "payment_confirmed", in_process: "pending_payment", pending: "pending_payment",
          rejected: "rejected", cancelled: "rejected", refunded: "rejected", charged_back: "rejected",
        };
        const newStatus = map[payment.status ?? ""] ?? "pending_payment";
        const paidNow = ["approved", "authorized"].includes(payment.status ?? "");
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin.from("transactions")
          .update({ status: newStatus, ...(paidNow ? { paid_at: now, payment_confirmed_at: now } : {}) })
          .eq("id", paymentRow.transaction_id).eq("user_id", paymentRow.user_id);
        if (error) return new Response(error.message, { status: 500 });

        await supabaseAdmin.from("mercadopago_payments").update({ mp_payment_id: String(paymentId), mp_status: payment.status ?? null, internal_status: newStatus })
          .eq("id", paymentRow.id).is("mp_payment_id", null);
        await supabaseAdmin.from("transaction_audit_log").insert({
          transaction_id: paymentRow.transaction_id, actor_id: null, action: `mercadopago_${payment.status ?? "unknown"}`,
          from_status: null, to_status: newStatus, details: { payment_id: String(paymentId) },
        });
        return Response.json({ ok: true, trackingId, status: newStatus });
      },
    },
  },
});
