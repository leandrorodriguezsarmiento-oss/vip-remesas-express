// Almacenamiento de sesión estándar del navegador.
export function brokeredPreviewStorage() {
  if (typeof window === "undefined") return undefined;
  return localStorage;
}
