/**
 * Métrologie légale (CLAUDE.md §6.8).
 */
import {
  ajouterMois,
  dernierJourDuMois,
  joursEntre,
  moisDe,
  moisEntre,
  type JourCalendaire,
  type MoisCalendaire,
} from "./dates";

export type StatutMetrologie = "verte" | "a_verifier" | "rouge";
export type TypeIntervention = "reparation" | "verification" | "installation";
export type ResultatVerification = "conforme" | "non_conforme";
export type Priorite = "normale" | "urgente";

/** Seuil de l'alerte orange avant échéance. */
export const JOURS_ALERTE_ECHEANCE = 45;

export interface AffichageVignette {
  couleur: "vert" | "orange" | "rouge";
  libelle: string;
}

/**
 * Couleur et texte de la vignette d'un instrument, vus le jour `aujourdhui`.
 * L'échéance est un mois : la vignette est valable jusqu'au dernier jour de ce mois inclus.
 */
export function affichageVignette(
  statut: StatutMetrologie,
  echeance: MoisCalendaire | null,
  aujourdhui: JourCalendaire,
): AffichageVignette {
  if (statut === "a_verifier") return { couleur: "rouge", libelle: "À vérifier : usage réglementé interdit" };
  if (statut === "rouge") return { couleur: "rouge", libelle: "Vignette rouge : instrument refusé" };
  // Par prudence : une vignette verte sans échéance n'est jamais affichée en vert.
  if (!echeance) return { couleur: "rouge", libelle: "Échéance inconnue" };

  const restants = joursEntre(aujourdhui, dernierJourDuMois(echeance));
  if (restants < 0) return { couleur: "rouge", libelle: `Vignette périmée depuis ${-restants} j` };
  if (restants <= JOURS_ALERTE_ECHEANCE) return { couleur: "orange", libelle: `Vérification dans ${restants} j` };
  return { couleur: "vert", libelle: "Vignette verte" };
}

/** Échéance proposée après une vérification conforme : même mois, +1 an. */
export function echeanceProposee(aujourdhui: JourCalendaire): MoisCalendaire {
  return ajouterMois(moisDe(aujourdhui), 12);
}

export type ControleEcheance =
  | { valide: false; erreur: string }
  | { valide: true; avertissement: string | null };

/**
 * Échéance acceptée du mois suivant jusqu'au même mois +2 ans inclus ;
 * avertissement au-delà de +1 an. (Une échéance dans le mois en cours n'a pas de sens
 * pour une vignette qui vient d'être posée.)
 */
export function controlerEcheance(echeance: MoisCalendaire, aujourdhui: JourCalendaire): ControleEcheance {
  const ecart = moisEntre(moisDe(aujourdhui), echeance);
  if (ecart < 1) return { valide: false, erreur: "L'échéance doit être au plus tôt le mois prochain" };
  if (ecart > 24) return { valide: false, erreur: "L'échéance ne peut pas dépasser 2 ans" };
  if (ecart > 12) {
    return { valide: true, avertissement: "Échéance au-delà d'un an : à vérifier selon la périodicité de l'instrument" };
  }
  return { valide: true, avertissement: null };
}

/** Ce que le bon dit d'un instrument. */
export interface ResultatInstrument {
  instrumentId: string;
  /** Réparation ou installation : la chaîne de mesure a-t-elle été touchée ? */
  chaineMesureTouchee?: boolean | null;
  /** Vérification : résultat et nouvelle échéance en mois "AAAA-MM" (si conforme). */
  resultat?: ResultatVerification | null;
  nouvelleEcheance?: MoisCalendaire | null;
}

export interface MiseAJourInstrument {
  instrumentId: string;
  statut: StatutMetrologie;
  /** Nouvelle échéance (vignette verte) ; absente = échéance inchangée. */
  echeance?: MoisCalendaire;
  motif: string;
}

export interface InterventionACreer {
  type: TypeIntervention;
  description: string;
  priorite: Priorite;
  instrumentIds: string[];
}

export interface ConsequencesBon {
  misesAJour: MiseAJourInstrument[];
  interventionsACreer: InterventionACreer[];
}

/**
 * Conséquences métrologiques d'un bon signé, instrument par instrument.
 * Les créations d'interventions sont faites par le serveur à la synchronisation ;
 * le téléphone n'applique que les mises à jour de statut, en local.
 * Une intervention automatique regroupe tous les instruments concernés du bon.
 */
export function consequencesBon(
  type: TypeIntervention,
  instruments: ResultatInstrument[],
  clientCritique: boolean,
): ConsequencesBon {
  const priorite: Priorite = clientCritique ? "urgente" : "normale";
  const misesAJour: MiseAJourInstrument[] = [];
  const aVerifier: string[] = [];
  const aRemettreEnConformite: string[] = [];

  for (const i of instruments) {
    if (type === "verification") {
      if (i.resultat === "conforme") {
        if (!i.nouvelleEcheance) throw new Error(`Échéance manquante pour ${i.instrumentId}`);
        misesAJour.push({ instrumentId: i.instrumentId, statut: "verte", echeance: i.nouvelleEcheance, motif: "Vérification conforme" });
      } else if (i.resultat === "non_conforme") {
        misesAJour.push({ instrumentId: i.instrumentId, statut: "rouge", motif: "Vérification non conforme" });
        aRemettreEnConformite.push(i.instrumentId);
      } else {
        throw new Error(`Résultat de vérification manquant pour ${i.instrumentId}`);
      }
    } else if (i.chaineMesureTouchee) {
      const motif = type === "installation" ? "Vérification primitive" : "Vérification après réparation";
      misesAJour.push({ instrumentId: i.instrumentId, statut: "a_verifier", motif });
      aVerifier.push(i.instrumentId);
    }
  }

  const interventionsACreer: InterventionACreer[] = [];
  if (aVerifier.length > 0) {
    interventionsACreer.push({
      type: "verification",
      description: type === "installation" ? "Vérification primitive" : "Vérification après réparation",
      priorite,
      instrumentIds: aVerifier,
    });
  }
  if (aRemettreEnConformite.length > 0) {
    interventionsACreer.push({
      type: "reparation",
      description: "Remise en conformité",
      priorite,
      instrumentIds: aRemettreEnConformite,
    });
  }
  return { misesAJour, interventionsACreer };
}

/** Priorité d'une demande de vérification créée depuis l'onglet Parc. */
export function prioriteDemandeVerification(
  instruments: { statut: StatutMetrologie; echeance: MoisCalendaire | null }[],
  clientCritique: boolean,
  aujourdhui: JourCalendaire,
): Priorite {
  if (clientCritique) return "urgente";
  const enAlerte = instruments.some(
    (i) => affichageVignette(i.statut, i.echeance, aujourdhui).couleur === "rouge",
  );
  return enAlerte ? "urgente" : "normale";
}
