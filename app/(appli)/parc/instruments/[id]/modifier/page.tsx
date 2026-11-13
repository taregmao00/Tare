import type { Metadata } from "next";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { Formulaire } from "@/app/_composants/formulaire";
import { jourParis, peutGererParc } from "@/lib/regles";
import { lireInstrument } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { modifierInstrument } from "../../../actions";
import { Vignette } from "../../../affichage";
import { ChampsFicheInstrument } from "../../../formulaires";

export const metadata: Metadata = { title: "Modifier l'instrument · Tare" };

export default function ModifierInstrument(proprietes: PageProps<"/parc/instruments/[id]/modifier">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

async function Contenu({ params }: PageProps<"/parc/instruments/[id]/modifier">) {
  const { id } = await params;
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const instrument = await lireInstrument(supabase, id);
  if (!instrument.ok) return <ErreurLecture quoi="Instrument" code={instrument.code} detail={instrument.detail} />;
  const i = instrument.donnees;
  const fiche = `/parc/instruments/${id}`;

  return (
    <>
      <Retour vers={i ? fiche : "/parc/instruments"}>{i ? i.numero : "Instruments"}</Retour>
      <h1 className="titre-page">Modifier la fiche</h1>
      {i === null ? (
        <Vide>Cet instrument n&apos;existe pas, ou il n&apos;est pas dans votre agence.</Vide>
      ) : !peutGererParc(utilisateur.role) ? (
        <p className="erreur" role="alert">
          Seuls le chef d&apos;agence et l&apos;administrateur peuvent modifier un instrument.
        </p>
      ) : (
        <>
          <section className="carte" aria-label="Métrologie légale">
            <Vignette statut={i.statut} echeance={i.echeance} aujourdhui={jourParis(new Date())} />
            <p className="discret">
              La vignette et son échéance ne se modifient pas ici : elles ne changent que par un bon d&apos;intervention signé.
            </p>
          </section>
          <Formulaire
            action={modifierInstrument.bind(null, id)}
            bouton="Enregistrer"
            annulerVers={fiche}
            valeurs={{
              type: i.type,
              marque: i.marque,
              modele: i.modele,
              numero_serie: i.numeroSerie,
              portee_max: i.portee_max,
              echelon: i.echelon,
              millesime: i.millesime === null ? "" : String(i.millesime),
              emplacement: i.emplacement ?? "",
            }}
          >
            <ChampsFicheInstrument />
          </Formulaire>
        </>
      )}
    </>
  );
}
