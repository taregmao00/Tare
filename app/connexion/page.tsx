import type { Metadata } from "next";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion · Tare" };

export default function Connexion() {
  return (
    <main className="page-etroite">
      <h1 className="titre-appli">Tare</h1>
      <p>Connectez-vous avec le compte fourni par votre entreprise.</p>
      <FormulaireConnexion />
      <p className="discret">Pas de compte ? Demandez-le à l&apos;administrateur de votre entreprise.</p>
    </main>
  );
}
