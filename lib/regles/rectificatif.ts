/**
 * Bon rectificatif (CLAUDE.md §6.7) : ce qu'il a le droit de changer,
 * et les conséquences métrologiques des seuls changements autorisés.
 */
import {
  consequencesBon,
  type ConsequencesBon,
  type ResultatInstrument,
  type TypeIntervention,
} from "./metrologie";

export type StatutBon = "valide" | "annule_remplace" | "refuse";

export interface EtatBonOrigine {
  statut: StatutBon;
  numeroDefinitif: string | null;
  interventionFacturee: boolean;
}

/** Peut-on créer un rectificatif depuis ce bon ? (les droits par rôle sont vérifiés ailleurs) */
export function disponibiliteRectificatif(b: EtatBonOrigine): { possible: true } | { possible: false; raison: string } {
  if (b.interventionFacturee) return { possible: false, raison: "Intervention facturée : rectificatif impossible" };
  if (b.statut !== "valide") return { possible: false, raison: "Ce bon a déjà été annulé ou refusé" };
  if (!b.numeroDefinitif) return { possible: false, raison: "Disponible après l'envoi du bon" };
  return { possible: true };
}

/**
 * Liste les changements interdits du rectificatif par rapport au bon d'origine.
 * Tableau vide = rectificatif acceptable.
 */
export function controlerRectificatif(
  type: TypeIntervention,
  origine: ResultatInstrument[],
  rectificatif: ResultatInstrument[],
): string[] {
  const erreurs: string[] = [];
  const dansRectif = new Map(rectificatif.map((i) => [i.instrumentId, i]));
  const idsOrigine = new Set(origine.map((i) => i.instrumentId));

  for (const o of origine) {
    const r = dansRectif.get(o.instrumentId);
    if (!r) {
      erreurs.push(`Impossible de retirer l'instrument ${o.instrumentId} d'un bon signé`);
      continue;
    }
    if (type === "verification") {
      if (r.resultat !== o.resultat || (r.nouvelleEcheance ?? null) !== (o.nouvelleEcheance ?? null)) {
        erreurs.push(
          `Résultat et échéance de ${o.instrumentId} non modifiables : faire une nouvelle intervention de vérification`,
        );
      }
    } else if (o.chaineMesureTouchee && !r.chaineMesureTouchee) {
      erreurs.push(`« Chaîne de mesure touchée » ne peut pas être décochée pour ${o.instrumentId}`);
    }
  }

  for (const r of rectificatif) {
    if (idsOrigine.has(r.instrumentId)) continue;
    if (type === "verification") {
      if (!r.resultat) erreurs.push(`Résultat obligatoire pour l'instrument ajouté ${r.instrumentId}`);
      else if (r.resultat === "conforme" && !r.nouvelleEcheance) {
        erreurs.push(`Échéance obligatoire pour l'instrument ajouté ${r.instrumentId}`);
      }
    } else if (typeof r.chaineMesureTouchee !== "boolean") {
      erreurs.push(`Indiquer si la chaîne de mesure a été touchée pour l'instrument ajouté ${r.instrumentId}`);
    }
  }
  return erreurs;
}

/**
 * Conséquences métrologiques d'un rectificatif accepté : uniquement pour
 * les instruments ajoutés et ceux dont la chaîne de mesure passe de non à oui.
 * Les interventions déjà créées par le bon d'origine ne sont jamais annulées.
 */
export function consequencesRectificatif(
  type: TypeIntervention,
  origine: ResultatInstrument[],
  rectificatif: ResultatInstrument[],
  clientCritique: boolean,
): ConsequencesBon {
  const erreurs = controlerRectificatif(type, origine, rectificatif);
  if (erreurs.length > 0) throw new Error(erreurs.join(" ; "));

  const avant = new Map(origine.map((i) => [i.instrumentId, i]));
  const nouveaux = rectificatif.filter((r) => {
    const o = avant.get(r.instrumentId);
    if (!o) return true;
    return type !== "verification" && !o.chaineMesureTouchee && r.chaineMesureTouchee === true;
  });
  return consequencesBon(type, nouveaux, clientCritique);
}
