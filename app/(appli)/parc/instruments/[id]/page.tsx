import type { Metadata } from "next";
import Link from "next/link";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { jourParis, LIBELLES_STATUT, LIBELLES_TYPE, peutGererParc } from "@/lib/regles";
import { lireInstrument } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { Vignette } from "../../affichage";

export const metadata: Metadata = { title: "Instrument · Tare" };

export default function FicheInstrument(proprietes: PageProps<"/parc/instruments/[id]">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" });

async function Contenu({ params }: PageProps<"/parc/instruments/[id]">) {
  const { id } = await params;
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const instrument = await lireInstrument(supabase, id);
  if (!instrument.ok) return <ErreurLecture quoi="Instrument" code={instrument.code} detail={instrument.detail} />;
  if (instrument.donnees === null) {
    return (
      <>
        <Retour vers="/parc/instruments">Instruments</Retour>
        <Vide>Cet instrument n&apos;existe pas, ou il n&apos;est pas dans votre agence.</Vide>
      </>
    );
  }

  const i = instrument.donnees;
  const gere = peutGererParc(utilisateur.role);

  return (
    <>
      <Retour vers={`/parc/clients/${i.clientId}`}>{i.client}</Retour>
      <p className="numero">{i.numero}</p>
      <h1 className="titre-page">{i.type}</h1>
      <p className="discret">
        {i.marque} {i.modele}
      </p>

      <section className="carte" aria-label="Métrologie légale">
        <Vignette statut={i.statut} echeance={i.echeance} aujourdhui={jourParis(new Date())} />
        {i.motifStatut && <p>{i.motifStatut}</p>}
        <p className="discret">La vignette ne change que par un bon d&apos;intervention signé.</p>
      </section>

      {i.memeNumeroSerie.length > 0 && (
        <p className="avertissement" role="note">
          Double possible : le n° de série {i.numeroSerie} est aussi celui de{" "}
          {i.memeNumeroSerie.map((d, rang) => (
            <span key={d.id}>
              {rang > 0 && ", "}
              <Link href={`/parc/instruments/${d.id}`}>{d.numero}</Link>
            </span>
          ))}
          . Vérifiez qu&apos;il ne s&apos;agit pas du même instrument.
        </p>
      )}

      <dl className="fiche">
        <dt>N° de série</dt>
        <dd>{i.numeroSerie}</dd>
        <dt>Portée (Max)</dt>
        <dd>{i.portee_max}</dd>
        <dt>Échelon (e)</dt>
        <dd>{i.echelon}</dd>
        <dt>Millésime</dt>
        <dd>{i.millesime ?? "Non renseigné"}</dd>
        <dt>Emplacement</dt>
        <dd>{i.emplacement ?? "Non renseigné"}</dd>
        <dt>Site</dt>
        <dd>
          {i.site} · <Link href={`/parc/clients/${i.clientId}`}>{i.client}</Link>
        </dd>
      </dl>

      {gere && (
        <Link href={`/parc/instruments/${i.id}/modifier`} className="bouton-secondaire">
          Modifier la fiche
        </Link>
      )}

      <h2 className="titre-section">Historique</h2>
      {i.interventions.length === 0 ? (
        <Vide>Aucune intervention sur cet instrument pour le moment.</Vide>
      ) : (
        <ul className="liste">
          {i.interventions.map((intervention) => (
            <li key={intervention.id} className="carte">
              <div className="ligne-entre">
                <span>
                  <span className="numero">{intervention.numero}</span> {LIBELLES_TYPE[intervention.type]}
                </span>
                <span className={`pastille pastille-${intervention.statut}`}>{LIBELLES_STATUT[intervention.statut]}</span>
              </div>
              <p className="discret">Reçue le {formatJour.format(intervention.recueLe)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
