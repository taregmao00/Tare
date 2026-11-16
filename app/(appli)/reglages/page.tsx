import type { Metadata } from "next";
import { Ecran, SansAcces } from "@/app/_composants/etats";
import { seDeconnecter } from "@/app/connexion/actions";
import { LIBELLES_ROLE } from "@/lib/regles";
import { session } from "@/lib/supabase/utilisateur-courant";

export const metadata: Metadata = { title: "Réglages · Tare" };

/** Pour l'instant : le compte connecté et la déconnexion. Tarifs, forfaits et catalogue : bloc 11. */
export default function Reglages() {
  return (
    <Ecran>
      <Contenu />
    </Ecran>
  );
}

async function Contenu() {
  const { utilisateur } = await session();
  const utilisable = utilisateur !== null && utilisateur !== "sans_fiche";

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
      <form action={seDeconnecter}>
        <button type="submit" className="bouton-secondaire">
          Se déconnecter
        </button>
      </form>
    </>
  );
}
