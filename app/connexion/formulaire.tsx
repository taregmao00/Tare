"use client";

import { useActionState } from "react";
import { unstable_rethrow } from "next/navigation";
import { MESSAGES_CONNEXION } from "@/lib/supabase/erreurs-connexion";
import { seConnecter, type EtatConnexion } from "./actions";

const etatInitial: EtatConnexion = { erreur: null, email: "" };

/**
 * Appelle le serveur, et traite ici le seul cas que le serveur ne peut pas voir :
 * le téléphone n'a pas de réseau, la demande n'est donc jamais partie (ou jamais arrivée).
 */
async function seConnecterAvecReseau(etat: EtatConnexion, formulaire: FormData): Promise<EtatConnexion> {
  const email = String(formulaire.get("email") ?? "").trim();
  if (!navigator.onLine) return { erreur: MESSAGES_CONNEXION.reseau, email };
  try {
    return await seConnecter(etat, formulaire);
  } catch (erreur) {
    unstable_rethrow(erreur); // la redirection après une connexion réussie passe par ici
    return { erreur: MESSAGES_CONNEXION.reseau, email };
  }
}

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(seConnecterAvecReseau, etatInitial);

  return (
    <form action={action} className="formulaire">
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          defaultValue={etat.email}
          required
        />
      </label>
      <label>
        Mot de passe
        <input type="password" name="mot_de_passe" autoComplete="current-password" required />
      </label>
      {etat.erreur && (
        <p className="erreur" role="alert">
          {etat.erreur}
        </p>
      )}
      <button type="submit" className="bouton-principal" disabled={enCours}>
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
