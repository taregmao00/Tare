import { supabaseServeur } from "./serveur";

export type Role = "technicien" | "chef_agence" | "gestionnaire" | "administrateur";

export const LIBELLES_ROLE: Record<Role, string> = {
  technicien: "Technicien",
  chef_agence: "Chef d'agence",
  gestionnaire: "Gestionnaire",
  administrateur: "Administrateur",
};

export interface UtilisateurCourant {
  id: string;
  nom: string;
  email: string;
  role: Role;
  habiliteVerifications: boolean;
  entreprise: string;
  agence: string | null;
}

type ClientSupabase = Awaited<ReturnType<typeof supabaseServeur>>;

/**
 * Utilisateur connecté et sa fiche (entreprise, agence, rôle).
 * - `null` : personne n'est connecté ;
 * - `"sans_fiche"` : compte de connexion qui n'est rattaché à aucune entreprise (ou désactivé).
 *
 * `supabase` : à fournir quand on vient juste de se connecter avec ce client (action de connexion).
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
    .select("id, nom, email, role, habilite_verifications, entreprise(nom), agence(nom)")
    .eq("id", id)
    .eq("actif", true)
    .maybeSingle<{
      id: string;
      nom: string;
      email: string;
      role: Role;
      habilite_verifications: boolean;
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
    entreprise: data.entreprise.nom,
    agence: data.agence?.nom ?? null,
  };
}
