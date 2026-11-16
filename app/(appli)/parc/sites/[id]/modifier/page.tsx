import type { Metadata } from "next";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { Formulaire } from "@/app/_composants/formulaire";
import { peutGererParc } from "@/lib/regles";
import { lireSite } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { modifierSite } from "../../../actions";
import { ChampsSite } from "../../../formulaires";

export const metadata: Metadata = { title: "Modifier le site · Tare" };

export default function ModifierSite(proprietes: PageProps<"/parc/sites/[id]/modifier">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

async function Contenu({ params }: PageProps<"/parc/sites/[id]/modifier">) {
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
      <h1 className="titre-page">Modifier le site</h1>
      {s === null ? (
        <Vide>Ce site n&apos;existe pas, ou il n&apos;est pas dans votre agence.</Vide>
      ) : !peutGererParc(utilisateur.role) ? (
        <p className="erreur" role="alert">
          Seuls le chef d&apos;agence et l&apos;administrateur peuvent modifier un site.
        </p>
      ) : (
        <Formulaire
          action={modifierSite.bind(null, id, s.clientId)}
          bouton="Enregistrer"
          annulerVers={fiche}
          valeurs={{
            nom: s.nom,
            adresse: s.adresse ?? "",
            distance_km: String(s.distance_km),
            contact_nom: s.contact_nom ?? "",
            contact_fonction: s.contact_fonction ?? "",
            contact_telephone: s.contact_telephone ?? "",
            contact_email: s.contact_email ?? "",
          }}
        >
          <ChampsSite />
        </Formulaire>
      )}
    </>
  );
}
