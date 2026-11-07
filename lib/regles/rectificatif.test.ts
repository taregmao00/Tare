import { describe, expect, it } from "vitest";
import { consequencesRectificatif, controlerRectificatif, disponibiliteRectificatif } from "./rectificatif";

describe("disponibilité du rectificatif (§6.7)", () => {
  it("bon sans numéro définitif → « Disponible après l'envoi du bon »", () => {
    expect(disponibiliteRectificatif({ statut: "valide", numeroDefinitif: null, interventionFacturee: false }))
      .toEqual({ possible: false, raison: "Disponible après l'envoi du bon" });
  });
  it("intervention facturée → impossible", () => {
    expect(disponibiliteRectificatif({ statut: "valide", numeroDefinitif: "BI-2026-0001", interventionFacturee: true }).possible).toBe(false);
  });
  it("bon valide numéroté, non facturé → possible", () => {
    expect(disponibiliteRectificatif({ statut: "valide", numeroDefinitif: "BI-2026-0001", interventionFacturee: false }).possible).toBe(true);
  });
});

describe("réparation : chaîne de mesure touchée", () => {
  it("décocher « chaîne de mesure touchée » est refusé", () => {
    expect(controlerRectificatif("reparation",
      [{ instrumentId: "INS-0421", chaineMesureTouchee: true }],
      [{ instrumentId: "INS-0421", chaineMesureTouchee: false }],
    )).toHaveLength(1);
  });

  it("la cocher crée la vérification", () => {
    const c = consequencesRectificatif("reparation",
      [{ instrumentId: "INS-0421", chaineMesureTouchee: false }],
      [{ instrumentId: "INS-0421", chaineMesureTouchee: true }],
      false,
    );
    expect(c.misesAJour[0]).toMatchObject({ instrumentId: "INS-0421", statut: "a_verifier" });
    expect(c.interventionsACreer).toEqual([
      { type: "verification", description: "Vérification après réparation", priorite: "normale", instrumentIds: ["INS-0421"] },
    ]);
  });

  it("déjà cochée sur le bon d'origine → pas de nouvelle vérification (pas de doublon)", () => {
    const c = consequencesRectificatif("reparation",
      [{ instrumentId: "INS-0421", chaineMesureTouchee: true }],
      [{ instrumentId: "INS-0421", chaineMesureTouchee: true }],
      false,
    );
    expect(c.interventionsACreer).toEqual([]);
  });
});

describe("instruments ajoutés ou retirés", () => {
  const origine = [{ instrumentId: "INS-0802", resultat: "conforme" as const, nouvelleEcheance: "2027-11-07" }];

  it("retirer un instrument est refusé", () => {
    expect(controlerRectificatif("verification", origine, [])).toHaveLength(1);
  });

  it("en ajouter un est accepté, avec sa saisie métrologique", () => {
    const rectif = [...origine, { instrumentId: "INS-0803", resultat: "non_conforme" as const }];
    expect(controlerRectificatif("verification", origine, rectif)).toEqual([]);
    const c = consequencesRectificatif("verification", origine, rectif, false);
    expect(c.misesAJour).toEqual([{ instrumentId: "INS-0803", statut: "rouge", motif: "Vérification non conforme" }]);
  });

  it("instrument ajouté sans saisie métrologique → refusé", () => {
    expect(controlerRectificatif("verification", origine, [...origine, { instrumentId: "INS-0803" }])).toHaveLength(1);
    expect(controlerRectificatif("reparation", [], [{ instrumentId: "INS-0421" }])).toHaveLength(1);
  });

  it("modifier le résultat ou l'échéance d'un instrument déjà vérifié → refusé", () => {
    expect(controlerRectificatif("verification", origine, [{ ...origine[0], resultat: "non_conforme" }])).toHaveLength(1);
    expect(controlerRectificatif("verification", origine, [{ ...origine[0], nouvelleEcheance: "2028-11-07" }])).toHaveLength(1);
  });
});
