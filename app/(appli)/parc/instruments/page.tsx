import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Ecran, ErreurLecture, SansAcces, Vide } from "@/app/_composants/etats";
import { jourParis } from "@/lib/regles";
import { listerInstruments } from "@/lib/supabase/parc";
import { session } from "@/lib/supabase/utilisateur-courant";
import { SousOnglets, Vignette } from "../affichage";

export const metadata: Metadata = { title: "Instruments · Tare" };

export default function Instruments(proprietes: PageProps<"/parc/instruments">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

/** Pour chercher sans se soucier des majuscules ni des accents. */
const simplifier = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Tous les instruments de l'agence, avec une recherche par n° d'instrument, client ou n° de série (§7). */
async function Contenu({ searchParams }: PageProps<"/parc/instruments">) {
  const { q } = await searchParams;
  const recherche = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const instruments = await listerInstruments(supabase);
  const aujourdhui = jourParis(new Date());
  const mots = simplifier(recherche).split(/\s+/).filter(Boolean);
  const trouves = instruments.ok
    ? instruments.donnees.filter((i) => {
        const fiche = simplifier(`${i.numero} ${i.numeroSerie} ${i.client} ${i.site} ${i.type} ${i.marque} ${i.modele}`);
        return mots.every((mot) => fiche.includes(mot));
      })
    : [];

  return (
    <>
      <h1 className="titre-page">Parc</h1>
      <SousOnglets actif="instruments" />

      <Form action="/parc/instruments" className="recherche" role="search">
        <label>
          <span>Rechercher un n° d&apos;instrument, un client, un n° de série</span>
          <span className="recherche-ligne">
            <input type="search" name="q" defaultValue={recherche} placeholder="Ex. : INS-0421 ou Ferrand" autoComplete="off" />
            <button type="submit" className="bouton-action">
              Chercher
            </button>
          </span>
        </label>
      </Form>

      {!instruments.ok ? (
        <ErreurLecture quoi="Instruments" code={instruments.code} detail={instruments.detail} />
      ) : instruments.donnees.length === 0 ? (
        <Vide>
          Aucun instrument pour le moment.
          <br />
          Ils s&apos;ajoutent depuis la fiche d&apos;un client, sur l&apos;un de ses sites.
        </Vide>
      ) : trouves.length === 0 ? (
        <Vide>
          Aucun instrument ne correspond à « {recherche} ».
          <br />
          <Link href="/parc/instruments">Voir tous les instruments</Link>
        </Vide>
      ) : (
        <>
          <p className="discret">
            {trouves.length} instrument{trouves.length > 1 ? "s" : ""}
            {recherche && ` pour « ${recherche} »`}
            {recherche && (
              <>
                {" · "}
                <Link href="/parc/instruments">tout afficher</Link>
              </>
            )}
          </p>
          <ul className="liste">
            {trouves.map((i) => (
              <li key={i.id}>
                <Link href={`/parc/instruments/${i.id}`} className="carte carte-lien">
                  <span>
                    <span className="numero">{i.numero}</span> <span className="titre-carte">{i.type}</span>
                  </span>
                  <span className="discret">
                    {i.marque} {i.modele} · n° {i.numeroSerie}
                  </span>
                  <span className="discret">
                    {i.client} · {i.site}
                  </span>
                  <Vignette statut={i.statut} echeance={i.echeance} aujourdhui={aujourdhui} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
