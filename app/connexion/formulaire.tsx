"use client";

import { Champ, Formulaire } from "@/app/_composants/formulaire";
import { seConnecter } from "./actions";

export function FormulaireConnexion() {
  return (
    <Formulaire action={seConnecter} bouton="Se connecter" boutonEnCours="Connexion…">
      <Champ nom="email" libelle="Email" type="email" inputMode="email" autoComplete="username" />
      <Champ nom="mot_de_passe" libelle="Mot de passe" type="password" autoComplete="current-password" />
    </Formulaire>
  );
}
