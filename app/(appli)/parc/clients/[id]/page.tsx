import type { Metadata } from "next";
import Link from "next/link";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { forfaitDeplacement, formaterEuros, jourParis, peutGererParc, type ReglagesDeplacement } from "@/lib/regles";
import { lireClient, lireReglagesDeplacement, type SiteDetail } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { Vignette } from "../../affichage";

export const metadata: Metadata = { title: "Client · Tare" };

export default function FicheClient(proprietes: PageProps<"/parc/clients/[id]">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

async function Contenu({ params }: PageProps<"/parc/clients/[id]">) {
  const { id } = await params;
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const [client, reglages] = await Promise.all([lireClient(supabase, id), lireReglagesDeplacement(supabase)]);
  if (!client.ok) return <ErreurLecture quoi="Client" code={client.code} detail={client.detail} />;
  if (client.donnees === null) {
    return (
      <>
        <Retour vers="/parc">Parc</Retour>
        <Vide>Ce client n&apos;existe pas, ou il n&apos;est pas dans votre agence.</Vide>
      </>
    );
  }

  const c = client.donnees;
  const gere = peutGererParc(utilisateur.role);
  const aujourdhui = jourParis(new Date());

  return (
    <>
      <Retour vers="/parc">Parc</Retour>
      <div className="ligne-entre">
        <h1 className="titre-page">{c.nom}</h1>
        {c.critique && <span className="pastille pastille-critique">Critique</span>}
      </div>
      <p className="discret">{c.agence}</p>
      {c.note && <p>{c.note}</p>}
      {gere && (
        <Link href={`/parc/clients/${c.id}/modifier`} className="bouton-secondaire">
          Modifier le client
        </Link>
      )}

      <div className="ligne-entre">
        <h2 className="titre-section">
          {c.sites.length} site{c.sites.length > 1 ? "s" : ""}
        </h2>
        {gere && (
          <Link href={`/parc/clients/${c.id}/sites/nouveau`} className="bouton-action">
            + Ajouter un site
          </Link>
        )}
      </div>

      {c.sites.length === 0 ? (
        <Vide>
          Aucun site pour ce client.
          <br />
          {gere
            ? "Ajoutez le premier : c'est sur un site que l'on place les instruments."
            : "Ils sont créés par le chef d'agence."}
        </Vide>
      ) : (
        <ul className="liste">
          {c.sites.map((site) => (
            <CarteSite
              key={site.id}
              site={site}
              reglages={reglages.ok ? reglages.donnees : null}
              gere={gere}
              aujourdhui={aujourdhui}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function CarteSite({
  site,
  reglages,
  gere,
  aujourdhui,
}: {
  site: SiteDetail;
  reglages: ReglagesDeplacement | null;
  gere: boolean;
  aujourdhui: string;
}) {
  const forfait = reglages ? forfaitDeplacement(site.distance_km, reglages) : null;
  const contact = [site.contact_nom, site.contact_fonction].filter(Boolean).join(" · ");

  return (
    <li className="carte">
      <p className="titre-carte">{site.nom}</p>
      {site.adresse && <p className="discret">{site.adresse}</p>}
      <p>
        {site.distance_km} km
        {forfait && (
          <span className="discret">
            {" "}
            · forfait {formaterEuros(forfait.montantCentimes)} HT ({forfait.libelleZone.toLowerCase()})
          </span>
        )}
      </p>
      {contact && <p>{contact}</p>}
      {site.contact_telephone && (
        <p>
          <a href={`tel:${site.contact_telephone.replace(/\s/g, "")}`} className="lien-tactile">
            {site.contact_telephone}
          </a>
        </p>
      )}
      {site.contact_email && <p className="discret">{site.contact_email}</p>}

      {site.instruments.length === 0 ? (
        <p className="discret">Aucun instrument sur ce site.</p>
      ) : (
        <ul className="sous-liste">
          {site.instruments.map((i) => (
            <li key={i.id}>
              <Link href={`/parc/instruments/${i.id}`} className="ligne-lien">
                <span>
                  <span className="numero">{i.numero}</span> {i.type}
                  <span className="discret">
                    {" "}
                    · {i.marque} {i.modele}
                  </span>
                </span>
                <Vignette statut={i.statut} echeance={i.echeance} aujourdhui={aujourdhui} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {gere && (
        <Link href={`/parc/sites/${site.id}/instruments/nouveau`} className="bouton-secondaire">
          + Ajouter un instrument
        </Link>
      )}
      {gere && (
        <Link href={`/parc/sites/${site.id}/modifier`} className="bouton-secondaire">
          Modifier le site
        </Link>
      )}
    </li>
  );
}
