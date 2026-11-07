import { describe, expect, it } from "vitest";
import { forfaitDeplacement, nombrePassages, verifierNombreForfaits, type ReglagesDeplacement } from "./deplacement";
import { totalBon } from "./montants";

const reglages: ReglagesDeplacement = {
  limiteZone1Km: 20,
  limiteZone2Km: 50,
  montantZone1Centimes: 5000,
  montantZone2Centimes: 8000,
  montantZone3Centimes: 12000,
};

// Heures de Paris. Le lundi 9 et le mardi 10 novembre 2026 (UTC+1).
const lundi = (heure: string) => new Date(`2026-11-09T${heure}+01:00`);
const mardi = (heure: string) => new Date(`2026-11-10T${heure}+01:00`);

describe("forfait de déplacement (§6.4)", () => {
  it.each([
    [0, 5000], [20, 5000], [21, 8000], [50, 8000], [51, 12000],
  ])("%i km → %i centimes", (km, montant) => {
    expect(forfaitDeplacement(km, reglages).montantCentimes).toBe(montant);
  });

  it("libellés des zones", () => {
    expect(forfaitDeplacement(18, reglages).libelleZone).toBe("Jusqu'à 20 km");
    expect(forfaitDeplacement(32, reglages).libelleZone).toBe("De 21 à 50 km");
    expect(forfaitDeplacement(80, reglages).libelleZone).toBe("Plus de 50 km");
  });

  it("refuse une distance négative ou non entière", () => {
    expect(() => forfaitDeplacement(-1, reglages)).toThrow();
    expect(() => forfaitDeplacement(12.5, reglages)).toThrow();
  });
});

describe("nombre de passages", () => {
  it("chrono le lundi et le mardi → 2 passages", () => {
    expect(nombrePassages([lundi("09:00:00"), mardi("09:00:00")], [])).toBe(2);
  });

  it("plusieurs segments le même jour → 1 passage", () => {
    expect(nombrePassages([lundi("09:00:00"), lundi("14:00:00")], [])).toBe(1);
  });

  it("abandon lundi, reprise mardi → 2", () => {
    expect(nombrePassages([lundi("09:00:00"), mardi("09:00:00")], [lundi("10:00:00")])).toBe(2);
  });

  it("abandon et reprise le même lundi → 2", () => {
    expect(nombrePassages([lundi("09:00:00"), lundi("15:00:00")], [lundi("10:00:00")])).toBe(2);
  });

  it("segment seul lundi 23:30 → mardi 01:00 → 1", () => {
    expect(nombrePassages([lundi("23:30:00")], [])).toBe(1);
  });

  it("abandon sans reprise → pas de passage en plus", () => {
    expect(nombrePassages([lundi("09:00:00")], [lundi("10:00:00")])).toBe(1);
  });

  it("le jour est compté à l'heure de Paris, pas en UTC (lundi 00:30 à Paris = dimanche 23:30 UTC)", () => {
    expect(nombrePassages([lundi("00:30:00"), lundi("10:00:00")], [])).toBe(1);
  });
});

describe("forfaits facturés", () => {
  it("2 passages, 2 forfaits, site à 18 km → 100 € ; 1 forfait → 50 €", () => {
    const forfait = forfaitDeplacement(18, reglages).montantCentimes;
    const avec = (n: number) =>
      totalBon({ mainOeuvreCentimes: 0, forfaitDeplacementCentimes: forfait, nombreForfaitsFactures: n, lignes: [] })
        .deplacementCentimes;
    expect(verifierNombreForfaits(2, 2)).toBeNull();
    expect(avec(2)).toBe(10000);
    expect(avec(1)).toBe(5000);
  });

  it("refuse 0 forfait ou plus de forfaits que de passages", () => {
    expect(verifierNombreForfaits(0, 2)).not.toBeNull();
    expect(verifierNombreForfaits(3, 2)).not.toBeNull();
  });
});
