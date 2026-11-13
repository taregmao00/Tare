/**
 * Ce qu'un formulaire échange avec le serveur (connexion, client, site…).
 * Le serveur renvoie toujours cet état : un message général, les erreurs champ par champ,
 * et ce qui avait été saisi (pour ne rien faire retaper au technicien).
 */
export interface EtatFormulaire {
  erreur: string | null;
  erreurs: Record<string, string>;
  valeurs: Record<string, string>;
}

export const MESSAGE_RESEAU = "Pas de réseau. Vérifiez votre connexion (Wi-Fi ou données mobiles), puis réessayez.";
export const MESSAGE_CHAMPS = "Corrigez les champs signalés en rouge.";

/** Les champs texte d'un formulaire envoyé (les fichiers sont ignorés). */
export function saisieDe(formulaire: FormData): Record<string, string> {
  const saisie: Record<string, string> = {};
  for (const [nom, valeur] of formulaire.entries()) {
    // Les champs dont le nom commence par « $ » sont ajoutés par l'outil, pas par l'utilisateur.
    if (typeof valeur === "string" && !nom.startsWith("$")) saisie[nom] = valeur;
  }
  return saisie;
}

export function echecFormulaire(
  erreur: string,
  valeurs: Record<string, string>,
  erreurs: Record<string, string> = {},
): EtatFormulaire {
  return { erreur, erreurs, valeurs };
}
