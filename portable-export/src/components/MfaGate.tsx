import React from "react";

/**
 * La verificación 2FA/OTP para organizadores fue retirada.
 * La autenticación de Supabase, los roles y las políticas RLS siguen protegiendo
 * las operaciones sensibles en el servidor.
 */
export function MfaGate({ children }: { userId?: string; email?: string | null; children: React.ReactNode }) {
  return <>{children}</>;
}
