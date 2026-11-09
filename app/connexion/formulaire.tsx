"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "./actions";

const etatInitial: EtatConnexion = { erreur: null, email: "" };

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(seConnecter, etatInitial);

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
