/**
 * Chrono et main-d'œuvre facturée (CLAUDE.md §6.2 et §6.3).
 */
import { diviserArrondi } from "./montants.ts";

/** Un segment de chrono. `fin` est nulle tant que le chrono tourne. */
export interface Segment {
  debut: Date;
  fin: Date | null;
}

interface Periode {
  debut: number;
  fin: number;
}

/**
 * Fusionne les périodes qui se recouvrent (chrono démarré sur deux téléphones) :
 * le temps n'est jamais compté deux fois. Un segment en cours s'arrête à `maintenant`.
 */
export function fusionnerSegments(segments: Segment[], maintenant: Date): Periode[] {
  const periodes = segments
    .map((s) => ({ debut: s.debut.getTime(), fin: (s.fin ?? maintenant).getTime() }))
    .filter((p) => p.fin > p.debut)
    .sort((a, b) => a.debut - b.debut);

  const fusion: Periode[] = [];
  for (const p of periodes) {
    const derniere = fusion[fusion.length - 1];
    if (derniere && p.debut <= derniere.fin) {
      derniere.fin = Math.max(derniere.fin, p.fin);
    } else {
      fusion.push({ ...p });
    }
  }
  return fusion;
}

/** Temps réel en minutes entières : somme exacte des segments fusionnés, minutes gardées une seule fois sur le total. */
export function minutesReelles(segments: Segment[], maintenant: Date): number {
  const totalMs = fusionnerSegments(segments, maintenant).reduce(
    (somme, p) => somme + (p.fin - p.debut),
    0,
  );
  return Math.floor(totalMs / 60_000);
}

/** Arrondi à la demi-heure par personne, borne exacte vers le bas, minimum 30 min. */
export function minutesFactureesParPersonne(minutes: number): number {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error("Les minutes doivent être un nombre entier positif ou nul");
  }
  if (minutes <= 45) return 30;
  return 30 * Math.ceil((minutes - 15) / 30);
}

export interface EntreeMainOeuvre {
  minutesReelles: number;
  /** Minutes corrigées (titulaire ou chef d'agence, avec motif). Si présentes, elles remplacent le chrono. */
  minutesCorrigees?: number | null;
  nombrePersonnes: number;
  tauxHoraireCentimes: number;
}

export interface MainOeuvre {
  minutesRetenues: number;
  minutesFactureesParPersonne: number;
  minutesFactureesTotales: number;
  montantCentimes: number;
}

export function calculerMainOeuvre(e: EntreeMainOeuvre): MainOeuvre {
  if (!Number.isInteger(e.nombrePersonnes) || e.nombrePersonnes < 1) {
    throw new Error("Le nombre de personnes doit être un entier d'au moins 1");
  }
  if (!Number.isInteger(e.tauxHoraireCentimes) || e.tauxHoraireCentimes < 0) {
    throw new Error("Le taux horaire doit être un nombre entier de centimes");
  }
  const minutesRetenues = e.minutesCorrigees ?? e.minutesReelles;
  const parPersonne = minutesFactureesParPersonne(minutesRetenues);
  const totales = parPersonne * e.nombrePersonnes;
  return {
    minutesRetenues,
    minutesFactureesParPersonne: parPersonne,
    minutesFactureesTotales: totales,
    montantCentimes: diviserArrondi(totales * e.tauxHoraireCentimes, 60),
  };
}
