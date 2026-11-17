/**
 * Référence externe des interventions (« N° de message », « N° d'OS »… selon l'entreprise).
 * Décision du porteur du projet, 17/11/2026 : facultative, non unique, une par intervention
 * en V1 ; espaces en trop et majuscules ignorés pour comparer.
 */
import { mainOeuvreFacturee, type MainOeuvre } from "./main-oeuvre.ts";

export const LIBELLE_REFERENCE_PAR_DEFAUT = "Référence externe";
export const LONGUEUR_MAX_REFERENCE = 60;
export const LONGUEUR_MAX_LIBELLE_REFERENCE = 40;

/** Texte nettoyé : espaces en début et en fin retirés, espaces multiples ramenés à un seul. */
export function nettoyerReference(texte: string): string {
  return texte.replace(/\s+/g, " ").trim();
}

/**
 * Forme de comparaison : nettoyée et en majuscules. « os  2026-0412 » = « OS 2026-0412 ».
 * Les tirets, points et espaces intérieurs comptent : « OS-12 » et « OS12 » restent différents.
 * La base calcule la même chose (fonction normaliser_reference, mêmes exemples testés).
 */
export function normaliserReference(texte: string): string {
  return nettoyerReference(texte).toUpperCase();
}

export type ControleReference =
  | { ok: true; reference: string | null } // null : la référence est retirée
  | { ok: false; erreur: string };

/** Contrôle d'une référence saisie. Un champ vide veut dire « pas de référence ». */
export function controlerReference(saisie: string | undefined, libelle: string): ControleReference {
  const reference = nettoyerReference(saisie ?? "");
  if (reference === "") return { ok: true, reference: null };
  if (reference.length > LONGUEUR_MAX_REFERENCE) {
    return { ok: false, erreur: `${libelle} : ${LONGUEUR_MAX_REFERENCE} caractères au maximum.` };
  }
  return { ok: true, reference };
}

export type ControleLibelle = { ok: true; libelle: string } | { ok: false; erreur: string };

/** Contrôle du nom affiché du champ (réglage de l'entreprise). */
export function controlerLibelleReference(saisie: string | undefined): ControleLibelle {
  const libelle = nettoyerReference(saisie ?? "");
  if (libelle === "") return { ok: false, erreur: "Le nom du champ est obligatoire." };
  if (libelle.length > LONGUEUR_MAX_LIBELLE_REFERENCE) {
    return { ok: false, erreur: `${LONGUEUR_MAX_LIBELLE_REFERENCE} caractères au maximum.` };
  }
  return { ok: true, libelle };
}

/** Ce qu'un bon signé indique pour la main-d'œuvre (valeurs figées à la signature). */
export interface MainOeuvreDuBon {
  minutesFactureesParPersonne: number;
  nombrePersonnes: number;
  tauxHoraireCentimes: number;
}

export interface TotalMainOeuvre {
  minutesFacturees: number;
  montantCentimes: number;
  /** Le détail, intervention par intervention, dans l'ordre reçu. */
  detail: MainOeuvre[];
}

/**
 * Total de main-d'œuvre facturable de plusieurs interventions (vue par référence).
 * L'arrondi à la demi-heure est fait PAR INTERVENTION, à la signature de son bon ; ici on
 * additionne seulement les résultats. Deux interventions de 20 min → 30 + 30 = 1 h facturée,
 * et non 40 min arrondies à 30.
 */
export function totalMainOeuvre(bons: MainOeuvreDuBon[]): TotalMainOeuvre {
  const detail = bons.map(mainOeuvreFacturee);
  return {
    minutesFacturees: detail.reduce((total, m) => total + m.minutesFactureesTotales, 0),
    montantCentimes: detail.reduce((total, m) => total + m.montantCentimes, 0),
    detail,
  };
}
