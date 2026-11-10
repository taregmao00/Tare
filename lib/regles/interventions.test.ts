import { describe, expect, it } from "vitest";
import {
  LIBELLES_STATUT,
  statutAffiche,
  trierInterventions,
  urgenceVisible,
  type InterventionATrier,
} from "./interventions";

function demande(
  numero: string,
  statut: InterventionATrier["statut"],
  priorite: InterventionATrier["priorite"],
  recue: string,
): InterventionATrier {
  return { numero, statut, priorite, recueLe: new Date(recue) };
}

describe("tri de la liste des interventions (§6.1)", () => {
  it("En cours, puis À faire, puis Prise, puis Terminée, puis Facturée", () => {
    const liste = [
      demande("INT-0005", "facturee", "normale", "2026-11-01T08:00:00Z"),
      demande("INT-0004", "terminee", "normale", "2026-11-01T08:00:00Z"),
      demande("INT-0003", "prise", "normale", "2026-11-01T08:00:00Z"),
      demande("INT-0002", "a_faire", "normale", "2026-11-01T08:00:00Z"),
      demande("INT-0001", "en_cours", "normale", "2026-11-01T08:00:00Z"),
    ];
    expect(trierInterventions(liste).map((i) => i.statut)).toEqual([
      "en_cours",
      "a_faire",
      "prise",
      "terminee",
      "facturee",
    ]);
  });

  it("à statut égal : les urgentes d'abord, puis par date de réception", () => {
    const liste = [
      demande("INT-0010", "a_faire", "normale", "2026-11-08T11:40:00Z"),
      demande("INT-0011", "a_faire", "urgente", "2026-11-10T08:05:00Z"),
      demande("INT-0012", "a_faire", "normale", "2026-11-10T08:10:00Z"),
      demande("INT-0013", "a_faire", "urgente", "2026-11-10T07:52:00Z"),
    ];
    expect(trierInterventions(liste).map((i) => i.numero)).toEqual(["INT-0013", "INT-0011", "INT-0010", "INT-0012"]);
  });

  it("le statut passe avant l'urgence : une urgente « Prise » reste après une normale « À faire »", () => {
    const liste = [
      demande("INT-0020", "prise", "urgente", "2026-11-01T08:00:00Z"),
      demande("INT-0021", "a_faire", "normale", "2026-11-09T08:00:00Z"),
      demande("INT-0022", "en_cours", "normale", "2026-11-10T08:00:00Z"),
    ];
    expect(trierInterventions(liste).map((i) => i.numero)).toEqual(["INT-0022", "INT-0021", "INT-0020"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const liste = [
      demande("INT-0002", "prise", "normale", "2026-11-01T08:00:00Z"),
      demande("INT-0001", "en_cours", "normale", "2026-11-01T08:00:00Z"),
    ];
    trierInterventions(liste);
    expect(liste[0].numero).toBe("INT-0002");
  });
});

describe("statut affiché", () => {
  it("« En cours » si le chrono tourne, « En pause » sinon", () => {
    expect(LIBELLES_STATUT[statutAffiche("en_cours", true)]).toBe("En cours");
    expect(LIBELLES_STATUT[statutAffiche("en_cours", false)]).toBe("En pause");
  });

  it("les autres statuts ne dépendent pas du chrono", () => {
    expect(LIBELLES_STATUT[statutAffiche("a_faire", false)]).toBe("À faire");
    expect(LIBELLES_STATUT[statutAffiche("prise", false)]).toBe("Prise");
    expect(LIBELLES_STATUT[statutAffiche("terminee", false)]).toBe("Terminée");
    expect(LIBELLES_STATUT[statutAffiche("facturee", false)]).toBe("Facturée");
  });

  it("l'urgence n'est plus signalée une fois l'intervention terminée ou facturée", () => {
    expect(urgenceVisible("a_faire", "urgente")).toBe(true);
    expect(urgenceVisible("en_cours", "urgente")).toBe(true);
    expect(urgenceVisible("terminee", "urgente")).toBe(false);
    expect(urgenceVisible("facturee", "urgente")).toBe(false);
    expect(urgenceVisible("a_faire", "normale")).toBe(false);
  });
});
