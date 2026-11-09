/**
 * Contrôle de l'heure du téléphone à la synchronisation (CLAUDE.md §6.9).
 * Un segment n'est jamais refusé : au pire, ses heures sont ramenées à l'heure du serveur.
 */
import type { Segment } from "./main-oeuvre";

/** Tolérance : les téléphones avancent souvent d'une ou deux minutes. */
export const TOLERANCE_HORLOGE_MS = 5 * 60_000;

/** Segment tel que reçu du téléphone : même forme que le segment du chrono. */
export type SegmentRecu = Segment;

export interface SegmentAjuste {
  debut: Date;
  fin: Date | null;
  debutRamene: boolean;
  finRamenee: boolean;
}

/** Début ou fin plus de 5 min après l'heure du serveur → ramené à l'heure du serveur. */
export function ajusterSegment(s: SegmentRecu, heureServeur: Date): SegmentAjuste {
  const limite = heureServeur.getTime() + TOLERANCE_HORLOGE_MS;
  const debutRamene = s.debut.getTime() > limite;
  const finRamenee = s.fin !== null && s.fin.getTime() > limite;
  const debut = debutRamene ? new Date(heureServeur) : s.debut;
  let fin = finRamenee ? new Date(heureServeur) : s.fin;
  if (fin && fin.getTime() < debut.getTime()) fin = new Date(debut);
  return { debut, fin, debutRamene, finRamenee };
}

/**
 * Écart d'horloge au moment de l'envoi (pas à l'heure de signature) :
 * minutes signées (téléphone − serveur), signalé au-delà de 5 min dans un sens ou dans l'autre.
 */
export function ecartHorloge(heureTelephoneEnvoi: Date, heureServeur: Date): { minutes: number; signale: boolean } {
  const ecartMs = heureTelephoneEnvoi.getTime() - heureServeur.getTime();
  return { minutes: Math.round(ecartMs / 60_000), signale: Math.abs(ecartMs) > TOLERANCE_HORLOGE_MS };
}
