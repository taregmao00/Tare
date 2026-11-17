import type { Metadata } from "next";
import Link from "next/link";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { formaterEuros, jourParis, LIBELLES_STATUT, LIBELLES_TYPE, peutSaisirReference } from "@/lib/regles";
import { lireIntervention } from "@/lib/supabase/interventions";
import { libelleReference, session } from "@/lib/supabase/utilisateur-courant";
import { Vignette } from "../../parc/affichage";

export const metadata: Metadata = { title: "Intervention · Tare" };

export default function FicheIntervention(proprietes: PageProps<"/interventions/[id]">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const duree = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")}` : ""}`);

/**
 * Fiche d'une intervention, en lecture seule : les actions (prendre, chrono, bon) viendront avec
 * les blocs 2 à 5. Seule la référence externe se modifie déjà ici.
 */
async function Contenu({ params }: PageProps<"/interventions/[id]">) {
  const { id } = await params;
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const [intervention, libelle] = await Promise.all([lireIntervention(supabase, id), libelleReference()]);
  if (!intervention.ok) return <ErreurLecture quoi="Intervention" code={intervention.code} detail={intervention.detail} />;
  const i = intervention.donnees;
  if (i === null) {
    return (
      <>
        <Retour vers="/">Interventions</Retour>
        <Vide>Cette intervention n&apos;existe pas, ou elle n&apos;est pas dans votre agence.</Vide>
      </>
    );
  }

  const modifiable = peutSaisirReference(utilisateur.role) && i.statut !== "facturee";
  const aujourdhui = jourParis(new Date());

  return (
    <>
      <Retour vers="/">Interventions</Retour>
      <div className="ligne-entre">
        <span className="numero">{i.numero}</span>
        <span className="pastilles">
          {i.urgente && <span className="pastille pastille-urgent">Urgent</span>}
          <span className={`pastille pastille-${i.statutAffiche}`}>{LIBELLES_STATUT[i.statutAffiche]}</span>
        </span>
      </div>
      <h1 className="titre-page">
        {LIBELLES_TYPE[i.type]} · {i.client}
      </h1>
      {i.description && <p>{i.description}</p>}

      <section className="carte" aria-label={libelle}>
        <div className="ligne-entre">
          <span className="discret">{libelle}</span>
          {modifiable && (
            <Link href={`/interventions/${i.id}/reference`} className="lien-tactile">
              {i.reference ? "Modifier" : "Ajouter"}
            </Link>
          )}
        </div>
        {i.reference ? (
          <p>
            <Link href={`/references?r=${encodeURIComponent(i.reference)}`} className="reference">
              {i.reference}
            </Link>
          </p>
        ) : (
          <p className="discret">Non renseignée</p>
        )}
      </section>

      <dl className="fiche">
        <dt>Client</dt>
        <dd>
          <Link href={`/parc/clients/${i.clientId}`}>{i.client}</Link>
        </dd>
        <dt>Site</dt>
        <dd>
          {i.site} · {i.distanceKm} km
        </dd>
        {i.agence && (
          <>
            <dt>Agence</dt>
            <dd>{i.agence}</dd>
          </>
        )}
        <dt>Titulaire</dt>
        <dd>{i.titulaire ?? "Pas encore prise"}</dd>
        <dt>Reçue</dt>
        <dd>{formatDate.format(i.recueLe)}</dd>
        {i.dureeEstimeeMinutes !== null && (
          <>
            <dt>Durée estimée</dt>
            <dd>{duree(i.dureeEstimeeMinutes)}</dd>
          </>
        )}
        <dt>Personnes prévues</dt>
        <dd>{i.nombrePersonnesPrevu}</dd>
      </dl>

      <h2 className="titre-section">Instruments</h2>
      {i.instrumentsDetail.length === 0 ? (
        <Vide>Aucun instrument rattaché à cette intervention.</Vide>
      ) : (
        <ul className="sous-liste">
          {i.instrumentsDetail.map((ins) => (
            <li key={ins.id}>
              <Link href={`/parc/instruments/${ins.id}`} className="ligne-lien">
                <span>
                  <span className="numero">{ins.numero}</span> {ins.type}
                </span>
                <Vignette statut={ins.statut} echeance={ins.echeance} aujourdhui={aujourdhui} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {i.bons.length > 0 && (
        <>
          <h2 className="titre-section">Bons signés</h2>
          <ul className="liste">
            {i.bons.map((b) => (
              <li key={b.referenceProvisoire} className={b.statut === "valide" ? "carte" : "carte barre"}>
                <div className="ligne-entre">
                  <span className="numero">{b.numero ?? "Numéro attribué à l'envoi"}</span>
                  <span>{formaterEuros(b.totalHtCentimes)} HT</span>
                </div>
                <p className="discret">
                  Signé {formatDate.format(b.signeLe)}
                  {b.statut === "annule_remplace" && " · annulé et remplacé"}
                  {b.statut === "refuse" && " · rectificatif refusé"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="titre-section">Journal</h2>
      {i.journal.length === 0 ? (
        <Vide>Rien n&apos;est encore écrit au journal.</Vide>
      ) : (
        <ol className="journal">
          {i.journal.map((j) => (
            <li key={j.id}>
              <span className="discret">
                {formatDate.format(j.horodatage)} · {j.auteur ?? "Tare"}
              </span>
              <span>{j.texte}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
