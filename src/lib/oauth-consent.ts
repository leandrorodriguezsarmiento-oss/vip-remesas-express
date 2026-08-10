import { supabase } from "@/integrations/supabase/client";

// Typed shim for the beta supabase.auth.oauth namespace.
export type OAuthDetails = {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] };
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  scopes?: string[];
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult<OAuthDetails>>;
  approveAuthorization: (
    id: string,
  ) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
  denyAuthorization: (
    id: string,
  ) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
};

export const authOauth = (): OAuthNs =>
  (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
