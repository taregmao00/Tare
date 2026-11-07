/**
 * Dates et jours, toujours à l'heure de Paris (CLAUDE.md §5).
 *
 * Deux sortes de valeurs :
 * - un **instant** (`Date`) : un moment précis, stocké en UTC (début d'un segment, signature…) ;
 * - un **jour** (`JourCalendaire`, texte "AAAA-MM-JJ") : une date de calendrier sans heure
 *   (échéance de vérification, « aujourd'hui »…).
 */

/** Une date de calendrier au format "AAAA-MM-JJ", par exemple "2026-11-07". */
export type JourCalendaire = string;

const FUSEAU = "Europe/Paris";
const MS_PAR_JOUR = 86_400_000;
const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

const formateurJourParis = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Le jour (à Paris) où tombe un instant. Un segment à 23 h 30 à Paris compte pour ce jour-là. */
export function jourParis(instant: Date): JourCalendaire {
  return formateurJourParis.format(instant);
}

function decomposer(jour: JourCalendaire): [number, number, number] {
  const m = FORMAT_JOUR.exec(jour);
  if (!m) throw new Error(`Jour invalide : « ${jour} » (format attendu AAAA-MM-JJ)`);
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const verif = new Date(Date.UTC(a, mo - 1, j));
  if (verif.getUTCMonth() !== mo - 1 || verif.getUTCDate() !== j) {
    throw new Error(`Jour inexistant : « ${jour} »`);
  }
  return [a, mo, j];
}

function enMs(jour: JourCalendaire): number {
  const [a, mo, j] = decomposer(jour);
  return Date.UTC(a, mo - 1, j);
}

function depuisMs(ms: number): JourCalendaire {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Nombre de jours de `de` à `a` (positif si `a` est après `de`). */
export function joursEntre(de: JourCalendaire, a: JourCalendaire): number {
  return Math.round((enMs(a) - enMs(de)) / MS_PAR_JOUR);
}

/**
 * Un mois au format "AAAA-MM", par exemple "2027-11".
 * Sert aux échéances de vérification : la vignette n'indique que le mois et l'année,
 * et reste valable jusqu'au dernier jour de ce mois.
 */
export type MoisCalendaire = string;

const FORMAT_MOIS = /^(\d{4})-(0[1-9]|1[0-2])$/;

function decomposerMois(mois: MoisCalendaire): [number, number] {
  const m = FORMAT_MOIS.exec(mois);
  if (!m) throw new Error(`Mois invalide : « ${mois} » (format attendu AAAA-MM)`);
  return [Number(m[1]), Number(m[2])];
}

/** Le mois d'un jour : "2026-11-07" → "2026-11". */
export function moisDe(jour: JourCalendaire): MoisCalendaire {
  decomposer(jour);
  return jour.slice(0, 7);
}

/** Ajoute (ou retire) des mois : "2026-11" + 14 → "2028-01". */
export function ajouterMois(mois: MoisCalendaire, n: number): MoisCalendaire {
  const [a, mo] = decomposerMois(mois);
  const total = a * 12 + (mo - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Nombre de mois de `de` à `a` (positif si `a` est après `de`). */
export function moisEntre(de: MoisCalendaire, a: MoisCalendaire): number {
  const [a1, m1] = decomposerMois(de);
  const [a2, m2] = decomposerMois(a);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** Dernier jour d'un mois : "2028-02" → "2028-02-29". */
export function dernierJourDuMois(mois: MoisCalendaire): JourCalendaire {
  const [a, mo] = decomposerMois(mois);
  return depuisMs(Date.UTC(a, mo, 0));
}
