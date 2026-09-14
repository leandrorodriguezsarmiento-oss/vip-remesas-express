"use client";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!supabaseUrl?.startsWith("https://") || !supabasePublishableKey) {
  throw new Error("Falta una configuración pública válida para Supabase");
}

export const supabase = createBrowserClient(
  supabaseUrl,
  supabasePublishableKey,
);
