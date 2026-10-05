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

async function loadVapidConfig() {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_JWK?.trim();
  const envSubject = process.env.VAPID_SUBJECT?.trim();
  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateJwk: envPrivate, subject: envSubject || "https://vipremesas.com" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("private_runtime_config" as never)
    .select("key,value")
    .in("key", ["vapid_public_key", "vapid_private_jwk", "vapid_subject"]);
  if (error) throw error;
  const values = Object.fromEntries(((data ?? []) as Array<{ key: string; value: string }>).map((row) => [row.key, row.value]));
  if (!values.vapid_public_key || !values.vapid_private_jwk) throw new Error("VAPID not configured");
  return {
    publicKey: values.vapid_public_key,
    privateJwk: values.vapid_private_jwk,
    subject: values.vapid_subject || "https://vipremesas.com",
  };
}

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const config = await loadVapidConfig();
          return Response.json({ publicKey: config.publicKey }, { headers: { "Cache-Control": "public, max-age=300" } });
        } catch {
          return new Response("VAPID not configured", { status: 503 });
        }
      },
      POST: async ({ request }) => {
        let body: { notification_id?: string };
        try { body = await request.json(); } catch { return new Response("Bad request", { status: 400 }); }
        const notificationId = body.notification_id;
        if (!notificationId || !/^[0-9a-f-]{36}$/i.test(notificationId)) return new Response("Missing notification_id", { status: 400 });

        const dispatchToken = request.headers.get("x-dispatch-token");
        if (!dispatchToken || dispatchToken.length > 256) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenRow, error: tokenError } = await supabaseAdmin.from("bot_publish_tokens").select("token_hash").eq("name", "push-dispatch").eq("active", true).maybeSingle();
        if (tokenError || !tokenRow?.token_hash || !safeEqual(hashToken(dispatchToken), tokenRow.token_hash)) return new Response("Unauthorized", { status: 401 });

        let config;
        try { config = await loadVapidConfig(); } catch { return new Response("VAPID not configured", { status: 500 }); }
        const privateJWK = JSON.parse(config.privateJwk) as JsonWebKey;

        const { data: notif, error: nErr } = await supabaseAdmin.from("notifications").select("id,user_id,title,body,tx_id,push_sent").eq("id", notificationId).maybeSingle();
        if (nErr || !notif) return new Response("Not found", { status: 404 });
        if (notif.push_sent) return Response.json({ ok: true, skipped: true });

        const { data: subs, error: sErr } = await supabaseAdmin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", notif.user_id);
        if (sErr) return new Response(sErr.message, { status: 500 });

        const payload = { title: notif.title, body: notif.body, url: notif.tx_id ? `/transaction/${notif.tx_id}` : "/history", tag: `tx-${notif.tx_id ?? notif.id}` };
        let sent = 0;
        for (const sub of subs ?? []) {
          try {
            const { endpoint, headers, body: reqBody } = await buildPushHTTPRequest({
              privateJWK,
              subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              message: { payload, adminContact: config.subject, options: { ttl: 3600, urgency: "high" } },
            });
            const res = await fetch(endpoint, { method: "POST", headers, body: reqBody });
            if ([401, 403, 404, 410].includes(res.status)) await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            else if (res.status >= 200 && res.status < 300) sent += 1;
            else console.error("[push] fallo", res.status, await res.text().catch(() => ""));
          } catch (error) { console.error("[push] error", error); }
        }

        const total = subs?.length ?? 0;
        if (sent > 0 || total === 0) await supabaseAdmin.from("notifications").update({ push_sent: true }).eq("id", notif.id);
        return Response.json({ ok: true, sent, total });
      },
    },
  },
});
