import { describe, expect, it } from "vitest";
import { ajouterJours, formaterMois, instantParis, jourParis } from "./dates";

describe("jours et heures de Paris", () => {
  it("ajoute ou retire des jours, en passant les fins de mois et d'année", () => {
    expect(ajouterJours("2026-11-10", 0)).toBe("2026-11-10");
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
    expect(ajouterJours("2026-03-01", -1)).toBe("2026-02-28");
    expect(ajouterJours("2026-11-10", -20)).toBe("2026-10-21");
  });

  it("heure d'hiver : Paris a 1 h d'avance sur UTC", () => {
    expect(instantParis("2026-11-09", "07:52").toISOString()).toBe("2026-11-09T06:52:00.000Z");
    expect(instantParis("2026-01-01").toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("heure d'été : Paris a 2 h d'avance sur UTC", () => {
    expect(instantParis("2026-07-14", "15:40").toISOString()).toBe("2026-07-14T13:40:00.000Z");
  });

  it("jours de changement d'heure", () => {
    // 29/03/2026 : passage à l'heure d'été à 2 h ; 25/10/2026 : retour à l'heure d'hiver à 3 h.
    expect(instantParis("2026-03-29", "01:30").toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(instantParis("2026-03-29", "03:30").toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(instantParis("2026-10-25", "01:30").toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(instantParis("2026-10-25", "03:30").toISOString()).toBe("2026-10-25T02:30:00.000Z");
  });

  it("aller-retour avec jourParis", () => {
    expect(jourParis(instantParis("2026-11-09", "00:00"))).toBe("2026-11-09");
    expect(jourParis(instantParis("2026-11-09", "23:59"))).toBe("2026-11-09");
  });

  it("refuse une heure mal écrite", () => {
    expect(() => instantParis("2026-11-09", "7h52")).toThrow();
    expect(() => instantParis("2026-11-09", "24:00")).toThrow();
  });

  it("affiche un mois comme sur la vignette", () => {
    expect(formaterMois("2027-11")).toBe("11/2027");
    expect(formaterMois("2026-03")).toBe("03/2026");
    expect(() => formaterMois("2026-13")).toThrow();
  });
});
