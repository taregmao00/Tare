import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

/**
 * Exécuté avant chaque page :
 * 1. prolonge la session Supabase (le technicien reste connecté sur son téléphone) ;
 * 2. renvoie vers /connexion si personne n'est connecté.
 * La vraie protection des données reste la base (RLS), pas ce fichier.
 */
export async function proxy(request: NextRequest) {
  const { url, clePublique } = configSupabase();
  let reponse = NextResponse.next({ request });

  const supabase = createServerClient(url, clePublique, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesAEcrire, entetes) {
        for (const { name, value } of cookiesAEcrire) request.cookies.set(name, value);
        reponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesAEcrire) {
          reponse.cookies.set(name, value, options);
        }
        for (const [cle, valeur] of Object.entries(entetes ?? {})) reponse.headers.set(cle, valeur);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const connecte = Boolean(data?.claims?.sub);
  const surConnexion = request.nextUrl.pathname.startsWith("/connexion");

  if (connecte === surConnexion) {
    // Pas connecté hors de /connexion → /connexion ; déjà connecté sur /connexion → accueil.
    const destination = request.nextUrl.clone();
    destination.pathname = connecte ? "/" : "/connexion";
    destination.search = "";
    const redirection = NextResponse.redirect(destination);
    for (const cookie of reponse.cookies.getAll()) redirection.cookies.set(cookie);
    return redirection;
  }

  return reponse;
}

export const config = {
  // Toutes les pages, sauf les fichiers techniques et les images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
