"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decoderFichier, lireCsv } from "@/lib/csv";
import { echecFormulaire, MESSAGE_CHAMPS, saisieDe, type EtatFormulaire } from "@/lib/formulaire";
import {
  controlerClient,
  controlerFicheInstrument,
  controlerImportInstruments,
  controlerNouvelInstrument,
  controlerSite,
  jourParis,
  peutGererParc,
} from "@/lib/regles";
import { lireParcPourImport } from "@/lib/supabase/parc";
import { session, type ClientSupabase, type UtilisateurCourant } from "@/lib/supabase/utilisateur-courant";
import { ETAT_IMPORT_INITIAL, TAILLE_MAX_FICHIER, type EtatImport } from "./instruments/import/etat";

/**
 * Enregistrement des clients, des sites et des instruments. Le contrôle fait ici sert à expliquer un refus en
 * français ; la vraie protection est dans la base (droits et cloisonnement par agence).
 */

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** L'utilisateur connecté, s'il a le droit de gérer le parc ; sinon, le message à afficher. */
async function gestionnaireDuParc(): Promise<
  { supabase: ClientSupabase; utilisateur: UtilisateurCourant } | { refus: string }
> {
  const { supabase, utilisateur } = await session();
  if (utilisateur === null) redirect("/connexion");
  if (utilisateur === "sans_fiche") return { refus: "Votre compte est désactivé ou n'est rattaché à aucune entreprise." };
  if (!peutGererParc(utilisateur.role)) {
    return { refus: "Seuls le chef d'agence et l'administrateur peuvent créer ou modifier un client, un site ou un instrument." };
  }
  return { supabase, utilisateur };
}

/** Message pour l'écran quand la base refuse ; le détail technique va dans le terminal du serveur. */
function messageRefusBase(quoi: string, erreur: { code?: string; message: string }): string {
  console.error(`[parc] ${quoi} : refusé par la base (${erreur.code || "sans code"}) : ${erreur.message}`);
  if (erreur.code === "42501") return "La base a refusé l'enregistrement : votre rôle ou votre agence ne le permet pas.";
  if (!erreur.code) return "Le service ne répond pas. Vérifiez le réseau et réessayez.";
  return `L'enregistrement a échoué (code ${erreur.code}). Réessayez ; si cela dure, prévenez l'administrateur.`;
}

export async function creerClient(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const acces = await gestionnaireDuParc();
  if ("refus" in acces) return echecFormulaire(acces.refus, saisie);
  const { supabase, utilisateur } = acces;

  const controle = controlerClient(saisie);
  const erreurs = controle.ok ? {} : controle.erreurs;
  // Un chef d'agence crée toujours dans son agence ; un administrateur choisit l'agence.
  const agenceId = utilisateur.role === "chef_agence" ? utilisateur.agenceId : saisie.agence_id;
  if (!agenceId || !FORMAT_UUID.test(agenceId)) erreurs.agence_id = "Choisissez l'agence de ce client.";
  if (!controle.ok || Object.keys(erreurs).length > 0) return echecFormulaire(MESSAGE_CHAMPS, saisie, erreurs);

  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("client")
    .insert({ id, entreprise_id: utilisateur.entrepriseId, agence_id: agenceId, ...controle.valeurs });
  if (error) return echecFormulaire(messageRefusBase("création d'un client", error), saisie);

  revalidatePath("/parc", "layout");
  redirect(`/parc/clients/${id}`);
}

export async function modifierClient(id: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const acces = await gestionnaireDuParc();
  if ("refus" in acces) return echecFormulaire(acces.refus, saisie);

  const controle = controlerClient(saisie);
  if (!controle.ok) return echecFormulaire(MESSAGE_CHAMPS, saisie, controle.erreurs);

  const { data, error } = await acces.supabase.from("client").update(controle.valeurs).eq("id", id).select("id");
  if (error) return echecFormulaire(messageRefusBase("modification d'un client", error), saisie);
  if (data.length === 0) return echecFormulaire("Ce client n'existe plus, ou il n'est pas dans votre agence.", saisie);

  revalidatePath("/parc", "layout");
  redirect(`/parc/clients/${id}`);
}

export async function creerSite(clientId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const acces = await gestionnaireDuParc();
  if ("refus" in acces) return echecFormulaire(acces.refus, saisie);

  const controle = controlerSite(saisie);
  if (!controle.ok) return echecFormulaire(MESSAGE_CHAMPS, saisie, controle.erreurs);

  const { error } = await acces.supabase
    .from("site")
    .insert({ id: crypto.randomUUID(), entreprise_id: acces.utilisateur.entrepriseId, client_id: clientId, ...controle.valeurs });
  if (error) return echecFormulaire(messageRefusBase("création d'un site", error), saisie);

  revalidatePath("/parc", "layout");
  redirect(`/parc/clients/${clientId}`);
}

export async function modifierSite(
  id: string,
  clientId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const acces = await gestionnaireDuParc();
  if ("refus" in acces) return echecFormulaire(acces.refus, saisie);

  const controle = controlerSite(saisie);
  if (!controle.ok) return echecFormulaire(MESSAGE_CHAMPS, saisie, controle.erreurs);

  const { data, error } = await acces.supabase.from("site").update(controle.valeurs).eq("id", id).select("id");
  if (error) return echecFormulaire(messageRefusBase("modification d'un site", error), saisie);
  if (data.length === 0) return echecFormulaire("Ce site n'existe plus, ou il n'est pas dans votre agence.", saisie);

  revalidatePath("/parc", "layout");
  redirect(`/parc/clients/${clientId}`);
}

export async function creerInstrument(siteId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const acces = await gestionnaireDuParc();
  if ("refus" in acces) return echecFormulaire(acces.refus, saisie);

  const controle = controlerNouvelInstrument(saisie, jourParis(new Date()));
  if (!controle.ok) return echecFormulaire(MESSAGE_CHAMPS, saisie, controle.erreurs);

  // Pas de numéro ici : c'est la base qui attribue le prochain INS-xxxx de l'entreprise.
  const id = crypto.randomUUID();
  const { error } = await acces.supabase
    .from("instrument")
    .insert({ id, entreprise_id: acces.utilisateur.entrepriseId, site_id: siteId, ...controle.valeurs });
  if (error) return echecFormulaire(messageRefusBase("création d'un instrument", error), saisie);

  revalidatePath("/parc", "layout");
  redirect(`/parc/instruments/${id}`);
}

/** Modifie la fiche. La vignette et l'échéance n'en font pas partie : seul un bon signé les change (§6.8). */
export async function modifierInstrument(id: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const acces = await gestionnaireDuParc();
  if ("refus" in acces) return echecFormulaire(acces.refus, saisie);

  const controle = controlerFicheInstrument(saisie, jourParis(new Date()));
  if (!controle.ok) return echecFormulaire(MESSAGE_CHAMPS, saisie, controle.erreurs);

  const { data, error } = await acces.supabase.from("instrument").update(controle.valeurs).eq("id", id).select("id");
  if (error) return echecFormulaire(messageRefusBase("modification d'un instrument", error), saisie);
  if (data.length === 0) return echecFormulaire("Cet instrument n'existe plus, ou il n'est pas dans votre agence.", saisie);

  revalidatePath("/parc", "layout");
  redirect(`/parc/instruments/${id}`);
}

/**
 * Import d'instruments depuis un fichier CSV, en deux temps (voir EtatImport) : d'abord le
 * contrôle de toutes les lignes sans rien enregistrer, puis, à la confirmation, un nouveau
 * contrôle complet et l'enregistrement de toutes les lignes d'un seul coup (tout ou rien).
 */
export async function importerInstruments(_etat: EtatImport, formulaire: FormData): Promise<EtatImport> {
  const arret = (erreur: string): EtatImport => ({ ...ETAT_IMPORT_INITIAL, erreur });

  const acces = await gestionnaireDuParc();
  if ("refus" in acces) return arret(acces.refus);
  const { supabase, utilisateur } = acces;

  // 1. Le texte du fichier : envoyé à l'instant, ou renvoyé tel quel pour la confirmation.
  const confirmer = formulaire.get("confirmer") === "oui";
  let contenu = "";
  let nomFichier = "";
  if (confirmer) {
    contenu = String(formulaire.get("contenu") ?? "");
    nomFichier = String(formulaire.get("nom_fichier") ?? "");
  } else {
    const fichier = formulaire.get("fichier");
    if (!(fichier instanceof File) || fichier.size === 0) return arret("Choisissez d'abord un fichier CSV.");
    if (fichier.size > TAILLE_MAX_FICHIER) {
      return arret("Ce fichier est trop gros pour un seul envoi. Découpez-le en plusieurs fichiers.");
    }
    contenu = decoderFichier(new Uint8Array(await fichier.arrayBuffer()));
    nomFichier = fichier.name;
  }
  if (contenu.length > TAILLE_MAX_FICHIER) return arret("Ce fichier est trop gros pour un seul envoi.");

  // 2. Le contrôle, toujours refait en entier : le parc a pu changer depuis l'aperçu.
  const lecture = lireCsv(contenu);
  if (!lecture.ok) return arret(lecture.erreur);
  const parc = await lireParcPourImport(supabase);
  if (!parc.ok) {
    console.error(`[parc] import : lecture du parc impossible (${parc.code}) : ${parc.detail}`);
    return arret("Le parc n'a pas pu être lu. Vérifiez le réseau et réessayez.");
  }
  const { rapport, aEnregistrer } = controlerImportInstruments(lecture.lignes, parc.donnees, jourParis(new Date()));
  if (rapport.erreur) return arret(rapport.erreur);

  const apercu: EtatImport = { etape: "rapport", erreur: null, nomFichier, contenu, rapport, resultat: null };
  if (!confirmer) return apercu;
  if (aEnregistrer.length === 0) {
    return { ...apercu, erreur: "Rien n'a été enregistré : le fichier contient maintenant des erreurs (le parc a changé entre-temps)." };
  }

  // 3. L'enregistrement : une seule demande à la base, donc toutes les lignes ou aucune.
  //    Les numéros INS-xxxx et les alertes de double sont créés par la base.
  const { data, error } = await supabase
    .from("instrument")
    .insert(aEnregistrer.map((valeurs) => ({ id: crypto.randomUUID(), entreprise_id: utilisateur.entrepriseId, ...valeurs })))
    .select("numero")
    .returns<{ numero: string }[]>();
  if (error) return { ...apercu, erreur: `Rien n'a été enregistré. ${messageRefusBase("import d'instruments", error)}` };

  const numeros = data.map((i) => i.numero).sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  revalidatePath("/parc", "layout");
  return {
    ...ETAT_IMPORT_INITIAL,
    etape: "termine",
    nomFichier,
    resultat: {
      nombre: numeros.length,
      premier: numeros[0] ?? "",
      dernier: numeros.at(-1) ?? "",
      doubles: rapport.nombreAvertissements,
    },
  };
}
