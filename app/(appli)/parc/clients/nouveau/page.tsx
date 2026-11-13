import type { Metadata } from "next";
import { Ecran, ErreurLecture, Retour, SansAcces } from "@/app/_composants/etats";
import { Formulaire } from "@/app/_composants/formulaire";
import { peutGererParc } from "@/lib/regles";
import { listerAgences } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { creerClient } from "../../actions";
import { ChampsClient } from "../../formulaires";

export const metadata: Metadata = { title: "Nouveau client · Tare" };

export default function NouveauClient() {
  return (
    <Ecran>
      <Contenu />
    </Ecran>
  );
}

async function Contenu() {
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  // Un administrateur choisit l'agence du client ; un chef d'agence crée toujours dans la sienne.
  const agences = utilisateur.role === "administrateur" ? await listerAgences(supabase) : null;

  return (
    <>
      <Retour vers="/parc">Parc</Retour>
      <h1 className="titre-page">Nouveau client</h1>
      {!peutGererParc(utilisateur.role) ? (
        <p className="erreur" role="alert">
          Seuls le chef d&apos;agence et l&apos;administrateur peuvent créer un client.
        </p>
      ) : agences && !agences.ok ? (
        <ErreurLecture quoi="Agences" code={agences.code} detail={agences.detail} />
      ) : (
        <Formulaire
          action={creerClient}
          bouton="Créer le client"
          annulerVers="/parc"
          valeurs={utilisateur.agenceId ? { agence_id: utilisateur.agenceId } : {}}
        >
          <ChampsClient agences={agences?.donnees} />
        </Formulaire>
      )}
    </>
  );
}
