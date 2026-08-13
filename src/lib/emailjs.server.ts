/**
 * Envío de correos vía EmailJS (API REST, modo servidor).
 * Requiere en el dashboard de EmailJS: Account → Security →
 * "Allow EmailJS API for non-browser applications".
 */

const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export type EmailJsParams = {
  to_email: string;
  subject: string;
  message: string;
  to_name?: string;
};

export async function sendEmailJs(params: EmailJsParams): Promise<{ sent: boolean; reason?: string }> {
  const serviceId = process.env["EMAILJS_SERVICE_ID"];
  const templateId = process.env["EMAILJS_TEMPLATE_ID"];
  const publicKey = process.env["EMAILJS_PUBLIC_KEY"];
  const privateKey = process.env["EMAILJS_PRIVATE_KEY"];

  if (!serviceId || !templateId || !publicKey) {
    console.error("[emailjs] configuración incompleta");
    return { sent: false, reason: "not_configured" };
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    // EmailJS rechaza (403) las peticiones sin `origin`; al enviarlo desde el
    // servidor la API acepta la llamada como aplicación autorizada.
    headers: {
      "Content-Type": "application/json",
      origin: process.env["EMAILJS_ORIGIN"] ?? "https://vip-remesas-express.lovable.app",
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      ...(privateKey ? { accessToken: privateKey } : {}),
      template_params: {
        to_email: params.to_email,
        email: params.to_email,
        to_name: params.to_name ?? "",
        subject: params.subject,
        message: params.message,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[emailjs] fallo ${res.status}: ${body}`);
    return { sent: false, reason: `emailjs_${res.status}` };
  }
  return { sent: true };
}
