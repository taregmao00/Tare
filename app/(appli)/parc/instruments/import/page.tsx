import type { Metadata } from "next";
import { Ecran, Retour, SansAcces } from "@/app/_composants/etats";
import { COLONNES_IMPORT, jourParis, LIGNES_MAX_IMPORT, peutGererParc } from "@/lib/regles";
import { session } from "@/lib/supabase/utilisateur-courant";
import { importerInstruments } from "../../actions";
import { FormulaireImport } from "./formulaire-import";

export const metadata: Metadata = { title: "Importer des instruments · Tare" };

export default function ImportInstruments() {
  return (
    <Ecran>
      <Contenu />
    </Ecran>
  );
}

async function Contenu() {
  const { utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return <SansAcces connecte={utilisateur !== null} />;

  return (
    <>
      <Retour vers="/parc/instruments">Instruments</Retour>
      <h1 className="titre-page">Importer des instruments</h1>
      {!peutGererParc(utilisateur.role) ? (
        <p className="erreur" role="alert">
          Seuls le chef d&apos;agence et l&apos;administrateur peuvent importer des instruments.
        </p>
      ) : (
        <>
          <p>
            Pour ajouter d&apos;un coup les instruments d&apos;un tableau (Excel, LibreOffice), enregistré au format CSV.
            Le fichier est contrôlé ligne par ligne avant tout enregistrement : s&apos;il reste une erreur, rien
            n&apos;est enregistré.
          </p>
          <details className="aide-import">
            <summary className="lien-tactile">Comment préparer le fichier</summary>
            <ul>
              <li>
                Partez du{" "}
                <a href="/modele-import-instruments.csv" download>
                  fichier modèle
                </a>{" "}
                : sa première ligne donne le nom des colonnes.
              </li>
              <li>
                Colonnes obligatoires :{" "}
                {COLONNES_IMPORT.filter((c) => c.obligatoire)
                  .map((c) => c.titre)
                  .join(", ")}
                . Facultatives :{" "}
                {COLONNES_IMPORT.filter((c) => !c.obligatoire)
                  .map((c) => c.titre)
                  .join(", ")}
                .
              </li>
              <li>
                Le <strong>client</strong> doit déjà exister dans le Parc, écrit avec le même nom. La colonne{" "}
                <strong>site</strong> peut rester vide si le client n&apos;a qu&apos;un seul site.
              </li>
              <li>
                <strong>vignette</strong> : verte, rouge ou à vérifier. <strong>echeance</strong> : le mois et l&apos;année
                de la vignette verte (exemple : 11/2027). Sans vignette ni échéance, l&apos;instrument est enregistré « À
                vérifier ».
              </li>
              <li>{LIGNES_MAX_IMPORT} instruments au plus par fichier. Les numéros INS sont attribués à l&apos;enregistrement.</li>
            </ul>
          </details>
          <FormulaireImport action={importerInstruments} aujourdhui={jourParis(new Date())} />
        </>
      )}
    </>
  );
}
