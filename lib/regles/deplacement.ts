/**
 * Forfait de déplacement et passages (CLAUDE.md §6.4).
 */
import { jourParis } from "./dates";

/** Réglages de l'entreprise (montants en centimes). */
export interface ReglagesDeplacement {
  limiteZone1Km: number;
  limiteZone2Km: number;
  montantZone1Centimes: number;
  montantZone2Centimes: number;
  montantZone3Centimes: number;
}

export interface ForfaitDeplacement {
  zone: 1 | 2 | 3;
  libelleZone: string;
  montantCentimes: number;
}

/** Forfait selon la distance aller agence → site, borne exacte dans la zone du dessous. */
export function forfaitDeplacement(distanceKm: number, r: ReglagesDeplacement): ForfaitDeplacement {
  if (!Number.isInteger(distanceKm) || distanceKm < 0) {
    throw new Error("La distance doit être un nombre entier de kilomètres, positif ou nul");
  }
  if (distanceKm <= r.limiteZone1Km) {
    return { zone: 1, libelleZone: `Jusqu'à ${r.limiteZone1Km} km`, montantCentimes: r.montantZone1Centimes };
  }
  if (distanceKm <= r.limiteZone2Km) {
    return {
      zone: 2,
      libelleZone: `De ${r.limiteZone1Km + 1} à ${r.limiteZone2Km} km`,
      montantCentimes: r.montantZone2Centimes,
    };
  }
  return { zone: 3, libelleZone: `Plus de ${r.limiteZone2Km} km`, montantCentimes: r.montantZone3Centimes };
}

/**
 * Nombre de passages calculé :
 * jours différents (à Paris) où un segment a démarré,
 * + chaque reprise après abandon faite le même jour que l'abandon.
 *
 * @param debutsSegments début de chaque segment du chrono
 * @param abandons instant de chaque abandon de l'intervention
 */
export function nombrePassages(debutsSegments: Date[], abandons: Date[]): number {
  const jours = new Set(debutsSegments.map(jourParis));
  const debutsTries = [...debutsSegments].sort((a, b) => a.getTime() - b.getTime());

  let reprisesMemeJour = 0;
  for (const abandon of abandons) {
    const reprise = debutsTries.find((d) => d.getTime() > abandon.getTime());
    if (reprise && jourParis(reprise) === jourParis(abandon)) reprisesMemeJour++;
  }
  return jours.size + reprisesMemeJour;
}

/** Le nombre de forfaits facturés doit être un entier entre 1 et le nombre de passages retenu. */
export function verifierNombreForfaits(nombreForfaits: number, nombrePassagesRetenu: number): string | null {
  const max = Math.max(1, nombrePassagesRetenu);
  if (!Number.isInteger(nombreForfaits) || nombreForfaits < 1 || nombreForfaits > max) {
    return `Le nombre de forfaits doit être compris entre 1 et ${max}`;
  }
  return null;
}
