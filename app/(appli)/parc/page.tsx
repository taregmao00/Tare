import type { Metadata } from "next";
import Link from "next/link";
import { Ecran, ErreurLecture, SansAcces, Vide } from "@/app/_composants/etats";
import { peutGererParc } from "@/lib/regles";
import { listerClients } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";

export const metadata: Metadata = { title: "Parc · Tare" };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Parc : les clients de l'agence (échéances, recherche et fiches instrument : séances suivantes). */
export default function Parc() {
  return (
    <Ecran>
      <Contenu />
    </Ecran>
  );
}

async function Contenu() {
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const clients = await listerClients(supabase);
  const toutesAgences = utilisateur.agence === null;
  const gere = peutGererParc(utilisateur.role);

  return (
    <>
      <div className="ligne-entre">
        <h1 className="titre-page">Parc</h1>
        {gere && (
          <Link href="/parc/clients/nouveau" className="bouton-action">
            + Nouveau client
          </Link>
        )}
      </div>

      {!clients.ok ? (
        <ErreurLecture quoi="Clients" code={clients.code} detail={clients.detail} />
      ) : clients.donnees.length === 0 ? (
        <Vide>
          Aucun client pour le moment.
          <br />
          {gere ? "Créez le premier avec « + Nouveau client »." : "Ils sont créés par le chef d'agence."}
        </Vide>
      ) : (
        <>
          <p className="discret">
            {pluriel(clients.donnees.length, "client")} · {toutesAgences ? "toutes les agences" : utilisateur.agence}
          </p>
          <ul className="liste">
            {clients.donnees.map((c) => (
              <li key={c.id}>
                <Link href={`/parc/clients/${c.id}`} className="carte carte-lien">
                  <span className="ligne-entre">
                    <span className="titre-carte">{c.nom}</span>
                    {c.critique && <span className="pastille pastille-critique">Critique</span>}
                  </span>
                  <span className="discret">
                    {pluriel(c.nombreSites, "site")} · {pluriel(c.nombreInstruments, "instrument")}
                    {toutesAgences && c.agence && ` · ${c.agence}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
