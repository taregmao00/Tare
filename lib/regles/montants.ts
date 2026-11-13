/**
 * Montants du bon (CLAUDE.md §6.5 et §6.6).
 * Tous les montants sont en **centimes entiers** (6 500 = 65,00 €).
 */

/**
 * Divise et arrondit au plus proche, la moitié vers le haut (0,5 centime → 1 centime).
 * Calcul en nombres entiers pour éviter les erreurs de virgule de l'ordinateur.
 */
export function diviserArrondi(numerateur: number, diviseur: number): number {
  if (!Number.isInteger(numerateur) || !Number.isInteger(diviseur) || diviseur <= 0) {
    throw new Error("diviserArrondi attend des entiers (diviseur > 0)");
  }
  if (numerateur < 0) throw new Error("Montant négatif non prévu");
  return Math.floor((2 * numerateur + diviseur) / (2 * diviseur));
}

/** Les quantités acceptent jusqu'à 3 décimales (ex. 2,5 m de câble). */
const PRECISION_QUANTITE = 1000;

export type NatureLigne = "catalogue" | "petit_materiel";

export interface LigneBon {
  nature: NatureLigne;
  quantite: number;
  prixUnitaireCentimes: number;
}

/** Montant d'une ligne = quantité × prix unitaire, arrondi au centime. */
export function montantLigne(quantite: number, prixUnitaireCentimes: number): number {
  if (!(quantite > 0)) throw new Error("La quantité doit être supérieure à 0");
  if (!Number.isInteger(prixUnitaireCentimes) || prixUnitaireCentimes < 0) {
    throw new Error("Le prix unitaire doit être un nombre entier de centimes, positif ou nul");
  }
  const quantiteMilliemes = Math.round(quantite * PRECISION_QUANTITE);
  if (Math.abs(quantiteMilliemes - quantite * PRECISION_QUANTITE) > 1e-6) {
    throw new Error("La quantité accepte au plus 3 décimales");
  }
  return diviserArrondi(quantiteMilliemes * prixUnitaireCentimes, PRECISION_QUANTITE);
}

export interface EntreeTotalBon {
  mainOeuvreCentimes: number;
  forfaitDeplacementCentimes: number;
  nombreForfaitsFactures: number;
  lignes: LigneBon[];
}

export interface TotalBon {
  mainOeuvreCentimes: number;
  deplacementCentimes: number;
  piecesCentimes: number;
  petitMaterielCentimes: number;
  totalHtCentimes: number;
}

/** total HT = MO + forfait × nb forfaits + Σ pièces + Σ petit matériel (chaque ligne arrondie d'abord). */
export function totalBon(e: EntreeTotalBon): TotalBon {
  const deplacementCentimes = e.forfaitDeplacementCentimes * e.nombreForfaitsFactures;
  let piecesCentimes = 0;
  let petitMaterielCentimes = 0;
  for (const l of e.lignes) {
    const m = montantLigne(l.quantite, l.prixUnitaireCentimes);
    if (l.nature === "catalogue") piecesCentimes += m;
    else petitMaterielCentimes += m;
  }
  return {
    mainOeuvreCentimes: e.mainOeuvreCentimes,
    deplacementCentimes,
    piecesCentimes,
    petitMaterielCentimes,
    totalHtCentimes:
      e.mainOeuvreCentimes + deplacementCentimes + piecesCentimes + petitMaterielCentimes,
  };
}

const formatEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Montant en centimes → texte à afficher : 5000 → « 50,00 € ». */
export function formaterEuros(centimes: number): string {
  return formatEuros.format(centimes / 100);
}
