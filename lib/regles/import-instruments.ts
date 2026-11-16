/**
 * Import d'instruments depuis un fichier CSV (phase 2, bloc 1).
 * Fonction pure : elle contrôle TOUTES les lignes et dit quoi enregistrer, sans rien enregistrer.
 * Chaque ligne passe par le même contrôle que le formulaire « Nouvel instrument »
 * (controlerNouvelInstrument) : un instrument importé obéit aux mêmes règles qu'un instrument saisi.
 *
 * Principes :
 *   - tout ou rien : s'il reste une seule ligne en erreur, rien n'est à enregistrer ;
 *   - le client et le site doivent déjà exister (l'import ne crée ni client ni site, pour qu'une
 *     faute de frappe ne fabrique pas un faux client) ;
 *   - un n° de série déjà présent SUR LE MÊME SITE est une erreur (fichier importé deux fois) ;
 *     ailleurs, c'est un simple avertissement : l'instrument est créé et la base crée l'alerte
 *     « instrument en double possible » (§6.9).
 */

import type { LigneCsv } from "../csv.ts";
import type { JourCalendaire, MoisCalendaire } from "./dates.ts";
import type { StatutMetrologie } from "./metrologie.ts";
import {
  controlerNouvelInstrument,
  simplifierTexte,
  type Saisie,
  type ValeursFicheInstrument,
  type ValeursMetrologieInstrument,
} from "./parc.ts";

/** Nombre maximal d'instruments dans un fichier (au-delà : découper le fichier). */
export const LIGNES_MAX_IMPORT = 500;

/** Ce que l'import a besoin de connaître du parc existant. */
export interface ClientConnu {
  id: string;
  nom: string;
  sites: { id: string; nom: string; instruments: { numero: string; numeroSerie: string }[] }[];
}

export type InstrumentAImporter = ValeursFicheInstrument & ValeursMetrologieInstrument & { site_id: string };

export interface LigneImport {
  /** Numéro de la ligne dans le fichier. */
  ligne: number;
  client: string;
  site: string;
  /** Résumé lisible : « Balance poids-prix Balix C15 · n° BX-50001 ». */
  description: string;
  statut: StatutMetrologie | null;
  echeance: MoisCalendaire | null;
  /** Bloquant : tant qu'il en reste une, rien n'est enregistré. */
  erreurs: string[];
  /** Non bloquant : à lire avant d'enregistrer. */
  avertissements: string[];
}

export interface RapportImport {
  /** Problème qui empêche de lire le fichier (colonne manquante, fichier vide…). */
  erreur: string | null;
  /** Colonnes du fichier que l'import ne connaît pas (elles ne sont pas lues). */
  colonnesIgnorees: string[];
  lignes: LigneImport[];
  nombreErreurs: number;
  nombreAvertissements: number;
}

/** Les colonnes reconnues : leur nom dans le modèle, et les autres façons de les écrire. */
const COLONNES: { champ: string; titre: string; obligatoire: boolean; noms: string[] }[] = [
  { champ: "client", titre: "client", obligatoire: true, noms: ["client", "nom client", "nom du client"] },
  { champ: "site", titre: "site", obligatoire: false, noms: ["site", "nom site", "nom du site"] },
  { champ: "type", titre: "type", obligatoire: true, noms: ["type", "type instrument", "type d instrument"] },
  { champ: "marque", titre: "marque", obligatoire: true, noms: ["marque"] },
  { champ: "modele", titre: "modele", obligatoire: true, noms: ["modele"] },
  {
    champ: "numero_serie",
    titre: "numero_serie",
    obligatoire: true,
    noms: ["numero serie", "numero de serie", "n serie", "n de serie", "no serie", "no de serie", "serie"],
  },
  { champ: "portee_max", titre: "portee", obligatoire: true, noms: ["portee", "portee max", "max"] },
  { champ: "echelon", titre: "echelon", obligatoire: true, noms: ["echelon", "echelon e", "e"] },
  { champ: "millesime", titre: "millesime", obligatoire: false, noms: ["millesime"] },
  { champ: "emplacement", titre: "emplacement", obligatoire: false, noms: ["emplacement"] },
  { champ: "vignette", titre: "vignette", obligatoire: false, noms: ["vignette", "statut", "statut metrologie"] },
  { champ: "echeance", titre: "echeance", obligatoire: false, noms: ["echeance", "echeance verification", "echeance vignette"] },
  { champ: "motif_statut", titre: "motif", obligatoire: false, noms: ["motif", "motif statut"] },
];

/** L'ordre des colonnes du fichier modèle (pour l'écran d'aide et le fichier à télécharger). */
export const COLONNES_IMPORT = COLONNES.map(({ titre, obligatoire }) => ({ titre, obligatoire }));

const LIBELLES_CHAMP: Record<string, string> = {
  type: "Type",
  marque: "Marque",
  modele: "Modèle",
  numero_serie: "N° de série",
  portee_max: "Portée",
  echelon: "Échelon",
  millesime: "Millésime",
  emplacement: "Emplacement",
  statut_metrologie: "Vignette",
  echeance: "Échéance",
  motif_statut: "Motif",
};

/** Nom comparable : sans accents ni majuscules, ponctuation et espaces en trop retirés. */
const cle = (valeur: string) =>
  simplifierTexte(valeur)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const VIGNETTES: Record<string, StatutMetrologie> = {
  verte: "verte",
  vert: "verte",
  "vignette verte": "verte",
  rouge: "rouge",
  "vignette rouge": "rouge",
  refuse: "rouge",
  "a verifier": "a_verifier",
};

const MOIS_EN_LETTRES = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];

/**
 * Lit une échéance écrite dans un tableur : « 11/2027 », « 2027-11 », mais aussi ce qu'Excel en
 * fait quand il la prend pour une date (« 01/11/2027 », « nov-27 », « nov.-27 »).
 * Renvoie le mois (1 à 12) et l'année, ou `null` si le texte n'est pas compris.
 */
export function lireEcheanceImport(valeur: string): { mois: number; annee: number } | null {
  const v = simplifierTexte(valeur).trim();
  const annee = (a: string) => (a.length === 2 ? 2000 + Number(a) : Number(a));
  let m: RegExpMatchArray | null;
  let lu: { mois: number; annee: number } | null = null;

  if ((m = v.match(/^(\d{1,2})[/.-](\d{4})$/))) lu = { mois: Number(m[1]), annee: Number(m[2]) };
  else if ((m = v.match(/^(\d{4})[/.-](\d{1,2})$/))) lu = { mois: Number(m[2]), annee: Number(m[1]) };
  else if ((m = v.match(/^\d{1,2}[/.-](\d{1,2})[/.-](\d{4})$/))) lu = { mois: Number(m[1]), annee: Number(m[2]) };
  else if ((m = v.match(/^(\d{4})-(\d{1,2})-\d{1,2}$/))) lu = { mois: Number(m[2]), annee: Number(m[1]) };
  else if ((m = v.match(/^([a-z]+)\.?[\s/.-]+(\d{2}|\d{4})$/))) {
    const lettres = m[1];
    // « juin » et « juil » ne se distinguent qu'à la 4e lettre ; les autres mois à la 3e.
    const rang = MOIS_EN_LETTRES.findIndex((nom) => lettres.startsWith(nom.slice(0, nom.startsWith("jui") ? 4 : 3)));
    if (rang >= 0) lu = { mois: rang + 1, annee: annee(m[2]) };
  }
  return lu && lu.mois >= 1 && lu.mois <= 12 ? lu : null;
}

/** Associe chaque colonne du fichier à un champ connu. */
function lireEntetes(entetes: string[]): { positions: Map<string, number>; ignorees: string[]; erreur: string | null } {
  const positions = new Map<string, number>();
  const ignorees: string[] = [];
  const enDouble: string[] = [];
  entetes.forEach((entete, position) => {
    const colonne = COLONNES.find((c) => c.noms.includes(cle(entete)));
    if (!colonne) {
      if (entete !== "") ignorees.push(entete);
    } else if (positions.has(colonne.champ)) {
      enDouble.push(colonne.titre);
    } else {
      positions.set(colonne.champ, position);
    }
  });

  const manquantes = COLONNES.filter((c) => c.obligatoire && !positions.has(c.champ)).map((c) => c.titre);
  let erreur: string | null = null;
  if (manquantes.length > 0) {
    erreur =
      `La première ligne du fichier doit donner le nom des colonnes. ` +
      `Colonne${manquantes.length > 1 ? "s" : ""} manquante${manquantes.length > 1 ? "s" : ""} : ${manquantes.join(", ")}. ` +
      `Partez du fichier modèle.`;
  } else if (enDouble.length > 0) {
    erreur = `Une colonne est présente deux fois dans le fichier : ${enDouble.join(", ")}.`;
  }
  return { positions, ignorees, erreur };
}

type SiteTrouve = { id: string; nom: string; client: string; instruments: { numero: string; numeroSerie: string }[] };

/** Retrouve le site d'une ligne d'après le nom du client et, s'il en a plusieurs, le nom du site. */
function trouverSite(client: string, site: string, clients: ClientConnu[]): { site: SiteTrouve } | { erreur: string } {
  if (client === "") return { erreur: "Le client est obligatoire." };
  const homonymes = clients.filter((c) => cle(c.nom) === cle(client));
  if (homonymes.length === 0) {
    return { erreur: `Client « ${client} » introuvable dans le parc. Créez-le d'abord, ou corrigez son nom dans le fichier.` };
  }
  if (homonymes.length > 1) {
    return { erreur: `Plusieurs clients s'appellent « ${client} » : ajoutez ces instruments à la main, depuis la fiche du bon client.` };
  }
  const trouve = homonymes[0];
  const avecClient = (s: ClientConnu["sites"][number]) => ({ site: { ...s, client: trouve.nom } });

  if (trouve.sites.length === 0) return { erreur: `Le client « ${trouve.nom} » n'a encore aucun site. Créez son site d'abord.` };
  const noms = trouve.sites.map((s) => s.nom).join(", ");
  if (site === "") {
    if (trouve.sites.length === 1) return avecClient(trouve.sites[0]);
    return { erreur: `Le client « ${trouve.nom} » a plusieurs sites : indiquez le site (${noms}).` };
  }
  const sites = trouve.sites.filter((s) => cle(s.nom) === cle(site));
  if (sites.length === 1) return avecClient(sites[0]);
  if (sites.length > 1) return { erreur: `Plusieurs sites de « ${trouve.nom} » s'appellent « ${site} ».` };
  return { erreur: `Site « ${site} » introuvable chez « ${trouve.nom} » (sites connus : ${noms}).` };
}

/**
 * Contrôle un fichier d'instruments. `lignes` : le fichier lu par lireCsv, ligne de titres comprise.
 * `aEnregistrer` reste vide tant qu'il y a une erreur quelque part.
 */
export function controlerImportInstruments(
  lignes: LigneCsv[],
  clients: ClientConnu[],
  aujourdhui: JourCalendaire,
): { rapport: RapportImport; aEnregistrer: InstrumentAImporter[] } {
  const echec = (erreur: string, colonnesIgnorees: string[] = []) => ({
    rapport: { erreur, colonnesIgnorees, lignes: [], nombreErreurs: 0, nombreAvertissements: 0 },
    aEnregistrer: [],
  });

  if (lignes.length === 0) return echec("Le fichier est vide.");
  const { positions, ignorees, erreur } = lireEntetes(lignes[0].cellules);
  if (erreur) return echec(erreur, ignorees);
  const donnees = lignes.slice(1);
  if (donnees.length === 0) return echec("Le fichier ne contient que la ligne de titres : aucun instrument à importer.", ignorees);
  if (donnees.length > LIGNES_MAX_IMPORT) {
    return echec(
      `Le fichier contient ${donnees.length} instruments : c'est trop pour un seul envoi. ` +
        `Découpez-le en fichiers de ${LIGNES_MAX_IMPORT} lignes au plus.`,
      ignorees,
    );
  }

  /** Lignes du fichier déjà vues, par n° de série (comparé sans majuscules). */
  const dejaDansFichier = new Map<string, { ligne: number; siteId: string | null }[]>();
  const rapportLignes: LigneImport[] = [];
  const aEnregistrer: InstrumentAImporter[] = [];

  for (const { numero, cellules } of donnees) {
    const lue = (champ: string) => {
      const position = positions.get(champ);
      return position === undefined ? "" : (cellules[position] ?? "").replace(/\s+/g, " ").trim();
    };
    const erreurs: string[] = [];
    const avertissements: string[] = [];

    // 1. Le site.
    const recherche = trouverSite(lue("client"), lue("site"), clients);
    const site = "site" in recherche ? recherche.site : null;
    if ("erreur" in recherche) erreurs.push(recherche.erreur);

    // 2. La vignette et son échéance, ramenées à ce que le formulaire envoie.
    const saisie: Saisie = Object.fromEntries(
      ["type", "marque", "modele", "numero_serie", "portee_max", "echelon", "millesime", "emplacement", "motif_statut"].map(
        (champ) => [champ, lue(champ)],
      ),
    );
    const vignette = lue("vignette");
    const echeance = lue("echeance");
    let statut: StatutMetrologie | undefined = VIGNETTES[cle(vignette)];
    if (vignette === "") {
      // Rien d'écrit : une échéance veut dire « vignette verte » ; sinon, par prudence, « À vérifier ».
      statut = echeance === "" ? "a_verifier" : "verte";
    } else if (!statut) {
      erreurs.push(`Vignette « ${vignette} » non comprise : écrivez verte, rouge ou à vérifier.`);
    }
    let echeanceComprise = true;
    if (statut === "verte") {
      const lu = echeance === "" ? null : lireEcheanceImport(echeance);
      if (lu) {
        saisie.echeance_mois = String(lu.mois);
        saisie.echeance_annee = String(lu.annee);
      } else {
        echeanceComprise = false;
        erreurs.push(
          echeance === ""
            ? "Échéance : une vignette verte a toujours une échéance (mois/année, exemple : 11/2027)."
            : `Échéance « ${echeance} » non comprise : écrivez le mois et l'année (exemple : 11/2027).`,
        );
      }
    }
    saisie.statut_metrologie = statut ?? "a_verifier";

    // 3. Les mêmes contrôles que le formulaire « Nouvel instrument ».
    const controle = controlerNouvelInstrument(saisie, aujourdhui);
    if (!controle.ok) {
      for (const [champ, message] of Object.entries(controle.erreurs)) {
        if (champ === "echeance" && !echeanceComprise) continue; // déjà signalé ci-dessus
        erreurs.push(`${LIBELLES_CHAMP[champ] ?? champ} : ${message}`);
      }
    }

    // 4. Les n° de série déjà connus.
    const serie = lue("numero_serie");
    if (serie !== "") {
      const cleSerie = serie.toLowerCase();
      const memeSite = site?.instruments.find((i) => i.numeroSerie.trim().toLowerCase() === cleSerie);
      const vues = dejaDansFichier.get(cleSerie) ?? [];
      const memeSiteFichier = site && vues.find((v) => v.siteId === site.id);
      if (memeSite) {
        erreurs.push(`N° de série ${serie} : déjà dans le parc de ce site (${memeSite.numero}). Retirez cette ligne du fichier.`);
      } else if (memeSiteFichier) {
        erreurs.push(`N° de série ${serie} : déjà présent ligne ${memeSiteFichier.ligne} du fichier, pour le même site.`);
      } else {
        const ailleurs = clients.flatMap((c) =>
          c.sites.flatMap((s) =>
            s.instruments
              .filter((i) => i.numeroSerie.trim().toLowerCase() === cleSerie)
              .map((i) => `${i.numero} (${c.nom})`),
          ),
        );
        const origines = [...ailleurs, ...vues.map((v) => `la ligne ${v.ligne} du fichier`)];
        if (origines.length > 0) {
          avertissements.push(
            `Double possible : le n° de série ${serie} est déjà celui de ${origines.join(", ")}. ` +
              `L'instrument sera créé et une alerte sera envoyée au chef d'agence.`,
          );
        }
      }
      dejaDansFichier.set(cleSerie, [...vues, { ligne: numero, siteId: site?.id ?? null }]);
    }

    rapportLignes.push({
      ligne: numero,
      client: site?.client ?? lue("client"),
      site: site?.nom ?? lue("site"),
      description: `${[lue("type"), lue("marque"), lue("modele")].filter(Boolean).join(" ")}${serie ? ` · n° ${serie}` : ""}`,
      statut: controle.ok ? controle.valeurs.statut_metrologie : null,
      echeance: controle.ok ? controle.valeurs.echeance_verification : null,
      erreurs,
      avertissements,
    });
    if (controle.ok && site && erreurs.length === 0) aEnregistrer.push({ ...controle.valeurs, site_id: site.id });
  }

  const nombreErreurs = rapportLignes.filter((l) => l.erreurs.length > 0).length;
  return {
    rapport: {
      erreur: null,
      colonnesIgnorees: ignorees,
      lignes: rapportLignes,
      nombreErreurs,
      nombreAvertissements: rapportLignes.filter((l) => l.avertissements.length > 0).length,
    },
    aEnregistrer: nombreErreurs === 0 ? aEnregistrer : [],
  };
}
