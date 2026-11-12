"use server";

import { redirect } from "next/navigation";
import { examinerConfigSupabase } from "@/lib/supabase/config";
import {
  classerErreurConnexion,
  ligneJournalConnexion,
  MESSAGES_CONNEXION,
  type ErreurSupabase,
} from "@/lib/supabase/erreurs-connexion";
import { supabaseServeur } from "@/lib/supabase/serveur";
import { utilisateurCourant } from "@/lib/supabase/utilisateur-courant";

export interface EtatConnexion {
  erreur: string | null;
  email: string;
}

/**
 * Connexion par email + mot de passe (pas d'inscription : comptes créés par l'administrateur).
 * L'écran reçoit un message simple ; la vraie cause est écrite dans le terminal du serveur
 * (code d'erreur Supabase), sans jamais y mettre de clé ni de mot de passe.
 */
export async function seConnecter(_etat: EtatConnexion, formulaire: FormData): Promise<EtatConnexion> {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "Saisissez votre email et votre mot de passe.", email };
  }

  const config = examinerConfigSupabase();
  if (!config.ok) {
    console.error(`[connexion] Configuration Supabase incorrecte : ${config.probleme}`);
    return { erreur: MESSAGES_CONNEXION.configuration, email };
  }

  const supabase = await supabaseServeur();

  let echec: ErreurSupabase | null;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    echec = error;
  } catch (erreur) {
    echec = erreur instanceof Error ? erreur : { message: String(erreur) };
  }
  if (echec) {
    const diagnostic = classerErreurConnexion(echec);
    console.error(ligneJournalConnexion(echec, diagnostic));
    return { erreur: diagnostic.message, email };
  }

  // Le compte de connexion est bon : a-t-il aussi une fiche active dans une entreprise ?
  let fiche: Awaited<ReturnType<typeof utilisateurCourant>>;
  try {
    fiche = await utilisateurCourant(supabase);
  } catch (erreur) {
    console.error(
      `[connexion] Compte accepté, mais la fiche utilisateur est illisible : ${erreur instanceof Error ? erreur.message : erreur}\n` +
        "[connexion] Piste : les fichiers de supabase/migrations/ ont-ils tous été appliqués, dans l'ordre, sur ce projet ?",
    );
    await supabase.auth.signOut();
    return { erreur: MESSAGES_CONNEXION.configuration, email };
  }
  if (fiche === null || fiche === "sans_fiche") {
    console.error(
      "[connexion] Compte accepté par Supabase, mais sans fiche active dans la table « utilisateur » " +
        "(pas de ligne pour ce compte, ou « actif » à faux).\n" +
        "[connexion] Piste : relancer « npm run demo » pour les comptes de démonstration.",
    );
    await supabase.auth.signOut();
    return { erreur: MESSAGES_CONNEXION.compte_desactive, email };
  }

  redirect("/");
}

export async function seDeconnecter() {
  const supabase = await supabaseServeur();
  await supabase.auth.signOut();
  redirect("/connexion");
}
