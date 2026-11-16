import { describe, expect, it } from "vitest";
import { lireCsv } from "../csv";
import { controlerImportInstruments, lireEcheanceImport, type ClientConnu } from "./import-instruments";

const AUJOURDHUI = "2026-11-16";

/** Parc fictif (§11) : Primeurs Dubois a un seul site, Carrière Ferrand en a deux. */
const PARC: ClientConnu[] = [
  {
    id: "c-dubois",
    nom: "Primeurs Dubois",
    sites: [{ id: "s-dubois", nom: "Magasin", instruments: [{ numero: "INS-0802", numeroSerie: "BX-40118" }] }],
  },
  {
    id: "c-ferrand",
    nom: "Carrière Ferrand",
    sites: [
      { id: "s-ferrand-1", nom: "Carrière nord", instruments: [{ numero: "INS-0421", numeroSerie: "TX-77120" }] },
      { id: "s-ferrand-2", nom: "Dépôt", instruments: [] },
    ],
  },
  { id: "c-arnal", nom: "Boulangerie Arnal", sites: [] },
];

const TITRES = "client;site;type;marque;modele;numero_serie;portee;echelon;millesime;emplacement;vignette;echeance";

function importer(...lignes: string[]) {
  const lecture = lireCsv([TITRES, ...lignes].join("\n"));
  if (!lecture.ok) throw new Error(lecture.erreur);
  return controlerImportInstruments(lecture.lignes, PARC, AUJOURDHUI);
}

describe("import d'instruments : fichier correct", () => {
  it("prépare chaque ligne comme le ferait le formulaire, sur le bon site", () => {
    const { rapport, aEnregistrer } = importer(
      "Primeurs Dubois;;Balance poids-prix;Balix;C15;BX-50001;15 kg;5 g;2023;Étal fruits;verte;11/2027",
      "carriere ferrand;DEPOT;Pont-bascule;Tarvex;PB50;TX-70002;50 t;20 kg;;;à vérifier;",
    );
    expect(rapport.erreur).toBeNull();
    expect(rapport.nombreErreurs).toBe(0);
    expect(aEnregistrer).toEqual([
      {
        site_id: "s-dubois",
        type: "Balance poids-prix",
        marque: "Balix",
        modele: "C15",
        numero_serie: "BX-50001",
        portee_max: "15 kg",
        echelon: "5 g",
        millesime: 2023,
        emplacement: "Étal fruits",
        statut_metrologie: "verte",
        echeance_verification: "2027-11",
        motif_statut: null,
      },
      {
        site_id: "s-ferrand-2",
        type: "Pont-bascule",
        marque: "Tarvex",
        modele: "PB50",
        numero_serie: "TX-70002",
        portee_max: "50 t",
        echelon: "20 kg",
        millesime: null,
        emplacement: null,
        statut_metrologie: "a_verifier",
        echeance_verification: null,
        motif_statut: null,
      },
    ]);
    // Le rapport reprend le nom exact du client et du site, pas celui tapé dans le fichier.
    expect(rapport.lignes[1]).toMatchObject({ ligne: 3, client: "Carrière Ferrand", site: "Dépôt", statut: "a_verifier" });
  });

  it("accepte d'autres noms de colonnes, dans un autre ordre, et signale les colonnes inconnues", () => {
    const lecture = lireCsv(
      "N° de série;Client;Type;Marque;Modèle;Portée (Max);Échelon (e);Couleur\nBX-50002;Primeurs Dubois;Balance;Balix;C15;15 kg;5 g;grise",
    );
    const { rapport, aEnregistrer } = controlerImportInstruments(lecture.ok ? lecture.lignes : [], PARC, AUJOURDHUI);
    expect(rapport.colonnesIgnorees).toEqual(["Couleur"]);
    expect(aEnregistrer).toHaveLength(1);
    expect(aEnregistrer[0]).toMatchObject({ numero_serie: "BX-50002", portee_max: "15 kg", site_id: "s-dubois" });
  });

  it("sans vignette : une échéance veut dire « verte », rien du tout veut dire « À vérifier »", () => {
    const { aEnregistrer } = importer(
      "Primeurs Dubois;;Balance;Balix;C15;BX-1;15 kg;5 g;;;;03/2027",
      "Primeurs Dubois;;Balance;Balix;C15;BX-2;15 kg;5 g;;;;",
    );
    expect(aEnregistrer.map((i) => [i.statut_metrologie, i.echeance_verification])).toEqual([
      ["verte", "2027-03"],
      ["a_verifier", null],
    ]);
  });

  it("une vignette rouge n'a pas d'échéance, même si le fichier en donne une", () => {
    const { aEnregistrer } = importer("Primeurs Dubois;;Balance;Balix;C15;BX-3;15 kg;5 g;;;rouge;11/2027");
    expect(aEnregistrer[0]).toMatchObject({ statut_metrologie: "rouge", echeance_verification: null });
  });

  it("une vignette verte déjà périmée s'enregistre telle quelle (elle s'affichera en rouge)", () => {
    const { aEnregistrer } = importer("Primeurs Dubois;;Balance;Balix;C15;BX-4;15 kg;5 g;;;verte;06/2026");
    expect(aEnregistrer[0].echeance_verification).toBe("2026-06");
  });
});

describe("import d'instruments : tout ou rien", () => {
  it("une seule ligne en erreur : rien n'est à enregistrer, et chaque erreur dit sa ligne", () => {
    const { rapport, aEnregistrer } = importer(
      "Primeurs Dubois;;Balance;Balix;C15;BX-10;15 kg;5 g;;;verte;11/2027",
      "Primeurs Dubois;;Balance;;C15;;15 kg;5 g;20;;verte;11/2027",
    );
    expect(aEnregistrer).toEqual([]);
    expect(rapport.nombreErreurs).toBe(1);
    expect(rapport.lignes[0].erreurs).toEqual([]);
    expect(rapport.lignes[1].ligne).toBe(3);
    expect(rapport.lignes[1].erreurs).toEqual([
      "Marque : La marque est obligatoire.",
      "N° de série : Le n° de série est obligatoire.",
      "Millésime : Le millésime est une année sur 4 chiffres, entre 1900 et 2027.",
    ]);
  });

  it("client inconnu, client sans site, site à préciser, site inconnu", () => {
    const { rapport } = importer(
      "Primeur Dubois;;Balance;Balix;C15;BX-11;15 kg;5 g;;;;",
      "Boulangerie Arnal;;Balance;Balix;C15;BX-12;15 kg;5 g;;;;",
      "Carrière Ferrand;;Balance;Balix;C15;BX-13;15 kg;5 g;;;;",
      "Carrière Ferrand;Bureau;Balance;Balix;C15;BX-14;15 kg;5 g;;;;",
      ";;Balance;Balix;C15;BX-15;15 kg;5 g;;;;",
    );
    expect(rapport.lignes.map((l) => l.erreurs[0])).toEqual([
      "Client « Primeur Dubois » introuvable dans le parc. Créez-le d'abord, ou corrigez son nom dans le fichier.",
      "Le client « Boulangerie Arnal » n'a encore aucun site. Créez son site d'abord.",
      "Le client « Carrière Ferrand » a plusieurs sites : indiquez le site (Carrière nord, Dépôt).",
      "Site « Bureau » introuvable chez « Carrière Ferrand » (sites connus : Carrière nord, Dépôt).",
      "Le client est obligatoire.",
    ]);
  });

  it("vignette ou échéance non comprise, vignette verte sans échéance, échéance trop lointaine", () => {
    const { rapport } = importer(
      "Primeurs Dubois;;Balance;Balix;C15;BX-20;15 kg;5 g;;;orange;",
      "Primeurs Dubois;;Balance;Balix;C15;BX-21;15 kg;5 g;;;verte;bientôt",
      "Primeurs Dubois;;Balance;Balix;C15;BX-22;15 kg;5 g;;;verte;",
      "Primeurs Dubois;;Balance;Balix;C15;BX-23;15 kg;5 g;;;verte;12/2028",
    );
    expect(rapport.lignes.map((l) => l.erreurs)).toEqual([
      ["Vignette « orange » non comprise : écrivez verte, rouge ou à vérifier."],
      ["Échéance « bientôt » non comprise : écrivez le mois et l'année (exemple : 11/2027)."],
      ["Échéance : une vignette verte a toujours une échéance (mois/année, exemple : 11/2027)."],
      ["Échéance : Cette échéance est trop ancienne ou trop lointaine (2 ans au plus dans chaque sens)."],
    ]);
  });

  it("colonne obligatoire manquante : le fichier entier est refusé", () => {
    const lecture = lireCsv("client;type;marque\nPrimeurs Dubois;Balance;Balix");
    const { rapport, aEnregistrer } = controlerImportInstruments(lecture.ok ? lecture.lignes : [], PARC, AUJOURDHUI);
    expect(rapport.erreur).toContain("Colonnes manquantes : modele, numero_serie, portee, echelon");
    expect(aEnregistrer).toEqual([]);
  });

  it("fichier vide, titres seuls, ou trop de lignes", () => {
    expect(controlerImportInstruments([], PARC, AUJOURDHUI).rapport.erreur).toBe("Le fichier est vide.");
    expect(importer().rapport.erreur).toContain("aucun instrument à importer");
    const trop = Array.from({ length: 501 }, (_, i) => `Primeurs Dubois;;Balance;Balix;C15;BX-T${i};15 kg;5 g;;;;`);
    expect(importer(...trop).rapport.erreur).toContain("501 instruments");
  });
});

describe("import d'instruments : n° de série déjà connus", () => {
  it("même n° de série sur le même site : erreur (fichier sans doute importé deux fois)", () => {
    const { rapport, aEnregistrer } = importer("Primeurs Dubois;;Balance;Balix;C15;bx-40118;15 kg;5 g;;;;");
    expect(rapport.lignes[0].erreurs).toEqual([
      "N° de série bx-40118 : déjà dans le parc de ce site (INS-0802). Retirez cette ligne du fichier.",
    ]);
    expect(aEnregistrer).toEqual([]);
  });

  it("deux fois dans le fichier pour le même site : erreur sur la seconde ligne", () => {
    const { rapport } = importer(
      "Primeurs Dubois;;Balance;Balix;C15;BX-30;15 kg;5 g;;;;",
      "Primeurs Dubois;;Balance;Balix;C15;BX-30;15 kg;5 g;;;;",
    );
    expect(rapport.lignes[0].erreurs).toEqual([]);
    expect(rapport.lignes[1].erreurs).toEqual(["N° de série BX-30 : déjà présent ligne 2 du fichier, pour le même site."]);
  });

  it("même n° de série sur un AUTRE site : simple avertissement, l'instrument reste à enregistrer", () => {
    const { rapport, aEnregistrer } = importer(
      "Carrière Ferrand;Dépôt;Balance;Balix;C15;BX-40118;15 kg;5 g;;;;",
      "Primeurs Dubois;;Balance;Balix;C15;BX-31;15 kg;5 g;;;;",
      "Carrière Ferrand;Dépôt;Balance;Balix;C15;BX-31;15 kg;5 g;;;;",
    );
    expect(rapport.nombreErreurs).toBe(0);
    expect(rapport.nombreAvertissements).toBe(2);
    expect(rapport.lignes[0].avertissements[0]).toContain("INS-0802 (Primeurs Dubois)");
    expect(rapport.lignes[2].avertissements[0]).toContain("la ligne 3 du fichier");
    expect(aEnregistrer).toHaveLength(3);
  });
});

describe("échéance écrite dans un tableur", () => {
  it("comprend les écritures courantes, y compris celles qu'Excel fabrique", () => {
    const attendu = { mois: 11, annee: 2027 };
    for (const texte of ["11/2027", "11-2027", "2027-11", "01/11/2027", "2027-11-01", "nov-27", "nov.-27", "Novembre 2027"]) {
      expect(lireEcheanceImport(texte), texte).toEqual(attendu);
    }
    expect(lireEcheanceImport("3/2027")).toEqual({ mois: 3, annee: 2027 });
    expect(lireEcheanceImport("juin 2027")).toEqual({ mois: 6, annee: 2027 });
    expect(lireEcheanceImport("juil-27")).toEqual({ mois: 7, annee: 2027 });
    expect(lireEcheanceImport("févr-27")).toEqual({ mois: 2, annee: 2027 });
    expect(lireEcheanceImport("août 2027")).toEqual({ mois: 8, annee: 2027 });
  });

  it("refuse ce qui n'est pas un mois et une année", () => {
    for (const texte of ["", "2027", "13/2027", "0/2027", "bientôt", "11/27/2027"]) {
      expect(lireEcheanceImport(texte), texte).toBeNull();
    }
  });
});
