import { describe, expect, it } from "vitest";
import { affichageVignette, jourParis, trierInterventions, type StatutIntervention, type Priorite } from "../lib/regles";
import { construireDemo, UTILISATEURS_DEMO, type ContexteDemo, type LotDemo } from "./donnees-demo";

const contexte = (maintenant: string, entrepriseId = "e0000000-0000-0000-0000-000000000001"): ContexteDemo => ({
  entrepriseId,
  agenceId: "a0000000-0000-0000-0000-000000000001",
  utilisateurs: {
    karim: "00000000-0000-0000-0000-00000000000a",
    lucas: "00000000-0000-0000-0000-00000000000b",
    sophie: "00000000-0000-0000-0000-00000000000c",
    nadia: "00000000-0000-0000-0000-00000000000d",
  },
  reglages: {
    tauxHoraireCentimes: 6500,
    limiteZone1Km: 20,
    limiteZone2Km: 50,
    montantZone1Centimes: 5000,
    montantZone2Centimes: 8000,
    montantZone3Centimes: 12000,
    prefixeNumerotation: "BI",
  },
  maintenant: new Date(maintenant),
});

type Ligne = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const table = (lots: LotDemo[], nom: string): Ligne[] => lots.find((l) => l.table === nom)!.lignes;

// Mardi 10 novembre 2026, 10 h 30 à Paris.
const MAINTENANT = "2026-11-10T09:30:00Z";
const lots = construireDemo(contexte(MAINTENANT));

describe("données de démonstration (§11)", () => {
  it("4 utilisateurs : Karim et Sophie habilités, Nadia gestionnaire sans agence", () => {
    expect(UTILISATEURS_DEMO.map((u) => [u.nom, u.role, u.habilite, u.avecAgence])).toEqual([
      ["Karim B.", "technicien", true, true],
      ["Lucas M.", "technicien", false, true],
      ["Sophie R.", "chef_agence", true, true],
      ["Nadia G.", "gestionnaire", false, false],
    ]);
  });

  it("6 clients et leurs sites, aux distances du cahier des charges", () => {
    expect(table(lots, "client").map((c) => c.nom)).toEqual([
      "Carrière Ferrand",
      "Fromagerie des Causses",
      "Boulangerie Arnal",
      "Coopérative Saint-Clair",
      "Primeurs Dubois",
      "Pharmacie du Marché",
    ]);
    expect(table(lots, "site").map((s) => s.distance_km)).toEqual([18, 32, 4, 24, 3, 3]);
  });

  it("8 instruments INS-0421 à INS-0910, catalogue de 3 articles", () => {
    expect(table(lots, "instrument").map((i) => i.numero)).toEqual([
      "INS-0421", "INS-0518", "INS-0603", "INS-0711", "INS-0712", "INS-0802", "INS-0803", "INS-0910",
    ]);
    expect(table(lots, "article").map((a) => [a.code, a.prix_unitaire_ht_centimes])).toEqual([
      ["1", 450],
      ["2", 18500],
      ["3", 6200],
    ]);
  });

  it("uniquement des données fictives : marques, téléphones, emails", () => {
    for (const i of table(lots, "instrument")) expect(["Tarvex", "Balix"]).toContain(i.marque);
    for (const s of table(lots, "site")) {
      expect(s.contact_telephone).toMatch(/^06 00 00 00 0\d$/);
      expect(s.contact_email).toMatch(/@exemple\.fr$/);
    }
    for (const u of UTILISATEURS_DEMO) expect(u.email).toMatch(/@exemple\.fr$/);
    for (const b of table(lots, "bon")) expect(b.email_envoi).toMatch(/@exemple\.fr$/);
  });

  it("la vérification chez Primeurs Dubois porte sur INS-0802 ET INS-0803", () => {
    const intervention = table(lots, "intervention").find((i) => i.numero === "INT-1045")!;
    const numeros = table(lots, "intervention_instrument")
      .filter((l) => l.intervention_id === intervention.id)
      .map((l) => table(lots, "instrument").find((i) => i.id === l.instrument_id)!.numero);
    expect(numeros).toEqual(["INS-0802", "INS-0803"]);
  });

  it("les 9 interventions du prototype, dans l'ordre de la liste (§6.1)", () => {
    const triees = trierInterventions(
      table(lots, "intervention").map((i) => ({
        numero: i.numero as string,
        statut: i.statut as StatutIntervention,
        priorite: i.priorite as Priorite,
        recueLe: new Date(i.recue_le),
      })),
    );
    expect(triees.map((i) => `${i.numero} ${i.statut}`)).toEqual([
      "INT-1046 en_cours",
      "INT-1041 a_faire",
      "INT-1043 a_faire",
      "INT-1045 a_faire",
      "INT-1047 a_faire",
      "INT-1044 prise",
      "INT-1042 prise",
      "INT-1039 terminee",
      "INT-1037 facturee",
    ]);
  });

  it("« À faire » sans titulaire, les autres avec ; une seule intervention facturée, tracée", () => {
    for (const i of table(lots, "intervention")) {
      expect(i.titulaire_id === null).toBe(i.statut === "a_faire");
      expect(i.facturee_le !== null && i.facturee_par_id !== null).toBe(i.statut === "facturee");
    }
  });

  it("le chrono de INT-1046 tourne depuis 38 minutes ; les autres segments sont fermés", () => {
    const segments = table(lots, "segment_chrono");
    const ouverts = segments.filter((s) => s.fin === null);
    expect(ouverts).toHaveLength(1);
    expect(new Date(MAINTENANT).getTime() - new Date(ouverts[0].debut).getTime()).toBe(38 * 60_000);
    expect(segments).toHaveLength(3);
  });

  it("bons : montants calculés par les règles métier", () => {
    const [reparation, verification] = table(lots, "bon");
    // INT-1037 : 52 min → 1 h à 65 € + 32 km (80 €) + 1 bloc d'alimentation (62 €) = 207 €.
    expect(reparation.numero).toBe("BI-2026-0001");
    expect(reparation.minutes_chrono).toBe(52);
    expect(reparation.minutes_facturees_par_personne).toBe(60);
    expect(reparation.forfait_deplacement_applique_centimes).toBe(8000);
    expect(reparation.total_ht_centimes).toBe(20700);
    // INT-1039 : 3 h 05 → 3 h × 2 personnes à 65 € (390 €) + 18 km (50 €) = 440 €.
    expect(verification.numero).toBe("BI-2026-0002");
    expect(verification.minutes_chrono).toBe(185);
    expect(verification.minutes_facturees_par_personne).toBe(180);
    expect(verification.nombre_personnes).toBe(2);
    expect(verification.total_ht_centimes).toBe(44000);
  });

  it("bon de vérification : conforme, échéance au même mois + 1 an, reportée sur l'instrument", () => {
    const pont = table(lots, "instrument").find((i) => i.numero === "INS-0421")!;
    const section = table(lots, "bon_instrument").find((b) => b.instrument_id === pont.id)!;
    expect(section.resultat_verification).toBe("conforme");
    expect(section.nouvelle_echeance).toBe("2027-11");
    expect(pont.echeance_verification).toBe("2027-11");
    // La réparation n'a pas touché la chaîne de mesure.
    const autre = table(lots, "bon_instrument").find((b) => b.instrument_id !== pont.id)!;
    expect(autre.chaine_mesure_touchee).toBe(false);
    expect(autre.resultat_verification).toBeNull();
  });

  it("le journal cite le numéro du bon", () => {
    expect(table(lots, "journal").map((j) => j.texte)).toContain("Bon BI-2026-0002 signé");
  });

  it("aucune date dans le futur, même si le script est lancé tôt le matin", () => {
    const tot = construireDemo(contexte("2026-11-10T04:00:00Z")); // 5 h à Paris
    const limite = new Date("2026-11-10T04:00:00Z").getTime();
    for (const lot of tot) {
      for (const ligne of lot.lignes) {
        for (const [colonne, valeur] of Object.entries(ligne)) {
          if (typeof valeur === "string" && /^\d{4}-\d\d-\d\dT/.test(valeur)) {
            expect(new Date(valeur).getTime(), `${lot.table}.${colonne}`).toBeLessThanOrEqual(limite);
          }
        }
      }
    }
  });
});

describe("vignettes de la démonstration, quel que soit le jour du lancement", () => {
  const jours = ["2026-11-10T09:30:00Z", "2026-11-30T09:30:00Z", "2026-12-31T22:59:00Z", "2027-01-01T09:30:00Z", "2027-02-28T09:30:00Z", "2027-03-16T09:30:00Z"];
  it.each(jours)("lancé le %s", (maintenant) => {
    const aujourdhui = jourParis(new Date(maintenant));
    const couleurs = Object.fromEntries(
      table(construireDemo(contexte(maintenant)), "instrument").map((i) => [
        i.numero,
        affichageVignette(i.statut_metrologie, i.echeance_verification, aujourdhui),
      ]),
    );
    expect(couleurs["INS-0421"].couleur).toBe("vert");
    expect(couleurs["INS-0603"].couleur).toBe("vert");
    for (const bientot of ["INS-0518", "INS-0711", "INS-0802", "INS-0803"]) {
      expect(couleurs[bientot].couleur, bientot).toBe("orange");
    }
    expect(couleurs["INS-0712"].libelle).toContain("À vérifier");
    expect(couleurs["INS-0910"].libelle).toContain("Vignette périmée");
  });
});

describe("relance du script", () => {
  it("mêmes identifiants à chaque lancement (pas de doublon), différents d'une entreprise à l'autre", () => {
    const ids = (l: LotDemo[]) => l.flatMap((lot) => lot.lignes.map((ligne) => ligne.id)).filter(Boolean);
    const plusTard = construireDemo(contexte("2026-12-24T15:00:00Z"));
    expect(ids(plusTard)).toEqual(ids(lots));
    const autreEntreprise = construireDemo(contexte(MAINTENANT, "e0000000-0000-0000-0000-000000000002"));
    expect(ids(autreEntreprise).filter((id) => ids(lots).includes(id))).toEqual([]);
    expect(new Set(ids(lots)).size).toBe(ids(lots).length);
  });
});
