import { describe, expect, it } from "vitest";
import { ajouterMois, dernierJourDuMois, jourParis, joursEntre, moisDe } from "./dates";
import {
  affichageVignette,
  consequencesBon,
  controlerEcheance,
  echeanceProposee,
  prioriteDemandeVerification,
} from "./metrologie";

const aujourdhui = "2026-11-07";

describe("dates (heure de Paris)", () => {
  it("23:30 UTC le 9 novembre = 10 novembre à Paris", () => {
    expect(jourParis(new Date("2026-11-09T23:30:00Z"))).toBe("2026-11-10");
  });
  it("jours entre deux dates, changement d'heure compris", () => {
    expect(joursEntre("2026-03-28", "2026-03-30")).toBe(2);
  });
  it("mois : passage d'année et dernier jour (années bissextiles comprises)", () => {
    expect(moisDe("2026-11-07")).toBe("2026-11");
    expect(ajouterMois("2026-11", 14)).toBe("2028-01");
    expect(dernierJourDuMois("2028-02")).toBe("2028-02-29");
    expect(dernierJourDuMois("2027-02")).toBe("2027-02-28");
    expect(() => ajouterMois("2026-13", 1)).toThrow();
  });
});

describe("affichage de la vignette (§6.8) : échéance = mois, valable jusqu'à la fin du mois", () => {
  it("échéance à plus de 45 j de la fin du mois → vert", () => {
    expect(affichageVignette("verte", "2027-01", aujourdhui).couleur).toBe("vert");
  });
  it("fin du mois à 45 j → orange « Vérification dans 45 j » ; à 46 j → vert", () => {
    expect(affichageVignette("verte", "2026-12", "2026-11-16")).toEqual({ couleur: "orange", libelle: "Vérification dans 45 j" });
    expect(affichageVignette("verte", "2026-12", "2026-11-15").couleur).toBe("vert");
  });
  it("échéance 11/2026 : encore valable le 30 novembre, périmée le 1er décembre", () => {
    expect(affichageVignette("verte", "2026-11", "2026-11-30")).toEqual({ couleur: "orange", libelle: "Vérification dans 0 j" });
    expect(affichageVignette("verte", "2026-11", "2026-12-01")).toEqual({ couleur: "rouge", libelle: "Vignette périmée depuis 1 j" });
  });
  it("échéance 10/2026 vue le 7 novembre → périmée depuis 7 j", () => {
    expect(affichageVignette("verte", "2026-10", aujourdhui)).toEqual({ couleur: "rouge", libelle: "Vignette périmée depuis 7 j" });
  });
  it("À vérifier et vignette rouge → rouge", () => {
    expect(affichageVignette("a_verifier", "2027-06", aujourdhui).couleur).toBe("rouge");
    expect(affichageVignette("rouge", null, aujourdhui).couleur).toBe("rouge");
  });
  it("verte sans échéance → jamais en vert", () => {
    expect(affichageVignette("verte", null, aujourdhui).couleur).toBe("rouge");
  });
});

describe("échéance après vérification conforme", () => {
  it("proposée au même mois +1 an", () => {
    expect(echeanceProposee(aujourdhui)).toBe("2027-11");
  });
  it("refusée si elle tombe le mois en cours ou avant", () => {
    expect(controlerEcheance("2026-11", aujourdhui).valide).toBe(false);
    expect(controlerEcheance("2026-10", aujourdhui).valide).toBe(false);
  });
  it("acceptée du mois prochain jusqu'à +1 an, sans avertissement", () => {
    expect(controlerEcheance("2026-12", aujourdhui)).toEqual({ valide: true, avertissement: null });
    expect(controlerEcheance("2027-11", aujourdhui)).toEqual({ valide: true, avertissement: null });
  });
  it("au-delà de +1 an et jusqu'à +2 ans pile : acceptée avec avertissement", () => {
    for (const mois of ["2027-12", "2028-11"]) {
      const r = controlerEcheance(mois, aujourdhui);
      expect(r.valide).toBe(true);
      expect(r.valide && r.avertissement).toBeTruthy();
    }
  });
  it("refusée au-delà de +2 ans", () => {
    expect(controlerEcheance("2028-12", aujourdhui).valide).toBe(false);
  });
});

describe("conséquences d'un bon signé", () => {
  it("réparation avec chaîne de mesure touchée → « À vérifier » + vérification créée", () => {
    const c = consequencesBon("reparation", [{ instrumentId: "INS-0421", chaineMesureTouchee: true }], false);
    expect(c.misesAJour).toEqual([{ instrumentId: "INS-0421", statut: "a_verifier", motif: "Vérification après réparation" }]);
    expect(c.interventionsACreer).toEqual([
      { type: "verification", description: "Vérification après réparation", priorite: "normale", instrumentIds: ["INS-0421"] },
    ]);
  });

  it("réparation sans toucher la chaîne de mesure → rien ne change", () => {
    const c = consequencesBon("reparation", [{ instrumentId: "INS-0421", chaineMesureTouchee: false }], false);
    expect(c).toEqual({ misesAJour: [], interventionsACreer: [] });
  });

  it("installation, client critique → vérification primitive urgente", () => {
    const c = consequencesBon("installation", [{ instrumentId: "INS-0712", chaineMesureTouchee: true }], true);
    expect(c.misesAJour[0].motif).toBe("Vérification primitive");
    expect(c.interventionsACreer[0]).toMatchObject({ type: "verification", priorite: "urgente" });
  });

  it("deux instruments touchés → une seule vérification qui regroupe les deux", () => {
    const c = consequencesBon("reparation", [
      { instrumentId: "A", chaineMesureTouchee: true },
      { instrumentId: "B", chaineMesureTouchee: true },
    ], false);
    expect(c.interventionsACreer).toHaveLength(1);
    expect(c.interventionsACreer[0].instrumentIds).toEqual(["A", "B"]);
  });

  it("INS-0802 conforme + INS-0803 non conforme : verte, rouge, 1 remise en conformité pour INS-0803 seul", () => {
    const c = consequencesBon("verification", [
      { instrumentId: "INS-0802", resultat: "conforme", nouvelleEcheance: "2027-11" },
      { instrumentId: "INS-0803", resultat: "non_conforme" },
    ], false);
    expect(c.misesAJour).toEqual([
      { instrumentId: "INS-0802", statut: "verte", echeance: "2027-11", motif: "Vérification conforme" },
      { instrumentId: "INS-0803", statut: "rouge", motif: "Vérification non conforme" },
    ]);
    expect(c.interventionsACreer).toEqual([
      { type: "reparation", description: "Remise en conformité", priorite: "normale", instrumentIds: ["INS-0803"] },
    ]);
  });

  it("vérification sans résultat → erreur", () => {
    expect(() => consequencesBon("verification", [{ instrumentId: "X" }], false)).toThrow();
  });
});

describe("priorité d'une demande de vérification depuis le Parc", () => {
  it("vignette périmée → urgente ; échéance proche → normale ; client critique → urgente", () => {
    expect(prioriteDemandeVerification([{ statut: "verte", echeance: "2026-10" }], false, aujourdhui)).toBe("urgente");
    expect(prioriteDemandeVerification([{ statut: "verte", echeance: "2026-12" }], false, aujourdhui)).toBe("normale");
    expect(prioriteDemandeVerification([{ statut: "verte", echeance: "2026-12" }], true, aujourdhui)).toBe("urgente");
  });
});
