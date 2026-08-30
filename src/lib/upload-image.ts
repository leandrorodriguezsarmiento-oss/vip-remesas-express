import { supabase } from "@/integrations/supabase/client";

/**
 * Sube una imagen al bucket privado `banners` y devuelve una URL firmada de
 * larga duración. Se usa en el panel del restaurante y en el panel admin.
 */
export async function uploadAppImage(file: File, folder = "restaurantes"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Solo se permiten imágenes (JPG, PNG o WEBP)");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen pesa más de 8 MB. Usa una más liviana.");
  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = rawExt || (file.type.split("/")[1] ?? "jpg");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("banners").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    const msg = /row-level security|Unauthorized|403/i.test(error.message)
      ? "Tu cuenta no tiene permiso para subir imágenes. Pide al admin que active tu restaurante."
      : error.message;
    throw new Error(msg);
  }
  const { data: signed, error: sErr } = await supabase.storage
    .from("banners")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr || !signed) throw sErr ?? new Error("No se pudo firmar la imagen");
  return signed.signedUrl;
}
