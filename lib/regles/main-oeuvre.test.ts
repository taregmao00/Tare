import { describe, expect, it } from "vitest";
import { calculerMainOeuvre, minutesFactureesParPersonne, minutesReelles, type Segment } from "./main-oeuvre";

// Les heures sont écrites à l'heure de Paris (novembre = UTC+1).
const h = (heure: string, jour = "2026-11-09") => new Date(`${jour}T${heure}+01:00`);
const seg = (debut: string, fin: string): Segment => ({ debut: h(debut), fin: h(fin) });
const maintenant = h("23:59:00");

describe("main-d'œuvre facturée par personne (§6.3)", () => {
  it.each([
    [0, 30], [20, 30], [45, 30], [46, 60], [75, 60], [76, 90],
    [105, 90], [106, 120], [135, 120], [136, 150],
  ])("%i min réelles → %i min facturées", (reelles, facturees) => {
    expect(minutesFactureesParPersonne(reelles)).toBe(facturees);
  });

  it("45 min 59 s → 30 min (les secondes ne comptent pas)", () => {
    const m = minutesReelles([seg("10:00:00", "10:45:59")], maintenant);
    expect(m).toBe(45);
    expect(minutesFactureesParPersonne(m)).toBe(30);
  });

  it("refuse des minutes négatives ou non entières", () => {
    expect(() => minutesFactureesParPersonne(-1)).toThrow();
    expect(() => minutesFactureesParPersonne(10.5)).toThrow();
  });
});

describe("temps réel à partir des segments (§6.2)", () => {
  it("chevauchement : 10:00–11:00 et 10:30–11:15 → 75 min", () => {
    expect(minutesReelles([seg("10:00:00", "11:00:00"), seg("10:30:00", "11:15:00")], maintenant)).toBe(75);
  });

  it("segment entièrement inclus dans un autre : compté une seule fois", () => {
    expect(minutesReelles([seg("10:00:00", "12:00:00"), seg("10:30:00", "11:00:00")], maintenant)).toBe(120);
  });

  it("secondes sur le total : 10 segments de 4 min 40 s → 46 min → 1 h facturée", () => {
    const segments: Segment[] = [];
    for (let i = 0; i < 10; i++) {
      const debut = new Date(h("08:00:00").getTime() + i * 10 * 60_000);
      segments.push({ debut, fin: new Date(debut.getTime() + 280_000) });
    }
    const m = minutesReelles(segments, maintenant);
    expect(m).toBe(46);
    expect(minutesFactureesParPersonne(m)).toBe(60);
  });

  it("un segment en cours compte jusqu'à maintenant", () => {
    expect(minutesReelles([{ debut: h("10:00:00"), fin: null }], h("10:20:30"))).toBe(20);
  });

  it("aucun segment → 0 min", () => {
    expect(minutesReelles([], maintenant)).toBe(0);
  });
});

describe("montant de main-d'œuvre", () => {
  it("50 min × 2 personnes → 2 h facturées", () => {
    const mo = calculerMainOeuvre({ minutesReelles: 50, nombrePersonnes: 2, tauxHoraireCentimes: 6500 });
    expect(mo.minutesFactureesParPersonne).toBe(60);
    expect(mo.minutesFactureesTotales).toBe(120);
    expect(mo.montantCentimes).toBe(13000);
  });

  it("les minutes corrigées remplacent le chrono", () => {
    const mo = calculerMainOeuvre({ minutesReelles: 130, minutesCorrigees: 50, nombrePersonnes: 1, tauxHoraireCentimes: 6500 });
    expect(mo.minutesRetenues).toBe(50);
    expect(mo.montantCentimes).toBe(6500);
  });

  it("arrondi au centime : 1 h 30 à 65,33 €/h = 97,995 → 98,00 €", () => {
    const mo = calculerMainOeuvre({ minutesReelles: 90, nombrePersonnes: 1, tauxHoraireCentimes: 6533 });
    expect(mo.montantCentimes).toBe(9800);
  });

  it("refuse 0 personne", () => {
    expect(() => calculerMainOeuvre({ minutesReelles: 30, nombrePersonnes: 0, tauxHoraireCentimes: 6500 })).toThrow();
  });
});
