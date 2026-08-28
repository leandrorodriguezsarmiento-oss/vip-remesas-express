// Utilidades compartidas para identificadores de inicio de sesión
// (usuario / teléfono / CPF). No contiene secretos: seguro en el cliente.

export const AUTH_EMAIL_DOMAIN = "vipremesas.app";

export type AliasKind = "username" | "phone" | "cpf";

/** Normaliza un identificador para búsquedas y unicidad. */
export function normalizeAlias(kind: AliasKind, raw: string): string {
  const v = raw.trim().toLowerCase();
  if (kind === "username") return v.replace(/[^a-z0-9._-]/g, "");
  return v.replace(/\D/g, ""); // teléfono y CPF: sólo dígitos
}

/** Email sintético interno derivado del nombre de usuario. */
export function syntheticEmail(username: string): string {
  return `u.${normalizeAlias("username", username)}@${AUTH_EMAIL_DOMAIN}`;
}

export function isEmailLike(value: string): boolean {
  return value.includes("@");
}

export function looksLikeCpf(value: string): boolean {
  return normalizeAlias("cpf", value).length === 11;
}

export const COUNTRIES = [
  { code: "BR", name: "Brasil" },
  { code: "MX", name: "México" },
  { code: "US", name: "Estados Unidos" },
  { code: "EU", name: "Europa" },
  { code: "CU", name: "Cuba" },
  { code: "OT", name: "Otro" },
] as const;

export const SUPPORT_WHATSAPP = "5595981006775";
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}`;
