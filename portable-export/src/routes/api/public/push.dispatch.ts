import { createFileRoute } from "@tanstack/react-router";
import { buildPushHTTPRequest } from "@pushforge/builder";
import { createHash, timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { notification_id?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const notificationId = body.notification_id;
        if (!notificationId || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
          return new Response("Missing notification_id", { status: 400 });
        }

        const dispatchToken = request.headers.get("x-dispatch-token");
        if (!dispatchToken || dispatchToken.length > 256) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenRow, error: tokenError } = await supabaseAdmin
          .from("bot_publish_tokens")
          .select("token_hash")
          .eq("name", "push-dispatch")
          .eq("active", true)
          .maybeSingle();

        if (
          tokenError ||
          !tokenRow?.token_hash ||
          !safeEqual(hashToken(dispatchToken), tokenRow.token_hash)
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        const privateJwkRaw = process.env.VAPID_PRIVATE_JWK;
        const adminContact = process.env.VAPID_SUBJECT;
        if (!privateJwkRaw || !adminContact) {
          return new Response("VAPID not configured", { status: 500 });
        }

        const privateJWK = JSON.parse(privateJwkRaw) as JsonWebKey;

        const { data: notif, error: nErr } = await supabaseAdmin
          .from("notifications")
          .select("id,user_id,title,body,tx_id,push_sent")
          .eq("id", notificationId)
          .maybeSingle();
        if (nErr || !notif) return new Response("Not found", { status: 404 });
        if (notif.push_sent) return Response.json({ ok: true, skipped: true });

        const { data: subs, error: sErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id,endpoint,p256dh,auth")
          .eq("user_id", notif.user_id);
        if (sErr) return new Response(sErr.message, { status: 500 });

        const payload = {
          title: notif.title,
          body: notif.body,
          url: notif.tx_id ? `/transaction/${notif.tx_id}` : "/history",
          tag: `tx-${notif.tx_id ?? notif.id}`,
        };

        let sent = 0;
        for (const sub of subs ?? []) {
          try {
            const { endpoint, headers, body: reqBody } = await buildPushHTTPRequest({
              privateJWK,
              subscription: {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              message: {
                payload,
                adminContact,
                options: { ttl: 3600, urgency: "high" },
              },
            });
            const res = await fetch(endpoint, { method: "POST", headers, body: reqBody });
            if (res.status === 404 || res.status === 410) {
              await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            } else if (res.status >= 200 && res.status < 300) {
              sent += 1;
            } else {
              console.error("[push] fallo", res.status, await res.text().catch(() => ""));
            }
          } catch (error) {
            console.error("[push] error", error);
          }
        }

        const total = subs?.length ?? 0;
        if (sent > 0 || total === 0) {
          await supabaseAdmin
            .from("notifications")
            .update({ push_sent: true })
            .eq("id", notif.id);
        }

        return Response.json({ ok: true, sent, total });
      },
    },
  },
});
