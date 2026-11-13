import { describe, expect, it } from "vitest";
import {
  anneesDesLimites,
  controlerClient,
  controlerFicheInstrument,
  controlerNouvelInstrument,
  controlerSite,
  limitesEcheanceEnregistrement,
  moisDansLimites,
} from "./parc";
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

describe("saisie d'un instrument", () => {
  const AUJOURDHUI = "2026-11-13";
  const fiche = {
    type: "Balance poids-prix",
    marque: "Balix",
    modele: "C15",
    numero_serie: "BX-40120",
    portee_max: "15 kg",
    echelon: "5 g",
    millesime: "2019",
    emplacement: "Étal fromages",
  };

  it("fiche complète acceptée ; millésime et emplacement facultatifs", () => {
    expect(controlerFicheInstrument(fiche, AUJOURDHUI)).toEqual({
      ok: true,
      valeurs: { ...fiche, millesime: 2019 },
    });
    const sans = controlerFicheInstrument({ ...fiche, millesime: "", emplacement: " " }, AUJOURDHUI);
    expect(sans.ok).toBe(true);
    if (sans.ok) expect([sans.valeurs.millesime, sans.valeurs.emplacement]).toEqual([null, null]);
  });

  it("type, marque, modèle, n° de série, portée et échelon sont obligatoires (décision du 12/11/2026)", () => {
    const c = controlerFicheInstrument({ millesime: "2019" }, AUJOURDHUI);
    expect(c.ok).toBe(false);
    if (!c.ok) {
      expect(Object.keys(c.erreurs).sort()).toEqual(["echelon", "marque", "modele", "numero_serie", "portee_max", "type"]);
      expect(c.erreurs.numero_serie).toBe("Le n° de série est obligatoire.");
    }
  });

  it("millésime : une année plausible", () => {
    for (const millesime of ["19", "1899", "2028", "deux mille", "2019.5"]) {
      expect(controlerFicheInstrument({ ...fiche, millesime }, AUJOURDHUI).ok, millesime).toBe(false);
    }
    expect(controlerFicheInstrument({ ...fiche, millesime: "2027" }, AUJOURDHUI).ok).toBe(true);
  });

  it("création avec une vignette verte : échéance choisie dans deux listes", () => {
    const c = controlerNouvelInstrument(
      { ...fiche, statut_metrologie: "verte", echeance_mois: "5", echeance_annee: "2027", motif_statut: "ignoré" },
      AUJOURDHUI,
    );
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.valeurs.statut_metrologie).toBe("verte");
      expect(c.valeurs.echeance_verification).toBe("2027-05");
      expect(c.valeurs.motif_statut).toBeNull();
    }
  });

  it("vignette verte sans échéance : refusée", () => {
    const c = controlerNouvelInstrument({ ...fiche, statut_metrologie: "verte", echeance_annee: "2027" }, AUJOURDHUI);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(Object.keys(c.erreurs)).toEqual(["echeance"]);
  });

  it("une vignette périmée s'enregistre telle qu'elle est (elle s'affichera en rouge)", () => {
    const c = controlerNouvelInstrument(
      { ...fiche, statut_metrologie: "verte", echeance_mois: "10", echeance_annee: "2026" },
      AUJOURDHUI,
    );
    expect(c.ok).toBe(true);
  });

  it("échéance limitée à 2 ans dans chaque sens", () => {
    const limites = limitesEcheanceEnregistrement(AUJOURDHUI);
    expect(limites).toEqual({ min: "2024-11", max: "2028-11" });
    expect(anneesDesLimites(limites)).toEqual([2024, 2025, 2026, 2027, 2028]);
    expect(moisDansLimites("2024-11", limites)).toBe(true);
    expect(moisDansLimites("2028-11", limites)).toBe(true);
    expect(moisDansLimites("2024-10", limites)).toBe(false);
    expect(moisDansLimites("2028-12", limites)).toBe(false);
    for (const [echeance_mois, echeance_annee] of [["12", "2028"], ["10", "2024"], ["13", "2027"], ["0", "2027"]]) {
      const c = controlerNouvelInstrument({ ...fiche, statut_metrologie: "verte", echeance_mois, echeance_annee }, AUJOURDHUI);
      expect(c.ok, `${echeance_mois}/${echeance_annee}`).toBe(false);
    }
  });

  it("« À vérifier » ou vignette rouge : pas d'échéance, motif facultatif", () => {
    const c = controlerNouvelInstrument(
      { ...fiche, statut_metrologie: "a_verifier", echeance_mois: "5", echeance_annee: "2027", motif_statut: "Vérification primitive à réaliser" },
      AUJOURDHUI,
    );
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.valeurs.echeance_verification).toBeNull();
      expect(c.valeurs.motif_statut).toBe("Vérification primitive à réaliser");
    }
    expect(controlerNouvelInstrument({ ...fiche, statut_metrologie: "rouge" }, AUJOURDHUI).ok).toBe(true);
  });

  it("la vignette doit être indiquée", () => {
    for (const statut_metrologie of [undefined, "", "inconnu"]) {
      const c = controlerNouvelInstrument({ ...fiche, statut_metrologie }, AUJOURDHUI);
      expect(c.ok).toBe(false);
      if (!c.ok) expect(c.erreurs.statut_metrologie).toBeDefined();
    }
  });
});
