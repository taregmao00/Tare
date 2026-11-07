import { describe, expect, it } from "vitest";
import { calculerMainOeuvre } from "./main-oeuvre";
import { forfaitDeplacement } from "./deplacement";
import { diviserArrondi, montantLigne, totalBon } from "./montants";

describe("arrondi au centime (§6.6)", () => {
  it("0,5 centime arrondi au-dessus, en dessous arrondi en dessous", () => {
    expect(diviserArrondi(5, 10)).toBe(1); // 0,5
    expect(diviserArrondi(4, 10)).toBe(0); // 0,4
    expect(diviserArrondi(587970, 60)).toBe(9800); // 9 799,5 → 9 800
  });

  it("quantités décimales sans erreur de virgule : 2,5 m à 4,50 € = 11,25 €", () => {
    expect(montantLigne(2.5, 450)).toBe(1125);
    expect(montantLigne(1.15, 100)).toBe(115);
  });

  it("refuse une quantité nulle ou à plus de 3 décimales", () => {
    expect(() => montantLigne(0, 450)).toThrow();
    expect(() => montantLigne(1.2345, 450)).toThrow();
  });
});

describe("total du bon", () => {
  it("50 min corrigées (→ 1 h) à 65 € + 18 km + 3 × 4,50 € + 8,50 € = 137,00 € HT", () => {
    const mo = calculerMainOeuvre({ minutesReelles: 70, minutesCorrigees: 50, nombrePersonnes: 1, tauxHoraireCentimes: 6500 });
    const total = totalBon({
      mainOeuvreCentimes: mo.montantCentimes,
      forfaitDeplacementCentimes: forfaitDeplacement(18, {
        limiteZone1Km: 20, limiteZone2Km: 50,
        montantZone1Centimes: 5000, montantZone2Centimes: 8000, montantZone3Centimes: 12000,
      }).montantCentimes,
      nombreForfaitsFactures: 1,
      lignes: [
        { nature: "catalogue", quantite: 3, prixUnitaireCentimes: 450 },
        { nature: "petit_materiel", quantite: 1, prixUnitaireCentimes: 850 },
      ],
    });
    expect(total).toEqual({
      mainOeuvreCentimes: 6500,
      deplacementCentimes: 5000,
      piecesCentimes: 1350,
      petitMaterielCentimes: 850,
      totalHtCentimes: 13700,
    });
  });
});
