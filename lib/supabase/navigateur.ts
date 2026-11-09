import { createBrowserClient } from "@supabase/ssr";
import { configSupabase } from "./config";

/** Connexion à Supabase depuis le téléphone (composants « use client »). */
export function supabaseNavigateur() {
  const { url, clePublique } = configSupabase();
  return createBrowserClient(url, clePublique);
}
