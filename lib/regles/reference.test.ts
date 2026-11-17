import { describe, expect, it } from "vitest";
import { calculerMainOeuvre, minutesFactureesParPersonne } from "./main-oeuvre";
import {
  controlerLibelleReference,
  controlerReference,
  nettoyerReference,
  normaliserReference,
  totalMainOeuvre,
} from "./reference";

describe("référence externe : nettoyage et comparaison", () => {
  // Mêmes exemples que supabase/tests/reference_externe.sql : la base doit dire la même chose.
  it.each([
    ["  os  2026-0412 ", "OS 2026-0412"],
    ["Msg-éà 12", "MSG-ÉÀ 12"],
    ["os\t\n12", "OS 12"],
  ])("« %s » → « %s »", (saisie, attendu) => {
    expect(normaliserReference(saisie)).toBe(attendu);
  });

  it("tirets et points gardés : « OS-12 » et « OS12 » restent différents", () => {
    expect(normaliserReference("OS-12")).not.toBe(normaliserReference("OS12"));
  });

  it("le nettoyage garde la casse saisie (c'est ce qu'on affiche)", () => {
    expect(nettoyerReference("  Os   2026-0412 ")).toBe("Os 2026-0412");
  });

  it("saisie : vide → pas de référence ; trop longue → refusée", () => {
    expect(controlerReference("   ", "N° d'OS")).toEqual({ ok: true, reference: null });
    expect(controlerReference(undefined, "N° d'OS")).toEqual({ ok: true, reference: null });
    expect(controlerReference(" os  12 ", "N° d'OS")).toEqual({ ok: true, reference: "os 12" });
    expect(controlerReference("x".repeat(61), "N° d'OS")).toEqual({ ok: false, erreur: "N° d'OS : 60 caractères au maximum." });
  });

  it("libellé du champ : obligatoire, 40 caractères au plus", () => {
    expect(controlerLibelleReference("  N°  de message ")).toEqual({ ok: true, libelle: "N° de message" });
    expect(controlerLibelleReference(" ").ok).toBe(false);
    expect(controlerLibelleReference("x".repeat(41)).ok).toBe(false);
  });
});

describe("main-d'œuvre de plusieurs interventions : arrondi PAR intervention, puis addition", () => {
  const bon = (minutesReelles: number, nombrePersonnes = 1) => {
    const mo = calculerMainOeuvre({ minutesReelles, nombrePersonnes, tauxHoraireCentimes: 6500 });
    return { minutesFactureesParPersonne: mo.minutesFactureesParPersonne, nombrePersonnes, tauxHoraireCentimes: 6500 };
  };

  it("2 interventions de 20 min → 30 + 30 = 1 h facturée (et non 40 min arrondies à 30)", () => {
    const total = totalMainOeuvre([bon(20), bon(20)]);
    expect(total.minutesFacturees).toBe(60);
    expect(total.montantCentimes).toBe(6500);
    // Pour comparaison : un seul chrono de 40 min aurait donné 30 min.
    expect(minutesFactureesParPersonne(40)).toBe(30);
  });

  it("valeurs limites de l'arrondi par intervention (§6.3 : la borne exacte va à la tranche du dessous)", () => {
    expect(totalMainOeuvre([bon(45)]).minutesFacturees).toBe(30);
    expect(totalMainOeuvre([bon(46)]).minutesFacturees).toBe(60);
    expect(totalMainOeuvre([bon(75)]).minutesFacturees).toBe(60);
    expect(totalMainOeuvre([bon(76)]).minutesFacturees).toBe(90);
    expect(totalMainOeuvre([bon(45), bon(75), bon(76)]).minutesFacturees).toBe(30 + 60 + 90);
  });

  it("le nombre de personnes compte intervention par intervention", () => {
    const total = totalMainOeuvre([bon(50, 2), bon(20, 1)]);
    expect(total.minutesFacturees).toBe(2 * 60 + 30);
    expect(total.montantCentimes).toBe(13000 + 3250);
    expect(total.detail.map((d) => d.minutesFactureesTotales)).toEqual([120, 30]);
  });

  it("chaque montant est arrondi au centime, puis on additionne", () => {
    // 1 h 30 à 65,33 €/h = 97,995 → 98,00 € ; deux fois → 196,00 €.
    const b = { minutesFactureesParPersonne: 90, nombrePersonnes: 1, tauxHoraireCentimes: 6533 };
    expect(totalMainOeuvre([b, b]).montantCentimes).toBe(19600);
  });

  it("aucune intervention → 0", () => {
    expect(totalMainOeuvre([])).toEqual({ minutesFacturees: 0, montantCentimes: 0, detail: [] });
  });

  it("refuse des minutes facturées qui ne viennent pas de l'arrondi", () => {
    expect(() => totalMainOeuvre([{ minutesFactureesParPersonne: 40, nombrePersonnes: 1, tauxHoraireCentimes: 6500 }])).toThrow();
  });
});
