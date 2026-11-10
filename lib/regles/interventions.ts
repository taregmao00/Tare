/**
 * Liste des interventions (CLAUDE.md §6.1) : ordre d'affichage et libellé du statut.
 */
import type { Priorite } from "./metrologie.ts";

export type StatutIntervention = "a_faire" | "prise" | "en_cours" | "terminee" | "facturee";

/** Ordre des statuts dans la liste : En cours, À faire, Prise, Terminée, Facturée. */
const RANG_STATUT: Record<StatutIntervention, number> = {
  en_cours: 0,
  a_faire: 1,
  prise: 2,
  terminee: 3,
  facturee: 4,
};

export interface InterventionATrier {
  statut: StatutIntervention;
  priorite: Priorite;
  /** Date de réception de la demande. */
  recueLe: Date;
  /** Numéro lisible (INT-0001…), pour départager deux demandes reçues au même instant. */
  numero: string;
}

/**
 * Tri de la liste : par statut ; à statut égal, les urgentes d'abord,
 * puis par date de réception (la plus ancienne en premier : elle attend depuis plus longtemps).
 */
export function comparerInterventions(a: InterventionATrier, b: InterventionATrier): number {
  return (
    RANG_STATUT[a.statut] - RANG_STATUT[b.statut] ||
    Number(b.priorite === "urgente") - Number(a.priorite === "urgente") ||
    a.recueLe.getTime() - b.recueLe.getTime() ||
    a.numero.localeCompare(b.numero)
  );
}

/** Trie sans modifier la liste reçue. */
export function trierInterventions<T extends InterventionATrier>(interventions: readonly T[]): T[] {
  return [...interventions].sort(comparerInterventions);
}

/** Statut tel qu'il s'affiche : « En cours » se lit « En pause » quand le chrono ne tourne pas. */
export type StatutAffiche = StatutIntervention | "en_pause";

export const LIBELLES_STATUT: Record<StatutAffiche, string> = {
  a_faire: "À faire",
  prise: "Prise",
  en_cours: "En cours",
  en_pause: "En pause",
  terminee: "Terminée",
  facturee: "Facturée",
};

export function statutAffiche(statut: StatutIntervention, chronoTourne: boolean): StatutAffiche {
  return statut === "en_cours" && !chronoTourne ? "en_pause" : statut;
}

/** Une intervention urgente n'est signalée que tant qu'il reste quelque chose à faire. */
export function urgenceVisible(statut: StatutIntervention, priorite: Priorite): boolean {
  return priorite === "urgente" && statut !== "terminee" && statut !== "facturee";
}
