import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";

/**
 * Connexion à Supabase côté serveur (pages, actions), avec la session de l'utilisateur
 * lue dans ses cookies. À créer à chaque requête, jamais partagée entre deux utilisateurs.
 */
export async function supabaseServeur() {
  const { url, clePublique } = configSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, clePublique, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesAEcrire) {
        try {
          for (const { name, value, options } of cookiesAEcrire) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis une page : les cookies ne peuvent pas y être écrits.
          // Sans gravité, proxy.ts rafraîchit la session à chaque requête.
        }
      },
    },
  });
}
