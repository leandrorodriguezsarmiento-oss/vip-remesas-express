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
        const { sendEmailJs } = await import("@/lib/emailjs.server");
        const res = await sendEmailJs({
          to_email: "leandrorodriguezsarmiento@gmail.com",
          subject: "VIP Remesas · diagnóstico",
          message: "Prueba de diagnóstico",
        });
        return Response.json({ present, res });
      },
    },
  },
});
