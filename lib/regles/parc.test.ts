import { describe, expect, it } from "vitest";
import { controlerClient, controlerSite } from "./parc";
import { ongletsPour, peutGererParc } from "./roles";

describe("saisie d'un client", () => {
  it("accepte un nom, nettoie les espaces, note facultative", () => {
    expect(controlerClient({ nom: "  Primeurs   Dubois ", note: "" })).toEqual({
      ok: true,
      valeurs: { nom: "Primeurs Dubois", critique: false, note: null },
    });
  });

  it("case « critique » cochée", () => {
    const c = controlerClient({ nom: "Carrière Ferrand", critique: "on", note: "Un seul pont-bascule" });
    expect(c).toEqual({ ok: true, valeurs: { nom: "Carrière Ferrand", critique: true, note: "Un seul pont-bascule" } });
  });

  it("refuse un nom vide ou fait seulement d'espaces", () => {
    for (const nom of [undefined, "", "   "]) {
      const c = controlerClient({ nom });
      expect(c.ok).toBe(false);
      if (!c.ok) expect(c.erreurs.nom).toBe("Le nom du client est obligatoire.");
    }
  });

  it("refuse un nom ou une note trop longs", () => {
    const c = controlerClient({ nom: "x".repeat(121), note: "y".repeat(501) });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(Object.keys(c.erreurs).sort()).toEqual(["nom", "note"]);
  });
});

describe("saisie d'un site", () => {
  const complet = {
    nom: "Halle du marché",
    adresse: "Place du Marché, Villeneuve",
    contact_nom: "M. Dubois",
    contact_fonction: "",
    contact_telephone: "06 00 00 00 05",
    contact_email: " Primeurs.Dubois@Exemple.fr ",
    distance_km: "3",
  };

  it("accepte un site complet ; l'email est mis en minuscules, les champs vides deviennent absents", () => {
    expect(controlerSite(complet)).toEqual({
      ok: true,
      valeurs: {
        nom: "Halle du marché",
        adresse: "Place du Marché, Villeneuve",
        contact_nom: "M. Dubois",
        contact_fonction: null,
        contact_telephone: "06 00 00 00 05",
        contact_email: "primeurs.dubois@exemple.fr",
        distance_km: 3,
      },
    });
  });

  it("le nom et la distance suffisent ; 0 km est accepté", () => {
    const c = controlerSite({ nom: "Dépôt", distance_km: "0" });
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.valeurs.distance_km).toBe(0);
  });

  it("distance : kilomètres entiers uniquement (§6.4)", () => {
    for (const distance_km of ["18,5", "18.5", "-3", "dix", "18 km", ""]) {
      const c = controlerSite({ nom: "Dépôt", distance_km });
      expect(c.ok, distance_km).toBe(false);
      if (!c.ok) expect(c.erreurs.distance_km).toBeDefined();
    }
    expect(controlerSite({ nom: "Dépôt", distance_km: "2001" }).ok).toBe(false);
    expect(controlerSite({ nom: "Dépôt", distance_km: " 21 " }).ok).toBe(true);
  });

  it("refuse un email mal écrit, sans bloquer les autres champs", () => {
    for (const contact_email of ["dubois", "dubois@", "dubois@exemple", "a b@exemple.fr"]) {
      const c = controlerSite({ ...complet, contact_email });
      expect(c.ok, contact_email).toBe(false);
      if (!c.ok) expect(Object.keys(c.erreurs)).toEqual(["contact_email"]);
    }
  });

  it("signale toutes les erreurs d'un coup", () => {
    const c = controlerSite({ nom: "", distance_km: "abc", contact_email: "x" });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(Object.keys(c.erreurs).sort()).toEqual(["contact_email", "distance_km", "nom"]);
  });
});

describe("rôles (§4 et §7)", () => {
  it("seuls le chef d'agence et l'administrateur gèrent clients, sites et instruments", () => {
    expect(peutGererParc("chef_agence")).toBe(true);
    expect(peutGererParc("administrateur")).toBe(true);
    expect(peutGererParc("technicien")).toBe(false);
    expect(peutGererParc("gestionnaire")).toBe(false);
  });

  it("onglets : le gestionnaire n'a pas le Parc", () => {
    expect(ongletsPour("technicien")).toEqual(["interventions", "parc", "reglages"]);
    expect(ongletsPour("chef_agence")).toEqual(["interventions", "parc", "reglages"]);
    expect(ongletsPour("administrateur")).toEqual(["interventions", "parc", "reglages"]);
    expect(ongletsPour("gestionnaire")).toEqual(["interventions", "reglages"]);
  });
});
