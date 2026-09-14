// Standard browser session storage for Supabase. No platform-specific broker is used.
export function browserAuthStorage() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
