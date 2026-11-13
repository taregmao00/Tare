"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { echecFormulaire, MESSAGE_CHAMPS, saisieDe, type EtatFormulaire } from "@/lib/formulaire";
import {
  controlerClient,
  controlerFicheInstrument,
  controlerNouvelInstrument,
  controlerSite,
  jourParis,
  peutGererParc,
} from "@/lib/regles";
import { session, type ClientSupabase, type UtilisateurCourant } from "@/lib/supabase/utilisateur-courant";

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
