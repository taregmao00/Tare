"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useActionState, useCallback } from "react";
import { MESSAGE_RESEAU } from "@/lib/formulaire";
import type { LigneImport } from "@/lib/regles";
import { Vignette } from "../../affichage";
import { ETAT_IMPORT_INITIAL, TAILLE_MAX_FICHIER, type EtatImport } from "./etat";

type Action = (etat: EtatImport, formulaire: FormData) => Promise<EtatImport>;

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Import en deux temps : on choisit un fichier, on lit le rapport ligne par ligne, puis on
 * enregistre. Tant qu'une ligne est en erreur, le bouton d'enregistrement n'existe pas.
 */
export function FormulaireImport({ action, aujourdhui }: { action: Action; aujourdhui: string }) {
  const envoyer = useCallback(
    async (etat: EtatImport, formulaire: FormData): Promise<EtatImport> => {
      // Le seul cas que le serveur ne peut pas voir : la demande n'est jamais partie.
      if (!navigator.onLine) return { ...etat, erreur: MESSAGE_RESEAU };
      const fichier = formulaire.get("fichier");
      if (fichier instanceof File && fichier.size > TAILLE_MAX_FICHIER) {
        return { ...ETAT_IMPORT_INITIAL, erreur: "Ce fichier est trop gros pour un seul envoi. Découpez-le en plusieurs fichiers." };
      }
      try {
        return await action(etat, formulaire);
      } catch (erreur) {
        unstable_rethrow(erreur);
        return { ...etat, erreur: MESSAGE_RESEAU };
      }
    },
    [action],
  );
  const [etat, envoi, enCours] = useActionState(envoyer, ETAT_IMPORT_INITIAL);
  const { rapport, resultat } = etat;

  if (etat.etape === "termine" && resultat) {
    return (
      <div className="formulaire">
        <p className="succes" role="status">
          {resultat.nombre > 1
            ? `${resultat.nombre} instruments enregistrés, numérotés de ${resultat.premier} à ${resultat.dernier}.`
            : `1 instrument enregistré : ${resultat.premier}.`}
        </p>
        {resultat.doubles > 0 && (
          <p className="avertissement" role="note">
            {pluriel(resultat.doubles, "double")} possible{resultat.doubles > 1 ? "s" : ""} : une alerte a été créée pour
            chacun. En attendant l&apos;écran « À traiter », l&apos;avertissement se lit sur la fiche de l&apos;instrument.
          </p>
        )}
        <Link href="/parc/instruments" className="bouton-principal">
          Voir les instruments
        </Link>
      </div>
    );
  }

  const enErreur = rapport ? rapport.lignes.filter((l) => l.erreurs.length > 0) : [];
  const avecAvertissement = rapport ? rapport.lignes.filter((l) => l.erreurs.length === 0 && l.avertissements.length > 0) : [];
  const sansRemarque = rapport ? rapport.lignes.filter((l) => l.erreurs.length === 0 && l.avertissements.length === 0) : [];
  const pret = rapport !== null && rapport.nombreErreurs === 0;

  return (
    <>
      {rapport && (
        <section className="rapport-import" aria-live="polite">
          <h2 className="titre-section">Contrôle de « {etat.nomFichier} »</h2>
          <p className={pret ? "succes" : "erreur"} role={pret ? "status" : "alert"}>
            {pluriel(rapport.lignes.length, "instrument")} lu{rapport.lignes.length > 1 ? "s" : ""}
            {pret
              ? " · aucune erreur."
              : ` · ${pluriel(rapport.nombreErreurs, "ligne")} en erreur. Rien n'a été enregistré : corrigez le fichier, puis choisissez-le de nouveau.`}
          </p>
          {rapport.colonnesIgnorees.length > 0 && (
            <p className="discret">
              Colonne{rapport.colonnesIgnorees.length > 1 ? "s" : ""} non lue{rapport.colonnesIgnorees.length > 1 ? "s" : ""} (inconnue
              {rapport.colonnesIgnorees.length > 1 ? "s" : ""} de l&apos;import) : {rapport.colonnesIgnorees.join(", ")}.
            </p>
          )}

          {enErreur.length > 0 && <Lignes lignes={enErreur} aujourdhui={aujourdhui} />}

          {pret && avecAvertissement.length > 0 && (
            <>
              <p className="avertissement" role="note">
                {pluriel(avecAvertissement.length, "ligne")} avec un n° de série déjà connu. Si c&apos;est bien un autre
                instrument, vous pouvez enregistrer.
              </p>
              <Lignes lignes={avecAvertissement} aujourdhui={aujourdhui} />
            </>
          )}

          {pret && sansRemarque.length > 0 && (
            <details open={avecAvertissement.length === 0 && sansRemarque.length <= 10}>
              <summary className="lien-tactile">
                Voir {avecAvertissement.length > 0 ? "les autres lignes" : "le détail"} ({sansRemarque.length})
              </summary>
              <Lignes lignes={sansRemarque} aujourdhui={aujourdhui} />
            </details>
          )}

          {pret && (
            <form action={envoi} className="formulaire">
              <input type="hidden" name="confirmer" value="oui" />
              <input type="hidden" name="nom_fichier" value={etat.nomFichier} />
              <textarea name="contenu" value={etat.contenu} readOnly hidden />
              {etat.erreur && (
                <p className="erreur" role="alert">
                  {etat.erreur}
                </p>
              )}
              <button type="submit" className="bouton-principal" disabled={enCours}>
                {enCours ? "Enregistrement…" : `Enregistrer ${rapport.lignes.length > 1 ? `les ${rapport.lignes.length} instruments` : "l'instrument"}`}
              </button>
            </form>
          )}
        </section>
      )}

      <form action={envoi} className="formulaire">
        <label>
          <span>{rapport ? "Choisir un autre fichier (ou le même, corrigé)" : "Fichier CSV des instruments"}</span>
          <input type="file" name="fichier" accept=".csv,.txt,text/csv,text/plain" required />
        </label>
        {etat.erreur && !pret && (
          <p className="erreur" role="alert">
            {etat.erreur}
          </p>
        )}
        <button type="submit" className={rapport ? "bouton-secondaire" : "bouton-principal"} disabled={enCours}>
          {enCours ? "Contrôle en cours…" : "Contrôler le fichier"}
        </button>
        {!rapport && <p className="discret">Cette étape n&apos;enregistre rien : elle vérifie le fichier et vous montre le résultat.</p>}
      </form>
    </>
  );
}

function Lignes({ lignes, aujourdhui }: { lignes: LigneImport[]; aujourdhui: string }) {
  return (
    <ul className="liste">
      {lignes.map((l) => (
        <li key={l.ligne} className="carte">
          <span>
            <span className="numero">Ligne {l.ligne}</span> <span className="titre-carte">{l.description || "(ligne incomplète)"}</span>
          </span>
          <span className="discret">
            {l.client || "Client non indiqué"}
            {l.site && ` · ${l.site}`}
          </span>
          {l.statut && l.erreurs.length === 0 && <Vignette statut={l.statut} echeance={l.echeance} aujourdhui={aujourdhui} />}
          {l.erreurs.map((e) => (
            <span key={e} className="erreur">
              {e}
            </span>
          ))}
          {l.avertissements.map((a) => (
            <span key={a} className="avertissement">
              {a}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
