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

export function ajouterJours(jour: JourCalendaire, n: number): JourCalendaire {
  return depuisMs(enMs(jour) + n * MS_PAR_JOUR);
}

/**
 * Ajoute des années en gardant le jour et le mois.
 * Cas du 29 février : on prend le dernier jour de février (28) de l'année d'arrivée.
 */
export function ajouterAnnees(jour: JourCalendaire, n: number): JourCalendaire {
  const [a, mo, j] = decomposer(jour);
  const dernierJourDuMois = new Date(Date.UTC(a + n, mo, 0)).getUTCDate();
  return depuisMs(Date.UTC(a + n, mo - 1, Math.min(j, dernierJourDuMois)));
}
