import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { configSupabase } from "./config";

/**
 * Connexion à Supabase côté serveur (pages, actions), avec la session de l'utilisateur
 * lue dans ses cookies. À créer à chaque requête, jamais partagée entre deux utilisateurs.
 */
export async function supabaseServeur() {
  // Tout ce qui passe par Supabase dépend de l'utilisateur et de l'heure (durée de la session) :
  // on attend une vraie requête. Pendant la construction de l'appli, l'exécution s'arrête ici,
  // et rien de ce qui suit n'est préparé d'avance ni gardé en mémoire d'un utilisateur à l'autre.
  await connection();
  const cookieStore = await cookies();
  const { url, clePublique } = configSupabase();

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
