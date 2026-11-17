import { cache } from "react";
import { LIBELLE_REFERENCE_PAR_DEFAUT, type Role } from "@/lib/regles";
import { supabaseServeur } from "./serveur";

export interface UtilisateurCourant {
  id: string;
  nom: string;
  email: string;
  role: Role;
  habiliteVerifications: boolean;
  entrepriseId: string;
  entreprise: string;
  /** Vide pour un gestionnaire ou un administrateur sans agence : ils voient toutes les agences. */
  agenceId: string | null;
  agence: string | null;
}

export type ClientSupabase = Awaited<ReturnType<typeof supabaseServeur>>;

/**
 * Utilisateur connecté et sa fiche (entreprise, agence, rôle).
 * - `null` : personne n'est connecté ;
 * - `"sans_fiche"` : compte de connexion qui n'est rattaché à aucune entreprise (ou désactivé).
 *
 * `supabase` : à fournir quand on vient juste de se connecter avec ce client (action de connexion).
 * Dans une page, préférer `session()`, qui ne lit la fiche qu'une fois par requête.
 */
export async function utilisateurCourant(
  supabase?: ClientSupabase,
): Promise<UtilisateurCourant | "sans_fiche" | null> {
  supabase ??= await supabaseServeur();

  // getClaims vérifie la signature de la session (ne pas se fier à getSession côté serveur).
  const { data: session } = await supabase.auth.getClaims();
  const id = session?.claims?.sub;
  if (!id) return null;

  const { data, error } = await supabase
    .from("utilisateur")
    .select("id, nom, email, role, habilite_verifications, entreprise_id, agence_id, entreprise(nom), agence(nom)")
    .eq("id", id)
    .eq("actif", true)
    .maybeSingle<{
      id: string;
      nom: string;
      email: string;
      role: Role;
      habilite_verifications: boolean;
      entreprise_id: string;
      agence_id: string | null;
      entreprise: { nom: string } | null;
      agence: { nom: string } | null;
    }>();

  if (error) {
    throw new Error(`Lecture de la fiche utilisateur impossible (${error.code}) : ${error.message}`);
  }
  if (!data || !data.entreprise) return "sans_fiche";

  return {
    id: data.id,
    nom: data.nom,
    email: data.email,
    role: data.role,
    habiliteVerifications: data.habilite_verifications,
    entrepriseId: data.entreprise_id,
    entreprise: data.entreprise.nom,
    agenceId: data.agence_id,
    agence: data.agence?.nom ?? null,
  };
}

/**
 * La connexion à Supabase et l'utilisateur de la requête en cours, lus une seule fois même si
 * plusieurs morceaux de la page (barre d'onglets, contenu) en ont besoin.
 */
export const session = cache(async () => {
  const supabase = await supabaseServeur();
  return { supabase, utilisateur: await utilisateurCourant(supabase) };
});

/**
 * Nom affiché du champ « référence externe » de l'entreprise (« N° de message », « N° d'OS »…).
 * Lu à part, avec une valeur par défaut : si la base n'est pas encore à jour, l'appli marche quand même.
 */
export const libelleReference = cache(async (): Promise<string> => {
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return LIBELLE_REFERENCE_PAR_DEFAUT;
  const { data, error } = await supabase
    .from("entreprise")
    .select("libelle_reference_externe")
    .eq("id", utilisateur.entrepriseId)
    .maybeSingle<{ libelle_reference_externe: string }>();
  if (error) console.error(`[réglages] Libellé de la référence externe illisible (${error.code}) : ${error.message}`);
  return data?.libelle_reference_externe ?? LIBELLE_REFERENCE_PAR_DEFAUT;
});
