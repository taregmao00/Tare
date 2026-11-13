import type { Metadata } from "next";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { Formulaire } from "@/app/_composants/formulaire";
import { jourParis, limitesEcheanceEnregistrement, peutGererParc } from "@/lib/regles";
import { lireSite } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { creerInstrument } from "../../../../actions";
import { ChampsVignette } from "../../../../champs-vignette";
import { ChampsFicheInstrument } from "../../../../formulaires";

export const metadata: Metadata = { title: "Nouvel instrument · Tare" };

export default function NouvelInstrument(proprietes: PageProps<"/parc/sites/[id]/instruments/nouveau">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

async function Contenu({ params }: PageProps<"/parc/sites/[id]/instruments/nouveau">) {
  const { id } = await params;
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const site = await lireSite(supabase, id);
  if (!site.ok) return <ErreurLecture quoi="Site" code={site.code} detail={site.detail} />;
  const s = site.donnees;
  const fiche = s ? `/parc/clients/${s.clientId}` : "/parc";

  return (
    <>
      <Retour vers={fiche}>{s ? s.client : "Parc"}</Retour>
      <h1 className="titre-page">Nouvel instrument</h1>
      {s === null ? (
        <Vide>Ce site n&apos;existe pas, ou il n&apos;est pas dans votre agence.</Vide>
      ) : !peutGererParc(utilisateur.role) ? (
        <p className="erreur" role="alert">
          Seuls le chef d&apos;agence et l&apos;administrateur peuvent ajouter un instrument au parc.
        </p>
      ) : (
        <>
          <p className="discret">
            Site : {s.nom} · {s.client}. Le numéro INS sera attribué à l&apos;enregistrement.
          </p>
          <Formulaire action={creerInstrument.bind(null, id)} bouton="Ajouter l'instrument" annulerVers={fiche}>
            <ChampsFicheInstrument />
            <ChampsVignette limites={limitesEcheanceEnregistrement(jourParis(new Date()))} />
          </Formulaire>
        </>
      )}
    </>
  );
}
