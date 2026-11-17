import type { Metadata } from "next";
import { Ecran, SansAcces } from "@/app/_composants/etats";
import { seDeconnecter } from "@/app/connexion/actions";
import { Champ, Formulaire } from "@/app/_composants/formulaire";
import { LIBELLE_REFERENCE_PAR_DEFAUT, LIBELLES_ROLE, peutModifierReglages } from "@/lib/regles";
import { libelleReference, session } from "@/lib/supabase/utilisateur-courant";
import { modifierLibelleReference } from "./actions";

export const metadata: Metadata = { title: "Réglages · Tare" };

/**
 * Pour l'instant : le compte connecté, le nom du champ « référence externe » (administrateur)
 * et la déconnexion. Tarifs, forfaits et catalogue : bloc 11.
 */
export default function Reglages(proprietes: PageProps<"/reglages">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

async function Contenu({ searchParams }: PageProps<"/reglages">) {
  const { enregistre } = await searchParams;
  const { utilisateur } = await session();
  const utilisable = utilisateur !== null && utilisateur !== "sans_fiche";
  const libelle = utilisable ? await libelleReference() : LIBELLE_REFERENCE_PAR_DEFAUT;

  return (
    <>
      <h1 className="titre-page">Réglages</h1>
      {utilisable ? (
        <section className="carte" aria-label="Mon compte">
          <p>
            <strong>{utilisateur.nom}</strong>
          </p>
          <p className="discret">{utilisateur.email}</p>
          <p>
            {LIBELLES_ROLE[utilisateur.role]}
            {utilisateur.habiliteVerifications && " · habilité vérifications"}
          </p>
          <p className="discret">
            {utilisateur.entreprise} · {utilisateur.agence ?? "toutes les agences"}
          </p>
        </section>
      ) : (
        <SansAcces connecte={utilisateur !== null} />
      )}

      {utilisable && peutModifierReglages(utilisateur.role) && (
        <section aria-label="Référence externe des interventions">
          <h2 className="titre-section">Référence externe des interventions</h2>
          <p className="discret">
            Le numéro qui rattache une intervention à vos commandes et factures. Choisissez le nom que vos équipes
            connaissent : « N° de message », « N° d&apos;OS », « N° de dossier »…
          </p>
          {enregistre && (
            <p className="succes" role="status">
              Enregistré.
            </p>
          )}
          <Formulaire action={modifierLibelleReference} bouton="Enregistrer le nom" valeurs={{ libelle_reference_externe: libelle }}>
            <Champ nom="libelle_reference_externe" libelle="Nom affiché du champ" aide="40 caractères au plus." />
          </Formulaire>
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
