/**
 * Contrôle de la saisie d'un client, d'un site et d'un instrument (CLAUDE.md §5).
 * Fonctions pures : utilisées par les formulaires aujourd'hui, par l'import CSV ensuite.
 * La base refuse de toute façon une ligne incorrecte ; ici, on explique pourquoi en français.
 */

import { ajouterMois, moisDe, moisEntre, type JourCalendaire, type MoisCalendaire } from "./dates.ts";
import type { StatutMetrologie } from "./metrologie.ts";

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

// ---------------------------------------------------------------------------
// Instrument
// ---------------------------------------------------------------------------

/** Types proposés à la saisie (le champ reste libre : on peut en écrire un autre). */
export const TYPES_INSTRUMENT_PROPOSES = [
  "Balance poids-prix",
  "Balance de précision",
  "Balance de comptoir",
  "Plateforme",
  "Plateforme de réception",
  "Pont-bascule",
  "Bascule",
  "Doseuse",
];

export const LIBELLES_STATUT_METROLOGIE: Record<StatutMetrologie, string> = {
  verte: "Vignette verte",
  a_verifier: "À vérifier (pas de vignette valable)",
  rouge: "Vignette rouge (instrument refusé)",
};

/**
 * Échéances acceptées quand on ENREGISTRE un instrument déjà en service, d'après la vignette
 * qu'il porte : de 2 ans en arrière (vignette périmée depuis longtemps) à 2 ans en avant
 * (aucune vignette n'est valable plus de 2 ans, §6.8).
 * À ne pas confondre avec l'échéance posée après une vérification (controlerEcheance).
 */
export function limitesEcheanceEnregistrement(aujourdhui: JourCalendaire): { min: MoisCalendaire; max: MoisCalendaire } {
  const moisCourant = moisDe(aujourdhui);
  return { min: ajouterMois(moisCourant, -24), max: ajouterMois(moisCourant, 24) };
}

/** Vrai si `mois` est entre `min` et `max` inclus. */
export function moisDansLimites(mois: MoisCalendaire, limites: { min: MoisCalendaire; max: MoisCalendaire }): boolean {
  return moisEntre(limites.min, mois) >= 0 && moisEntre(mois, limites.max) >= 0;
}

/** Les années proposées dans la liste déroulante, de la plus ancienne à la plus récente. */
export function anneesDesLimites(limites: { min: MoisCalendaire; max: MoisCalendaire }): number[] {
  const [debut, fin] = [Number(limites.min.slice(0, 4)), Number(limites.max.slice(0, 4))];
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}

/** Ce qui se modifie librement sur la fiche d'un instrument. */
export interface ValeursFicheInstrument {
  type: string;
  marque: string;
  modele: string;
  numero_serie: string;
  portee_max: string;
  echelon: string;
  millesime: number | null;
  emplacement: string | null;
}

/** Ce qui ne se saisit qu'à la création : ensuite, seul un bon signé le change (§6.8). */
export interface ValeursMetrologieInstrument {
  statut_metrologie: StatutMetrologie;
  echeance_verification: MoisCalendaire | null;
  motif_statut: string | null;
}

function controlerFiche(saisie: Saisie, erreurs: Record<string, string>, aujourdhui: JourCalendaire): ValeursFicheInstrument {
  const obligatoire = (champ: string, nom: string, max = 80) =>
    champTexte(saisie, erreurs, champ, { obligatoire: `${nom} est obligatoire.`, max }) ?? "";

  const fiche: ValeursFicheInstrument = {
    type: obligatoire("type", "Le type d'instrument"),
    marque: obligatoire("marque", "La marque"),
    modele: obligatoire("modele", "Le modèle"),
    numero_serie: obligatoire("numero_serie", "Le n° de série"),
    portee_max: obligatoire("portee_max", "La portée", 30),
    echelon: obligatoire("echelon", "L'échelon", 30),
    millesime: null,
    emplacement: champTexte(saisie, erreurs, "emplacement", { max: LONGUEUR_NOM }),
  };

  const millesime = texte(saisie.millesime);
  if (millesime !== null) {
    const anneeMax = Number(aujourdhui.slice(0, 4)) + 1;
    if (!/^\d{4}$/.test(millesime) || Number(millesime) < 1900 || Number(millesime) > anneeMax) {
      erreurs.millesime = `Le millésime est une année sur 4 chiffres, entre 1900 et ${anneeMax}.`;
    } else {
      fiche.millesime = Number(millesime);
    }
  }
  return fiche;
}

/** Modification d'une fiche : les champs métrologiques n'en font pas partie. */
export function controlerFicheInstrument(saisie: Saisie, aujourdhui: JourCalendaire): Controle<ValeursFicheInstrument> {
  const erreurs: Record<string, string> = {};
  const valeurs = controlerFiche(saisie, erreurs, aujourdhui);
  return Object.keys(erreurs).length > 0 ? { ok: false, erreurs } : { ok: true, valeurs };
}

/**
 * Création d'un instrument : la fiche, plus la vignette qu'il porte aujourd'hui.
 * L'échéance arrive en deux champs (`echeance_mois` de 1 à 12, `echeance_annee`) : elle n'est
 * jamais tapée au clavier (§7).
 */
export function controlerNouvelInstrument(
  saisie: Saisie,
  aujourdhui: JourCalendaire,
): Controle<ValeursFicheInstrument & ValeursMetrologieInstrument> {
  const erreurs: Record<string, string> = {};
  const fiche = controlerFiche(saisie, erreurs, aujourdhui);

  const statut = saisie.statut_metrologie;
  let echeance: MoisCalendaire | null = null;
  if (statut !== "verte" && statut !== "a_verifier" && statut !== "rouge") {
    erreurs.statut_metrologie = "Indiquez la vignette que porte l'instrument aujourd'hui.";
  } else if (statut === "verte") {
    const [mois, annee] = [Number(saisie.echeance_mois), Number(saisie.echeance_annee)];
    if (!Number.isInteger(mois) || mois < 1 || mois > 12 || !Number.isInteger(annee) || annee < 1000 || annee > 9999) {
      erreurs.echeance = "Choisissez le mois et l'année inscrits sur la vignette verte.";
    } else {
      echeance = `${annee}-${String(mois).padStart(2, "0")}`;
      if (!moisDansLimites(echeance, limitesEcheanceEnregistrement(aujourdhui))) {
        erreurs.echeance = "Cette échéance est trop ancienne ou trop lointaine (2 ans au plus dans chaque sens).";
      }
    }
  }
  const motif_statut = champTexte(saisie, erreurs, "motif_statut", { max: 200 });

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    valeurs: {
      ...fiche,
      statut_metrologie: statut as StatutMetrologie,
      echeance_verification: echeance,
      // Le motif explique un instrument sans vignette valable ; il n'a pas de sens sur une vignette verte.
      motif_statut: statut === "verte" ? null : motif_statut,
    },
  };
}
