import { describe, expect, it } from "vitest";
import { ajusterSegment, ecartHorloge } from "./horloge";

const h = (heure: string) => new Date(`2026-11-09T${heure}+01:00`);
const serveur = h("10:00:00");

describe("segment en avance sur le serveur (§6.9)", () => {
  it("fin à serveur + 3 min → acceptée telle quelle", () => {
    const r = ajusterSegment({ debut: h("09:00:00"), fin: h("10:03:00") }, serveur);
    expect(r.fin).toEqual(h("10:03:00"));
    expect(r.finRamenee).toBe(false);
  });

  it("fin à serveur + 5 min pile → acceptée", () => {
    expect(ajusterSegment({ debut: h("09:00:00"), fin: h("10:05:00") }, serveur).finRamenee).toBe(false);
  });

  it("fin à serveur + 12 min → ramenée à l'heure du serveur (alerte)", () => {
    const r = ajusterSegment({ debut: h("09:00:00"), fin: h("10:12:00") }, serveur);
    expect(r.fin).toEqual(serveur);
    expect(r.finRamenee).toBe(true);
    expect(r.debutRamene).toBe(false);
  });

  it("début à serveur + 10 min → ramené à l'heure du serveur", () => {
    const r = ajusterSegment({ debut: h("10:10:00"), fin: null }, serveur);
    expect(r.debut).toEqual(serveur);
    expect(r.debutRamene).toBe(true);
  });
});

describe("écart d'horloge à l'envoi", () => {
  it("téléphone à 10:00, serveur à 10:20 → écart de 20 min signalé", () => {
    expect(ecartHorloge(h("10:00:00"), h("10:20:00"))).toEqual({ minutes: -20, signale: true });
  });

  it("bon signé hier, envoyé aujourd'hui à la bonne heure → pas d'écart", () => {
    // On compare l'heure du téléphone au moment de l'envoi, pas l'heure de signature.
    expect(ecartHorloge(h("10:00:30"), h("10:00:00")).signale).toBe(false);
  });

  it("téléphone en avance de 3 min → pas signalé", () => {
    expect(ecartHorloge(h("10:03:00"), h("10:00:00")).signale).toBe(false);
  });
});
