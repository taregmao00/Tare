"use server";

import { redirect } from "next/navigation";
import { supabaseServeur } from "@/lib/supabase/serveur";

export interface EtatConnexion {
  erreur: string | null;
  email: string;
}

/** Connexion par email + mot de passe (pas d'inscription : comptes créés par l'administrateur). */
export async function seConnecter(_etat: EtatConnexion, formulaire: FormData): Promise<EtatConnexion> {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "Saisissez votre email et votre mot de passe.", email };
  }

  const supabase = await supabaseServeur();
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });

  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "Email ou mot de passe incorrect."
        : "Connexion impossible pour le moment. Vérifiez le réseau et réessayez.";
    return { erreur: message, email };
  }

  redirect("/");
}

export async function seDeconnecter() {
  const supabase = await supabaseServeur();
  await supabase.auth.signOut();
  redirect("/connexion");
}
