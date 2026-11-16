import type { Metadata } from "next";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { Formulaire } from "@/app/_composants/formulaire";
import { peutGererParc } from "@/lib/regles";
import { lireClient } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { modifierClient } from "../../../actions";
import { ChampsClient } from "../../../formulaires";

export const metadata: Metadata = { title: "Modifier le client · Tare" };

export default function ModifierClient(proprietes: PageProps<"/parc/clients/[id]/modifier">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

async function Contenu({ params }: PageProps<"/parc/clients/[id]/modifier">) {
  const { id } = await params;
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const client = await lireClient(supabase, id);
  if (!client.ok) return <ErreurLecture quoi="Client" code={client.code} detail={client.detail} />;
  const c = client.donnees;
  const fiche = `/parc/clients/${id}`;

  return (
    <>
      <Retour vers={c ? fiche : "/parc"}>{c ? c.nom : "Parc"}</Retour>
      <h1 className="titre-page">Modifier le client</h1>
      {c === null ? (
        <Vide>Ce client n&apos;existe pas, ou il n&apos;est pas dans votre agence.</Vide>
      ) : !peutGererParc(utilisateur.role) ? (
        <p className="erreur" role="alert">
          Seuls le chef d&apos;agence et l&apos;administrateur peuvent modifier un client.
        </p>
      ) : (
        <Formulaire
          action={modifierClient.bind(null, id)}
          bouton="Enregistrer"
          annulerVers={fiche}
          valeurs={{ nom: c.nom, critique: String(c.critique), note: c.note ?? "" }}
        >
          <ChampsClient />
        </Formulaire>
      )}
    </>
  );
}
