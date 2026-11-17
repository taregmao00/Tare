import type { Metadata } from "next";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { Formulaire } from "@/app/_composants/formulaire";
import { peutSaisirReference } from "@/lib/regles";
import { lireIntervention } from "@/lib/supabase/interventions";
import { libelleReference, session } from "@/lib/supabase/utilisateur-courant";
import { enregistrerReference } from "../../actions";
import { ChampReference } from "./champ-reference";

export const metadata: Metadata = { title: "Référence · Tare" };

export default function SaisieReference(proprietes: PageProps<"/interventions/[id]/reference">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

async function Contenu({ params }: PageProps<"/interventions/[id]/reference">) {
  const { id } = await params;
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const [intervention, libelle] = await Promise.all([lireIntervention(supabase, id), libelleReference()]);
  if (!intervention.ok) return <ErreurLecture quoi="Intervention" code={intervention.code} detail={intervention.detail} />;
  const i = intervention.donnees;
  const fiche = `/interventions/${id}`;

  return (
    <>
      <Retour vers={i ? fiche : "/"}>{i ? i.numero : "Interventions"}</Retour>
      <h1 className="titre-page">{libelle}</h1>
      {i === null ? (
        <Vide>Cette intervention n&apos;existe pas, ou elle n&apos;est pas dans votre agence.</Vide>
      ) : !peutSaisirReference(utilisateur.role) ? (
        <p className="erreur" role="alert">
          Le gestionnaire consulte ce champ sans le modifier.
        </p>
      ) : i.statut === "facturee" ? (
        <p className="erreur" role="alert">
          Cette intervention est « Facturée » : sa {libelle.toLowerCase()} ne se modifie plus.
        </p>
      ) : (
        <>
          <p className="discret">
            {i.numero} · {i.client} · {i.site}
          </p>
          <Formulaire
            action={enregistrerReference.bind(null, id)}
            bouton="Enregistrer"
            annulerVers={fiche}
            valeurs={{ reference: i.reference ?? "" }}
          >
            <ChampReference libelle={libelle} interventionId={id} />
          </Formulaire>
        </>
      )}
    </>
  );
}
