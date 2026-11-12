/**
 * Données fictives de démonstration (CLAUDE.md §11), reprises du prototype.
 * Aucune donnée réelle : marques Tarvex et Balix, téléphones 06 00 00 00 0X, emails @exemple.fr.
 *
 * Ce fichier ne parle pas à la base : il fabrique seulement la liste des lignes à créer
 * (fonction pure, testée dans donnees-demo.test.ts). C'est demo.ts qui les envoie.
 * Les montants des bons sont calculés par les règles métier (lib/regles), jamais recopiés.
 */
import { createHash } from "node:crypto";
import {
  ajouterJours,
  ajouterMois,
  calculerMainOeuvre,
  dernierJourDuMois,
  echeanceProposee,
  forfaitDeplacement,
  instantParis,
  JOURS_ALERTE_ECHEANCE,
  jourParis,
  joursEntre,
  minutesReelles,
  moisDe,
  totalBon,
  type MoisCalendaire,
  type NatureLigne,
  type Priorite,
  type ReglagesDeplacement,
  type StatutIntervention,
  type StatutMetrologie,
  type TypeIntervention,
} from "../lib/regles/index.ts";

export const NOM_ENTREPRISE_DEMO = "Pesage Démo";
export const AGENCE_DEMO = { nom: "Agence de Villeneuve", adresse: "1 avenue de la Bascule, Villeneuve" };

export type CleUtilisateur = "karim" | "lucas" | "sophie" | "nadia";

export const UTILISATEURS_DEMO: {
  cle: CleUtilisateur;
  email: string;
  nom: string;
  role: "technicien" | "chef_agence" | "gestionnaire";
  habilite: boolean;
  /** Nadia G., gestionnaire au siège, n'a pas d'agence : elle voit toutes les agences. */
  avecAgence: boolean;
}[] = [
  { cle: "karim", email: "karim@exemple.fr", nom: "Karim B.", role: "technicien", habilite: true, avecAgence: true },
  { cle: "lucas", email: "lucas@exemple.fr", nom: "Lucas M.", role: "technicien", habilite: false, avecAgence: true },
  { cle: "sophie", email: "sophie@exemple.fr", nom: "Sophie R.", role: "chef_agence", habilite: true, avecAgence: true },
  { cle: "nadia", email: "nadia@exemple.fr", nom: "Nadia G.", role: "gestionnaire", habilite: false, avecAgence: false },
];

const ARTICLES = [
  { code: "1", designation: "Câble de capteur blindé 4 fils (le mètre)", prix: 450 },
  { code: "2", designation: "Capteur de pesage 2 t inox", prix: 18500 },
  { code: "3", designation: "Bloc alimentation indicateur 12 V", prix: 6200 },
];

const CLIENTS = [
  {
    cle: "ferrand", nom: "Carrière Ferrand", critique: true,
    note: "Un seul pont-bascule : expéditions à l’arrêt en cas de panne",
    site: "Carrière de la Garrigue", adresse: "Chemin des Plâtrières, Villeneuve", km: 18,
    contact: null, fonction: "Responsable maintenance", telephone: "06 00 00 00 01", email: "carriere.ferrand@exemple.fr",
  },
  {
    cle: "causses", nom: "Fromagerie des Causses", critique: false, note: null,
    site: "Atelier d’affinage", adresse: "ZA du Plateau, Saint-Martin", km: 32,
    contact: null, fonction: "Accueil", telephone: "06 00 00 00 02", email: "fromagerie.causses@exemple.fr",
  },
  {
    cle: "arnal", nom: "Boulangerie Arnal", critique: true, note: "Une seule balance de vente",
    site: "Magasin centre-ville", adresse: "12 rue Basse, Villeneuve", km: 4,
    contact: "Mme Arnal", fonction: null, telephone: "06 00 00 00 03", email: "boulangerie.arnal@exemple.fr",
  },
  {
    cle: "saint-clair", nom: "Coopérative Saint-Clair", critique: false, note: null,
    site: "Cave de réception", adresse: "Route des Vignes, Saint-Clair", km: 24,
    contact: null, fonction: "Technicien maintenance", telephone: "06 00 00 00 04", email: "cooperative.saint-clair@exemple.fr",
  },
  {
    cle: "dubois", nom: "Primeurs Dubois", critique: false, note: "Plusieurs balances : peut continuer à vendre",
    site: "Halle du marché", adresse: "Place du Marché, Villeneuve", km: 3,
    contact: "M. Dubois", fonction: null, telephone: "06 00 00 00 05", email: "primeurs.dubois@exemple.fr",
  },
  {
    cle: "pharmacie", nom: "Pharmacie du Marché", critique: false, note: null,
    site: "Préparatoire", adresse: "3 place du Marché, Villeneuve", km: 3,
    contact: null, fonction: "Pharmacien titulaire", telephone: "06 00 00 00 06", email: "pharmacie.marche@exemple.fr",
  },
] as const;

type CleClient = (typeof CLIENTS)[number]["cle"];

/**
 * Échéance de la vignette au moment où la démonstration est créée :
 * - "loin" : dans n mois (vignette verte) ;
 * - "ce_mois" et "bientot" : dans les 45 jours (affichée en orange) ;
 * - "perimee" : le mois dernier (vignette périmée) ;
 * - "apres_bon" : posée par le bon de vérification de la démonstration (INT-1039).
 */
type EcheanceDemo = { loin: number } | "ce_mois" | "bientot" | "perimee" | "apres_bon" | null;

const INSTRUMENTS: {
  numero: string; client: CleClient; type: string; marque: string; modele: string; serie: string;
  portee: string; echelon: string; millesime: number; emplacement: string;
  statut: StatutMetrologie; echeance: EcheanceDemo; motif?: string;
}[] = [
  { numero: "INS-0421", client: "ferrand", type: "Pont-bascule 18 m", marque: "Tarvex", modele: "PB-18", serie: "TX18-2291", portee: "60 t", echelon: "20 kg", millesime: 2015, emplacement: "Entrée de site", statut: "verte", echeance: "apres_bon" },
  { numero: "INS-0518", client: "causses", type: "Plateforme inox", marque: "Balix", modele: "P300", serie: "BX-77810", portee: "300 kg", echelon: "100 g", millesime: 2019, emplacement: "Atelier d’affinage", statut: "verte", echeance: "ce_mois" },
  { numero: "INS-0603", client: "arnal", type: "Balance poids-prix", marque: "Balix", modele: "C15", serie: "BX-31002", portee: "15 kg", echelon: "5 g", millesime: 2017, emplacement: "Comptoir de vente", statut: "verte", echeance: { loin: 7 } },
  { numero: "INS-0711", client: "saint-clair", type: "Plateforme de réception", marque: "Tarvex", modele: "PF-1500", serie: "TX-50417", portee: "1 500 kg", echelon: "500 g", millesime: 2014, emplacement: "Quai de réception", statut: "verte", echeance: "bientot" },
  { numero: "INS-0712", client: "saint-clair", type: "Plateforme de réception", marque: "Tarvex", modele: "PF-1500", serie: "TX-61208", portee: "1 500 kg", echelon: "500 g", millesime: 2026, emplacement: "Quai 2 (en installation)", statut: "a_verifier", echeance: null, motif: "Vérification primitive à réaliser" },
  { numero: "INS-0802", client: "dubois", type: "Balance poids-prix", marque: "Balix", modele: "C15", serie: "BX-40118", portee: "15 kg", echelon: "5 g", millesime: 2018, emplacement: "Étal fruits", statut: "verte", echeance: "bientot" },
  { numero: "INS-0803", client: "dubois", type: "Balance poids-prix", marque: "Balix", modele: "C15", serie: "BX-40119", portee: "15 kg", echelon: "5 g", millesime: 2018, emplacement: "Étal légumes", statut: "verte", echeance: "bientot" },
  { numero: "INS-0910", client: "pharmacie", type: "Balance de précision", marque: "Balix", modele: "L6", serie: "BX-90055", portee: "6 kg", echelon: "0,1 g", millesime: 2020, emplacement: "Préparatoire", statut: "verte", echeance: "perimee" },
];

/** Un moment de la démonstration : un jour compté depuis aujourd'hui (0 = aujourd'hui, -1 = hier) et une heure de Paris. */
type Moment = { jour: number; heure: string } | { ilYAMinutes: number };

interface BonDemo {
  signe: Moment;
  /** Le chrono a tourné d'une traite, de ce moment jusqu'à la signature. */
  chronoDemarre: Moment;
  travaux: string;
  signataire: string;
  /** Vérification : résultat conforme pour chaque instrument. Sinon : chaîne de mesure non touchée. */
  lignes: { code: string; quantite: number }[];
}

const INTERVENTIONS: {
  numero: string; type: TypeIntervention; client: CleClient; instruments: string[];
  statut: StatutIntervention; priorite: Priorite; titulaire: CleUtilisateur | null;
  recue: Moment; dureeMinutes: number; personnes: number; description: string;
  journal: { quand: Moment | "signature"; auteur: CleUtilisateur; texte: string }[];
  /** Chrono qui tourne en ce moment (intervention « En cours »). */
  chronoEnCours?: Moment;
  bon?: BonDemo;
  facturee?: { quand: Moment; par: CleUtilisateur };
}[] = [
  {
    numero: "INT-1046", type: "reparation", client: "saint-clair", instruments: ["INS-0711"],
    statut: "en_cours", priorite: "normale", titulaire: "karim",
    recue: { jour: -1, heure: "16:20" }, dureeMinutes: 120, personnes: 1,
    description: "Câble de capteur endommagé par des rongeurs, affichage instable.",
    chronoEnCours: { ilYAMinutes: 38 },
    journal: [
      { quand: { jour: -1, heure: "16:20" }, auteur: "sophie", texte: "Demande créée" },
      { quand: { ilYAMinutes: 60 }, auteur: "karim", texte: "Prise par Karim B." },
      { quand: { ilYAMinutes: 38 }, auteur: "karim", texte: "Chrono démarré" },
    ],
  },
  {
    numero: "INT-1041", type: "reparation", client: "ferrand", instruments: ["INS-0421"],
    statut: "a_faire", priorite: "urgente", titulaire: null,
    recue: { jour: 0, heure: "07:52" }, dureeMinutes: 180, personnes: 2,
    description: "Indicateur en erreur, pesée impossible. Camions en attente sur site.",
    journal: [{ quand: { jour: 0, heure: "07:52" }, auteur: "sophie", texte: "Demande créée" }],
  },
  {
    numero: "INT-1043", type: "reparation", client: "arnal", instruments: ["INS-0603"],
    statut: "a_faire", priorite: "urgente", titulaire: null,
    recue: { jour: 0, heure: "08:05" }, dureeMinutes: 60, personnes: 1,
    description: "Touche tare inopérante, vente très ralentie.",
    journal: [{ quand: { jour: 0, heure: "08:05" }, auteur: "sophie", texte: "Demande créée" }],
  },
  {
    numero: "INT-1042", type: "verification", client: "causses", instruments: ["INS-0518"],
    statut: "prise", priorite: "normale", titulaire: "sophie",
    recue: { jour: -5, heure: "10:10" }, dureeMinutes: 60, personnes: 1,
    description: "Vérification périodique.",
    journal: [
      { quand: { jour: -5, heure: "10:10" }, auteur: "sophie", texte: "Demande créée" },
      { quand: { jour: -1, heure: "17:30" }, auteur: "sophie", texte: "Prise par Sophie R." },
    ],
  },
  {
    numero: "INT-1044", type: "installation", client: "saint-clair", instruments: ["INS-0712"],
    statut: "prise", priorite: "normale", titulaire: "lucas",
    recue: { jour: -10, heure: "09:00" }, dureeMinutes: 960, personnes: 2,
    description: "Pose d’une seconde plateforme sur le quai 2 et raccordement à l’indicateur.",
    journal: [
      { quand: { jour: -10, heure: "09:00" }, auteur: "sophie", texte: "Demande créée" },
      { quand: { jour: -3, heure: "14:00" }, auteur: "lucas", texte: "Prise par Lucas M." },
    ],
  },
  {
    // Une seule visite pour les deux balances du primeur (§5 : plusieurs instruments du même site).
    numero: "INT-1045", type: "verification", client: "dubois", instruments: ["INS-0802", "INS-0803"],
    statut: "a_faire", priorite: "normale", titulaire: null,
    recue: { jour: -2, heure: "11:40" }, dureeMinutes: 60, personnes: 1,
    description: "Vérification périodique des deux balances (INS-0802 et INS-0803).",
    journal: [{ quand: { jour: -2, heure: "11:40" }, auteur: "sophie", texte: "Demande créée" }],
  },
  {
    numero: "INT-1047", type: "verification", client: "pharmacie", instruments: ["INS-0910"],
    statut: "a_faire", priorite: "normale", titulaire: null,
    recue: { jour: 0, heure: "08:10" }, dureeMinutes: 60, personnes: 1,
    description: "Vignette périmée : vérification à faire rapidement.",
    journal: [{ quand: { jour: 0, heure: "08:10" }, auteur: "sophie", texte: "Demande créée" }],
  },
  {
    numero: "INT-1039", type: "verification", client: "ferrand", instruments: ["INS-0421"],
    statut: "terminee", priorite: "normale", titulaire: "sophie",
    recue: { jour: -20, heure: "09:00" }, dureeMinutes: 180, personnes: 2,
    description: "Vérification périodique avec camion étalon.",
    journal: [
      { quand: { jour: -20, heure: "09:00" }, auteur: "sophie", texte: "Demande créée" },
      { quand: { jour: -2, heure: "12:35" }, auteur: "sophie", texte: "Chrono démarré" },
      { quand: "signature", auteur: "sophie", texte: "Bon {numero} signé" },
    ],
    bon: {
      chronoDemarre: { jour: -2, heure: "12:35" },
      signe: { jour: -2, heure: "15:40" },
      travaux: "Essais de charge avec camion étalon, essais d’excentration et de mobilité. Résultats dans les tolérances.",
      signataire: "Responsable maintenance",
      lignes: [],
    },
  },
  {
    numero: "INT-1037", type: "reparation", client: "causses", instruments: ["INS-0518"],
    statut: "facturee", priorite: "normale", titulaire: "lucas",
    recue: { jour: -8, heure: "14:00" }, dureeMinutes: 60, personnes: 1,
    description: "Indicateur qui s’éteint seul.",
    journal: [
      { quand: { jour: -8, heure: "14:00" }, auteur: "sophie", texte: "Demande créée" },
      { quand: { jour: -6, heure: "09:23" }, auteur: "lucas", texte: "Chrono démarré" },
      { quand: "signature", auteur: "lucas", texte: "Bon {numero} signé" },
      { quand: { jour: -4, heure: "09:30" }, auteur: "nadia", texte: "Marquée facturée" },
    ],
    bon: {
      chronoDemarre: { jour: -6, heure: "09:23" },
      signe: { jour: -6, heure: "10:15" },
      travaux: "Remplacement du bloc d’alimentation de l’indicateur. Aucun réglage métrologique, scellés intacts.",
      signataire: "Accueil",
      lignes: [{ code: "3", quantite: 1 }],
    },
    facturee: { quand: { jour: -4, heure: "09:30" }, par: "nadia" },
  },
];

/** Image de signature fictive (un point transparent) : aucun vrai paraphe dans la démonstration. */
const SIGNATURE_FICTIVE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export interface ReglagesEntreprise extends ReglagesDeplacement {
  tauxHoraireCentimes: number;
  prefixeNumerotation: string;
}

export interface ContexteDemo {
  entrepriseId: string;
  agenceId: string;
  utilisateurs: Record<CleUtilisateur, string>;
  reglages: ReglagesEntreprise;
  /** L'instant où la démonstration est créée : toutes les dates en découlent. */
  maintenant: Date;
}

/** Des lignes à créer dans une table, si elles n'y sont pas déjà (`cle` : ce qui les identifie). */
export interface LotDemo {
  table: string;
  cle: string;
  lignes: Record<string, unknown>[];
}

/**
 * Identifiant stable d'une ligne de démonstration : le même à chaque lancement du script
 * (c'est ce qui permet de le relancer sans créer de doublons), différent d'une entreprise à l'autre.
 */
export function idDemo(entrepriseId: string, nom: string): string {
  const h = createHash("sha1").update(`tare-demo:${entrepriseId}:${nom}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Dernier mois dont la fin tombe dans les 45 jours : la vignette s'affiche « Vérification dans N j ». */
function moisBientot(aujourdhui: string): MoisCalendaire {
  const suivant = ajouterMois(moisDe(aujourdhui), 1);
  return joursEntre(aujourdhui, dernierJourDuMois(suivant)) <= JOURS_ALERTE_ECHEANCE ? suivant : moisDe(aujourdhui);
}

export function construireDemo(ctx: ContexteDemo): LotDemo[] {
  const { entrepriseId: entreprise_id, agenceId, utilisateurs, reglages, maintenant } = ctx;
  const id = (nom: string) => idDemo(entreprise_id, nom);
  const aujourdhui = jourParis(maintenant);

  /**
   * Instant d'un moment de la démonstration, jamais dans le futur : si le script est lancé
   * tôt le matin, « aujourd'hui 8 h 05 » devient « hier 8 h 05 ».
   */
  const instant = (m: Moment): Date => {
    if ("ilYAMinutes" in m) return new Date(maintenant.getTime() - m.ilYAMinutes * 60_000);
    const t = instantParis(ajouterJours(aujourdhui, m.jour), m.heure);
    return t.getTime() > maintenant.getTime() ? instantParis(ajouterJours(aujourdhui, m.jour - 1), m.heure) : t;
  };
  const iso = (m: Moment) => instant(m).toISOString();
  const client = (cle: CleClient) => CLIENTS.find((c) => c.cle === cle)!;

  // --- Bons : numérotés dans l'ordre de signature, par année de signature (§6.7) ---------------
  const bons = INTERVENTIONS.filter((i) => i.bon)
    .map((i) => ({ intervention: i, bon: i.bon!, signeLe: instant(i.bon!.signe) }))
    .sort((a, b) => a.signeLe.getTime() - b.signeLe.getTime());
  const rangParAnnee = new Map<string, number>();
  const numeroBon = new Map<string, string>();
  for (const { intervention, signeLe } of bons) {
    const annee = jourParis(signeLe).slice(0, 4);
    const rang = (rangParAnnee.get(annee) ?? 0) + 1;
    rangParAnnee.set(annee, rang);
    numeroBon.set(intervention.numero, `${reglages.prefixeNumerotation}-${annee}-${String(rang).padStart(4, "0")}`);
  }
  const bonVerification = bons.find((b) => b.intervention.numero === "INT-1039")!;
  const echeanceApresBon = echeanceProposee(jourParis(bonVerification.signeLe));

  const echeance = (e: EcheanceDemo): MoisCalendaire | null => {
    if (e === null) return null;
    if (e === "ce_mois") return moisDe(aujourdhui);
    if (e === "bientot") return moisBientot(aujourdhui);
    if (e === "perimee") return ajouterMois(moisDe(aujourdhui), -1);
    if (e === "apres_bon") return echeanceApresBon;
    return ajouterMois(moisDe(aujourdhui), e.loin);
  };

  const lots: LotDemo[] = [];

  lots.push({
    table: "client",
    cle: "id",
    lignes: CLIENTS.map((c) => ({
      id: id(`client:${c.cle}`), entreprise_id, agence_id: agenceId, nom: c.nom, critique: c.critique, note: c.note,
    })),
  });
  lots.push({
    table: "site",
    cle: "id",
    lignes: CLIENTS.map((c) => ({
      id: id(`site:${c.cle}`), entreprise_id, client_id: id(`client:${c.cle}`), nom: c.site, adresse: c.adresse,
      contact_nom: c.contact, contact_fonction: c.fonction, contact_telephone: c.telephone, contact_email: c.email,
      distance_km: c.km,
    })),
  });
  lots.push({
    table: "instrument",
    cle: "id",
    lignes: INSTRUMENTS.map((i) => ({
      id: id(`instrument:${i.numero}`), entreprise_id, site_id: id(`site:${i.client}`), numero: i.numero,
      type: i.type, marque: i.marque, modele: i.modele, numero_serie: i.serie, portee_max: i.portee,
      echelon: i.echelon, millesime: i.millesime, emplacement: i.emplacement,
      statut_metrologie: i.statut, echeance_verification: echeance(i.echeance), motif_statut: i.motif ?? null,
    })),
  });
  lots.push({
    table: "article",
    cle: "entreprise_id,code",
    lignes: ARTICLES.map((a) => ({
      id: id(`article:${a.code}`), entreprise_id, code: a.code, designation: a.designation,
      prix_unitaire_ht_centimes: a.prix, actif: true,
    })),
  });

  lots.push({
    table: "intervention",
    cle: "id",
    lignes: INTERVENTIONS.map((i) => ({
      id: id(`intervention:${i.numero}`), entreprise_id, agence_id: agenceId, numero: i.numero, type: i.type,
      client_id: id(`client:${i.client}`), site_id: id(`site:${i.client}`), priorite: i.priorite, statut: i.statut,
      titulaire_id: i.titulaire ? utilisateurs[i.titulaire] : null, recue_le: iso(i.recue),
      duree_estimee_minutes: i.dureeMinutes, nombre_personnes_prevu: i.personnes, description: i.description,
      cree_par_id: utilisateurs.sophie, cree_le: iso(i.recue),
      facturee_le: i.facturee ? iso(i.facturee.quand) : null,
      facturee_par_id: i.facturee ? utilisateurs[i.facturee.par] : null,
    })),
  });
  lots.push({
    table: "intervention_instrument",
    cle: "intervention_id,instrument_id",
    lignes: INTERVENTIONS.flatMap((i) =>
      i.instruments.map((numero) => ({
        intervention_id: id(`intervention:${i.numero}`), instrument_id: id(`instrument:${numero}`), entreprise_id,
        site_id: id(`site:${i.client}`), ajoute_par_id: utilisateurs.sophie, ajoute_le: iso(i.recue),
      })),
    ),
  });

  // --- Chronos : un segment qui tourne (INT-1046) et un segment fermé par bon signé -------------
  const segments = INTERVENTIONS.flatMap((i) => {
    const debut = i.chronoEnCours ?? i.bon?.chronoDemarre;
    if (!debut || !i.titulaire) return [];
    return [{
      numero: i.numero,
      ligne: {
        id: id(`segment:${i.numero}`), entreprise_id, intervention_id: id(`intervention:${i.numero}`),
        demarre_par_id: utilisateurs[i.titulaire], appareil: "demonstration",
        debut: iso(debut), fin: i.bon ? iso(i.bon.signe) : null,
        recu_serveur_le: i.bon ? iso(i.bon.signe) : iso(debut),
      },
    }];
  });
  lots.push({ table: "segment_chrono", cle: "id", lignes: segments.map((s) => s.ligne) });

  lots.push({
    table: "journal",
    cle: "id",
    lignes: INTERVENTIONS.flatMap((i) =>
      i.journal.map((j, rang) => ({
        id: id(`journal:${i.numero}:${rang}`), entreprise_id, intervention_id: id(`intervention:${i.numero}`),
        horodatage: iso(j.quand === "signature" ? i.bon!.signe : j.quand), auteur_id: utilisateurs[j.auteur],
        texte: j.texte.replace("{numero}", numeroBon.get(i.numero) ?? ""),
      })),
    ),
  });

  // --- Bons signés : montants calculés par les règles métier -----------------------------------
  const lignesBon: Record<string, unknown>[] = [];
  const bonsInstruments: Record<string, unknown>[] = [];
  const lignesBons = bons.map(({ intervention: i, bon, signeLe }) => {
    const segment = segments.find((s) => s.numero === i.numero)!.ligne;
    const minutes = minutesReelles([{ debut: new Date(segment.debut), fin: signeLe }], signeLe);
    const mainOeuvre = calculerMainOeuvre({
      minutesReelles: minutes, nombrePersonnes: i.personnes, tauxHoraireCentimes: reglages.tauxHoraireCentimes,
    });
    const km = client(i.client).km;
    const forfait = forfaitDeplacement(km, reglages);
    const pieces = bon.lignes.map((l, ordre) => {
      const article = ARTICLES.find((a) => a.code === l.code)!;
      return { ordre, nature: "catalogue" as NatureLigne, article, quantite: l.quantite };
    });
    const total = totalBon({
      mainOeuvreCentimes: mainOeuvre.montantCentimes,
      forfaitDeplacementCentimes: forfait.montantCentimes,
      nombreForfaitsFactures: 1,
      lignes: pieces.map((p) => ({ nature: p.nature, quantite: p.quantite, prixUnitaireCentimes: p.article.prix })),
    });
    const bonId = id(`bon:${i.numero}`);

    for (const p of pieces) {
      lignesBon.push({
        id: id(`ligne:${i.numero}:${p.ordre}`), entreprise_id, bon_id: bonId, ordre: p.ordre, nature: p.nature,
        code_article: p.article.code, designation: p.article.designation, quantite: p.quantite,
        prix_unitaire_ht_centimes: p.article.prix,
      });
    }
    for (const numero of i.instruments) {
      const verification = i.type === "verification";
      bonsInstruments.push({
        bon_id: bonId, instrument_id: id(`instrument:${numero}`), entreprise_id,
        chaine_mesure_touchee: verification ? null : false,
        resultat_verification: verification ? "conforme" : null,
        nouvelle_echeance: verification ? echeanceProposee(jourParis(signeLe)) : null,
        observations: null,
      });
    }

    const envoiLe = new Date(Math.min(signeLe.getTime() + 2 * 60_000, maintenant.getTime())).toISOString();
    return {
      id: bonId, entreprise_id, intervention_id: id(`intervention:${i.numero}`), numero: numeroBon.get(i.numero),
      reference_provisoire: `PROV-demonstration-${signeLe.toISOString().slice(0, 16).replace(/[-:]/g, "")}`,
      statut: "valide", signe_le: signeLe.toISOString(), titulaire_id: utilisateurs[i.titulaire!],
      travaux_realises: bon.travaux, minutes_chrono: minutes, nombre_personnes: i.personnes,
      minutes_facturees_par_personne: mainOeuvre.minutesFactureesParPersonne,
      taux_horaire_applique_centimes: reglages.tauxHoraireCentimes, distance_km: km,
      forfait_deplacement_applique_centimes: forfait.montantCentimes, libelle_zone: forfait.libelleZone,
      nombre_passages: 1, nombre_forfaits_factures: 1, nom_signataire: bon.signataire,
      signature: SIGNATURE_FICTIVE, email_envoi: client(i.client).email, envoye: true, envoye_le: envoiLe,
      total_ht_centimes: total.totalHtCentimes, recu_serveur_le: envoiLe, ecart_horloge_minutes: 0,
    };
  });
  lots.push({ table: "bon", cle: "id", lignes: lignesBons });
  lots.push({ table: "bon_instrument", cle: "bon_id,instrument_id", lignes: bonsInstruments });
  lots.push({ table: "ligne_bon", cle: "id", lignes: lignesBon });

  return lots;
}
