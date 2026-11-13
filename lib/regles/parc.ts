/**
 * Contrôle de la saisie d'un client et d'un site (CLAUDE.md §5).
 * Fonctions pures : utilisées par les formulaires aujourd'hui, par l'import CSV ensuite.
 * La base refuse de toute façon une ligne incorrecte ; ici, on explique pourquoi en français.
 */

/** Ce qui est tapé dans un formulaire : toujours du texte, parfois absent. */
export type Saisie = Record<string, string | undefined>;

export type Controle<T> = { ok: true; valeurs: T } | { ok: false; erreurs: Record<string, string> };

const LONGUEUR_NOM = 120;
const LONGUEUR_TEXTE = 500;
const DISTANCE_MAX_KM = 2000;
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Texte nettoyé (espaces en trop retirés), ou `null` si rien n'a été saisi. */
function texte(valeur: string | undefined): string | null {
  const propre = (valeur ?? "").replace(/\s+/g, " ").trim();
  return propre === "" ? null : propre;
}

/** Vérifie un texte : obligatoire ou non, et longueur maximale. Note l'erreur s'il y en a une. */
function champTexte(
  saisie: Saisie,
  erreurs: Record<string, string>,
  champ: string,
  o: { obligatoire?: string; max: number },
): string | null {
  const valeur = texte(saisie[champ]);
  if (valeur === null) {
    if (o.obligatoire) erreurs[champ] = o.obligatoire;
    return null;
  }
  if (valeur.length > o.max) erreurs[champ] = `${o.max} caractères au maximum.`;
  return valeur;
}

export interface ValeursClient {
  nom: string;
  critique: boolean;
  note: string | null;
}

export function controlerClient(saisie: Saisie): Controle<ValeursClient> {
  const erreurs: Record<string, string> = {};
  const nom = champTexte(saisie, erreurs, "nom", { obligatoire: "Le nom du client est obligatoire.", max: LONGUEUR_NOM });
  const note = champTexte(saisie, erreurs, "note", { max: LONGUEUR_TEXTE });
  // Une case cochée arrive sous la forme « on » ; une case décochée n'arrive pas du tout.
  const critique = saisie.critique === "on" || saisie.critique === "true";

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  return { ok: true, valeurs: { nom: nom!, critique, note } };
}

export interface ValeursSite {
  nom: string;
  adresse: string | null;
  contact_nom: string | null;
  contact_fonction: string | null;
  contact_telephone: string | null;
  contact_email: string | null;
  /** Distance aller depuis l'agence, en kilomètres entiers (§6.4). */
  distance_km: number;
}

export function controlerSite(saisie: Saisie): Controle<ValeursSite> {
  const erreurs: Record<string, string> = {};
  const nom = champTexte(saisie, erreurs, "nom", { obligatoire: "Le nom du site est obligatoire.", max: LONGUEUR_NOM });
  const adresse = champTexte(saisie, erreurs, "adresse", { max: LONGUEUR_TEXTE });
  const contact_nom = champTexte(saisie, erreurs, "contact_nom", { max: LONGUEUR_NOM });
  const contact_fonction = champTexte(saisie, erreurs, "contact_fonction", { max: LONGUEUR_NOM });
  const contact_telephone = champTexte(saisie, erreurs, "contact_telephone", { max: 30 });

  const contact_email = texte(saisie.contact_email)?.toLowerCase() ?? null;
  if (contact_email !== null && !FORMAT_EMAIL.test(contact_email)) {
    erreurs.contact_email = "Cette adresse email n'est pas valide (exemple : contact@exemple.fr).";
  }

  const distanceSaisie = texte(saisie.distance_km);
  let distance_km = 0;
  if (distanceSaisie === null) {
    erreurs.distance_km = "La distance est obligatoire (0 si le site est à côté de l'agence).";
  } else if (!/^\d+$/.test(distanceSaisie)) {
    erreurs.distance_km = "La distance s'écrit en kilomètres entiers, sans virgule (exemple : 18).";
  } else {
    distance_km = Number(distanceSaisie);
    if (distance_km > DISTANCE_MAX_KM) erreurs.distance_km = `La distance ne peut pas dépasser ${DISTANCE_MAX_KM} km.`;
  }

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    valeurs: { nom: nom!, adresse, contact_nom, contact_fonction, contact_telephone, contact_email, distance_km },
  };
}
