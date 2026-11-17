import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Ecran, ErreurLecture, Retour, SansAcces, Vide } from "@/app/_composants/etats";
import { formaterEuros, LIBELLES_STATUT, LIBELLES_TYPE } from "@/lib/regles";
import { lireReference } from "@/lib/supabase/references";
import { libelleReference, session } from "@/lib/supabase/utilisateur-courant";

export const metadata: Metadata = { title: "Recherche par référence · Tare" };

export default function VueReference(proprietes: PageProps<"/references">) {
  return (
    <Ecran>
      <Contenu {...proprietes} />
    </Ecran>
  );
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" });

/** Heures facturées, à la française : 390 → « 6 h 30 ». */
function heures(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

/**
 * Toutes les interventions qui portent une référence externe, avec le total de main-d'œuvre
 * facturable. Arrondi à la demi-heure intervention par intervention, puis additionné.
 */
async function Contenu({ searchParams }: PageProps<"/references">) {
  const { r } = await searchParams;
  const recherche = (Array.isArray(r) ? r[0] : r)?.trim() ?? "";
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  const libelle = await libelleReference();
  const vue = recherche ? await lireReference(supabase, recherche) : null;
  const toutesAgences = utilisateur.agence === null;

  return (
    <>
      <Retour vers="/">Interventions</Retour>
      <h1 className="titre-page">Recherche par {libelle.toLowerCase()}</h1>

      <Form action="/references" className="recherche" role="search">
        <label>
          <span>{libelle}</span>
          <span className="recherche-ligne">
            <input type="search" name="r" defaultValue={recherche} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            <button type="submit" className="bouton-action">
              Chercher
            </button>
          </span>
        </label>
      </Form>

      {vue === null ? (
        <p className="discret">Tapez une référence : toutes les interventions qui la portent s&apos;afficheront, avec le total de main-d&apos;œuvre.</p>
      ) : !vue.ok ? (
        <ErreurLecture quoi="Références" code={vue.code} detail={vue.detail} />
      ) : vue.donnees === null ? (
        <Vide>
          Aucune intervention ne porte la référence « {recherche} ».
          <br />
          Les majuscules et les espaces en trop ne comptent pas ; les tirets et les points, si.
        </Vide>
      ) : (
        <>
          <section className="carte total-reference" aria-label="Total de main-d'œuvre">
            <p className="discret">{vue.donnees.reference}</p>
            <p className="ligne-entre">
              <span>
                <strong>{heures(vue.donnees.total.minutesFacturees)}</strong> facturées
              </span>
              <strong>{formaterEuros(vue.donnees.total.montantCentimes)} HT</strong>
            </p>
            <p className="discret">
              Main-d&apos;œuvre des bons signés, arrondie intervention par intervention.
              {vue.donnees.interventions.some((i) => i.bon === null) && " Les interventions sans bon signé ne comptent pas encore."}
              {!toutesAgences && " Seules les interventions de votre agence sont comptées."}
            </p>
          </section>

          <ul className="liste">
            {vue.donnees.interventions.map((i) => (
              <li key={i.id}>
                <Link href={`/interventions/${i.id}`} className="carte carte-lien">
                  <span className="ligne-entre">
                    <span className="numero">{i.numero}</span>
                    <span className={`pastille pastille-${i.statut}`}>{LIBELLES_STATUT[i.statut]}</span>
                  </span>
                  <span className="titre-carte">{i.client}</span>
                  <span className="discret">
                    {LIBELLES_TYPE[i.type]} · {i.site} · reçue le {formatJour.format(i.recueLe)}
                  </span>
                  {i.bon ? (
                    <span className="ligne-entre">
                      <span>
                        {i.bon.numero ?? "Bon en attente de numéro"} · {heures(i.bon.minutesFacturees)}
                        {i.bon.nombrePersonnes > 1 && ` (${i.bon.nombrePersonnes} pers.)`}
                      </span>
                      <span>{formaterEuros(i.bon.montantCentimes)}</span>
                    </span>
                  ) : (
                    <span className="discret">Pas encore de bon signé</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
