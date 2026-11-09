import { Suspense } from "react";
import { seDeconnecter } from "./connexion/actions";
import { LIBELLES_ROLE, utilisateurCourant } from "@/lib/supabase/utilisateur-courant";

export default function Accueil() {
  return (
    <main className="page-etroite">
      <h1 className="titre-appli">Tare</h1>
      <Suspense fallback={<p className="discret">Chargement…</p>}>
        <CarteUtilisateur />
      </Suspense>
    </main>
  );
}

async function CarteUtilisateur() {
  const utilisateur = await utilisateurCourant();

  return (
    <>
      {utilisateur === null ? (
        <p>Vous n&apos;êtes pas connecté.</p>
      ) : utilisateur === "sans_fiche" ? (
        <p className="erreur" role="alert">
          Votre compte n&apos;est rattaché à aucune entreprise, ou il est désactivé. Contactez
          l&apos;administrateur de votre entreprise.
        </p>
      ) : (
        <section className="carte">
          <p>
            Connecté en tant que <strong>{utilisateur.nom}</strong>
          </p>
          <p className="discret">
            {LIBELLES_ROLE[utilisateur.role]}
            {utilisateur.habiliteVerifications && " · habilité vérifications"}
          </p>
          <p className="discret">
            {utilisateur.entreprise}
            {utilisateur.agence ? ` · ${utilisateur.agence}` : " · toutes les agences"}
          </p>
        </section>
      )}
      <form action={seDeconnecter}>
        <button type="submit" className="bouton-secondaire">
          Se déconnecter
        </button>
      </form>
    </>
  );
}
