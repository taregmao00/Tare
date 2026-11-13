/**
 * Rôles et ce qu'ils permettent (CLAUDE.md §4 et §7).
 * Ces fonctions décident de ce que l'écran PROPOSE ; c'est la base (RLS) qui décide de ce
 * qui est réellement PERMIS. Les deux doivent dire la même chose.
 */

export type Role = "technicien" | "chef_agence" | "gestionnaire" | "administrateur";

export const LIBELLES_ROLE: Record<Role, string> = {
  technicien: "Technicien",
  chef_agence: "Chef d'agence",
  gestionnaire: "Gestionnaire",
  administrateur: "Administrateur",
};

/** Créer et modifier les clients, sites et instruments : chef d'agence (son agence) et administrateur. */
export function peutGererParc(role: Role): boolean {
  return role === "chef_agence" || role === "administrateur";
}

export type Onglet = "interventions" | "parc" | "reglages";

/**
 * Onglets de la barre du bas selon le rôle (§7). Le gestionnaire n'a pas l'onglet Parc.
 * L'onglet « À traiter » sera ajouté avec son écran (phase 2, bloc 10).
 */
export function ongletsPour(role: Role): Onglet[] {
  return role === "gestionnaire" ? ["interventions", "reglages"] : ["interventions", "parc", "reglages"];
}
