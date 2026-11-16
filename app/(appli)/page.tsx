import { Ecran, ErreurLecture, SansAcces, Vide } from "@/app/_composants/etats";
import { LIBELLES_STATUT, LIBELLES_TYPE } from "@/lib/regles";
import { listerInterventions, type InterventionListee } from "@/lib/supabase/interventions";
import { session } from "@/lib/supabase/utilisateur-courant";

/** Liste des interventions, en lecture seule (filtres, compteurs et actions : phase 2, bloc 2). */
export default function Interventions() {
  return (
    <Ecran>
      <Contenu />
    </Ecran>
  );
}

async function Contenu() {
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const liste = await listerInterventions(supabase);
  const toutesAgences = utilisateur.agence === null;

  return (
    <>
      <h1 className="titre-page">Interventions</h1>

      {!liste.ok ? (
        <ErreurLecture quoi="Interventions" code={liste.code} detail={liste.detail} />
      ) : liste.interventions.length === 0 ? (
        <Vide>
          Aucune intervention pour le moment.
          <br />
          {toutesAgences
            ? "Les demandes de toutes les agences apparaîtront ici."
            : "Les demandes de votre agence apparaîtront ici."}
        </Vide>
      ) : (
        <>
          <p className="discret">
            {liste.interventions.length} intervention{liste.interventions.length > 1 ? "s" : ""} ·{" "}
            {toutesAgences ? "toutes les agences" : utilisateur.agence}
          </p>
          <ul className="liste">
            {liste.interventions.map((intervention) => (
              <CarteIntervention key={intervention.id} intervention={intervention} avecAgence={toutesAgences} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const formatReception = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function CarteIntervention({ intervention: i, avecAgence }: { intervention: InterventionListee; avecAgence: boolean }) {
  return (
    <li className={i.chronoTourne ? "carte carte-intervention chrono-tourne" : "carte carte-intervention"}>
      <div className="ligne-entre">
        <span className="numero">{i.numero}</span>
        <span className="pastilles">
          {i.urgente && <span className="pastille pastille-urgent">Urgent</span>}
          <span className={`pastille pastille-${i.statutAffiche}`}>{LIBELLES_STATUT[i.statutAffiche]}</span>
        </span>
      </div>
      <p className="titre-carte">{i.client}</p>
      <p className="discret">
        {i.site}
        {avecAgence && i.agence && ` · ${i.agence}`}
      </p>
      <p>
        {LIBELLES_TYPE[i.type]}
        {i.instruments.length > 0 && <span className="numero"> · {i.instruments.join(" + ")}</span>}
      </p>
      <p className="ligne-entre pied">
        <span>{i.titulaire ?? "Pas encore prise"}</span>
        <span>Reçue {formatReception.format(i.recueLe)}</span>
      </p>
    </li>
  );
}
