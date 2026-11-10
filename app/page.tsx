import { Suspense } from "react";
import { LIBELLES_STATUT, LIBELLES_TYPE } from "@/lib/regles";
import { listerInterventions, type InterventionListee } from "@/lib/supabase/interventions";
import { supabaseServeur } from "@/lib/supabase/serveur";
import { LIBELLES_ROLE, utilisateurCourant } from "@/lib/supabase/utilisateur-courant";
import { seDeconnecter } from "./connexion/actions";

export default function Accueil() {
  return (
    <>
      <header className="entete">
        <div className="entete-contenu">
          <span className="titre-appli">Tare</span>
          <form action={seDeconnecter}>
            <button type="submit" className="bouton-discret">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <main className="page">
        <Suspense fallback={<p className="discret">Chargement…</p>}>
          <Interventions />
        </Suspense>
      </main>
    </>
  );
}

/** Liste des interventions, en lecture seule (filtres, compteurs et actions : phase 2). */
async function Interventions() {
  const supabase = await supabaseServeur();
  const utilisateur = await utilisateurCourant(supabase);

  if (utilisateur === null) {
    return (
      <p>
        Vous n&apos;êtes pas connecté. <a href="/connexion">Se connecter</a>
      </p>
    );
  }
  if (utilisateur === "sans_fiche") {
    return (
      <p className="erreur" role="alert">
        Votre compte n&apos;est rattaché à aucune entreprise, ou il est désactivé. Contactez
        l&apos;administrateur de votre entreprise.
      </p>
    );
  }

  const liste = await listerInterventions(supabase);
  const toutesAgences = utilisateur.agence === null;

  return (
    <>
      <section className="carte" aria-label="Utilisateur connecté">
        <p>
          <strong>{utilisateur.nom}</strong> · {LIBELLES_ROLE[utilisateur.role]}
          {utilisateur.habiliteVerifications && " · habilité vérifications"}
        </p>
        <p className="discret">
          {utilisateur.entreprise} · {utilisateur.agence ?? "toutes les agences"}
        </p>
      </section>

      <h1 className="titre-page">Interventions</h1>

      {!liste.ok ? (
        <ErreurLecture code={liste.code} detail={liste.detail} />
      ) : liste.interventions.length === 0 ? (
        <p className="vide">
          Aucune intervention pour le moment.
          <br />
          {toutesAgences
            ? "Les demandes de toutes les agences apparaîtront ici."
            : "Les demandes de votre agence apparaîtront ici."}
        </p>
      ) : (
        <>
          <p className="discret">
            {liste.interventions.length} intervention{liste.interventions.length > 1 ? "s" : ""} ·{" "}
            {toutesAgences ? "toutes les agences" : utilisateur.agence}
          </p>
          <ul className="liste-interventions">
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
      <p className="client">{i.client}</p>
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

function ErreurLecture({ code, detail }: { code: string; detail: string }) {
  // Le détail technique va dans le terminal du serveur, pas sur l'écran du technicien.
  console.error(`[interventions] Lecture impossible (${code}) : ${detail}`);
  return (
    <p className="erreur" role="alert">
      Les interventions n&apos;ont pas pu être lues.{" "}
      {code === "42501"
        ? "La base de données n'est pas à jour : prévenez l'administrateur."
        : "Vérifiez le réseau et rechargez la page ; si cela dure, prévenez l'administrateur."}{" "}
      <span className="discret">(code {code})</span>
    </p>
  );
}
