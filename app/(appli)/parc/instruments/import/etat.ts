import type { RapportImport } from "@/lib/regles";

/** Taille maximale du fichier envoyé (500 instruments tiennent largement dedans). */
export const TAILLE_MAX_FICHIER = 300_000;

/**
 * Ce que l'écran d'import échange avec le serveur, en deux temps :
 *   1. « choix » : on envoie le fichier, le serveur le contrôle et renvoie un rapport ;
 *   2. « rapport » : on confirme, le serveur recontrôle tout puis enregistre ;
 *   3. « termine » : les instruments sont dans le parc.
 * `contenu` est le texte du fichier : il fait l'aller-retour pour que la confirmation
 * enregistre exactement ce qui a été contrôlé.
 */
export interface EtatImport {
  etape: "choix" | "rapport" | "termine";
  erreur: string | null;
  nomFichier: string;
  contenu: string;
  rapport: RapportImport | null;
  resultat: { nombre: number; premier: string; dernier: string; doubles: number } | null;
}

export const ETAT_IMPORT_INITIAL: EtatImport = {
  etape: "choix",
  erreur: null,
  nomFichier: "",
  contenu: "",
  rapport: null,
  resultat: null,
};
