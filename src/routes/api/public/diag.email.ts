import { createFileRoute } from "@tanstack/react-router";

// Ruta temporal de diagnóstico del envío de correos (EmailJS).
export const Route = createFileRoute("/api/public/diag/email")({
  server: {
    handlers: {
      GET: async () => {
        const present = {
          service: Boolean(process.env["EMAILJS_SERVICE_ID"]),
          template: Boolean(process.env["EMAILJS_TEMPLATE_ID"]),
          publicKey: Boolean(process.env["EMAILJS_PUBLIC_KEY"]),
          privateKey: Boolean(process.env["EMAILJS_PRIVATE_KEY"]),
        };
        const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", origin: "http://localhost" },
          body: JSON.stringify({
            service_id: process.env["EMAILJS_SERVICE_ID"],
            template_id: process.env["EMAILJS_TEMPLATE_ID"],
            user_id: process.env["EMAILJS_PUBLIC_KEY"],
            accessToken: process.env["EMAILJS_PRIVATE_KEY"],
            template_params: { to_email: "leandrorodriguezsarmiento@gmail.com", email: "leandrorodriguezsarmiento@gmail.com", subject: "diag", message: "diag" },
          }),
        });
        return Response.json({ present, status: r.status, body: await r.text() });
      },
    },
  },
});
