"use client";

import { createContext, use, useActionState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { echecFormulaire, MESSAGE_RESEAU, saisieDe, type EtatFormulaire } from "@/lib/formulaire";

type Action = (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;

const Etat = createContext<EtatFormulaire>({ erreur: null, erreurs: {}, valeurs: {} });

/** Pour un champ composé (ex. l'échéance en deux listes) : ce qui a été saisi et les erreurs en cours. */
export function useEtatFormulaire(): EtatFormulaire {
  return use(Etat);
}

/**
 * Formulaire commun à toute l'appli : envoie la saisie au serveur, réaffiche ce qui a été tapé
 * en cas d'erreur, et traite ici le seul cas que le serveur ne peut pas voir : le téléphone n'a
 * pas de réseau, la demande n'est donc jamais partie (ou jamais arrivée).
 */
export function Formulaire({
  action,
  valeurs = {},
  bouton,
  boutonEnCours = "Enregistrement…",
  annulerVers,
  children,
}: {
  action: Action;
  /** Valeurs affichées à l'ouverture (fiche à modifier). */
  valeurs?: Record<string, string>;
  bouton: string;
  boutonEnCours?: string;
  /** Adresse du lien « Annuler » (absent si non fourni). */
  annulerVers?: string;
  children: ReactNode;
}) {
  const envoyer = useCallback(
    async (etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> => {
      const saisie = saisieDe(formulaire);
      if (!navigator.onLine) return echecFormulaire(MESSAGE_RESEAU, saisie);
      try {
        return await action(etat, formulaire);
      } catch (erreur) {
        unstable_rethrow(erreur); // la redirection après un enregistrement réussi passe par ici
        return echecFormulaire(MESSAGE_RESEAU, saisie);
      }
    },
    [action],
  );
  const [etat, envoi, enCours] = useActionState(envoyer, { erreur: null, erreurs: {}, valeurs });

  return (
    <Etat value={etat}>
      <form action={envoi} className="formulaire">
        {children}
        {etat.erreur && (
          <p className="erreur" role="alert">
            {etat.erreur}
          </p>
        )}
        <button type="submit" className="bouton-principal" disabled={enCours}>
          {enCours ? boutonEnCours : bouton}
        </button>
        {annulerVers && (
          <Link href={annulerVers} className="bouton-secondaire">
            Annuler
          </Link>
        )}
      </form>
    </Etat>
  );
}

interface ProprietesChamp {
  nom: string;
  libelle: string;
  /** Champ facultatif : la mention « (facultatif) » s'affiche à côté du libellé. */
  facultatif?: boolean;
  /** Petite explication sous le champ. */
  aide?: string;
}

function Libelle({ libelle, facultatif }: { libelle: string; facultatif?: boolean }) {
  return (
    <span>
      {libelle}
      {facultatif && <span className="facultatif"> (facultatif)</span>}
    </span>
  );
}

/** Explication et erreur éventuelle, sous un champ. */
export function Pied({ nom, aide }: { nom: string; aide?: string }) {
  const erreur = use(Etat).erreurs[nom];
  return (
    <>
      {aide && <span className="aide">{aide}</span>}
      {erreur && (
        <span className="erreur" id={`erreur-${nom}`}>
          {erreur}
        </span>
      )}
    </>
  );
}

/** Champ d'une ligne (texte, email, téléphone, nombre entier, mot de passe). */
export function Champ({
  nom,
  libelle,
  facultatif,
  aide,
  type = "text",
  inputMode,
  autoComplete = "off",
  suggestions,
}: ProprietesChamp & {
  type?: "text" | "email" | "tel" | "password";
  inputMode?: "text" | "email" | "tel" | "numeric";
  autoComplete?: string;
  /** Valeurs proposées pendant la frappe ; on peut toujours en écrire une autre. */
  suggestions?: string[];
}) {
  const etat = use(Etat);
  return (
    <label>
      <Libelle libelle={libelle} facultatif={facultatif} />
      {suggestions && (
        <datalist id={`suggestions-${nom}`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <input
        type={type}
        name={nom}
        list={suggestions ? `suggestions-${nom}` : undefined}
        inputMode={inputMode}
        autoComplete={autoComplete}
        // Un mot de passe n'est jamais réaffiché.
        defaultValue={type === "password" ? "" : (etat.valeurs[nom] ?? "")}
        required={!facultatif}
        aria-invalid={etat.erreurs[nom] ? true : undefined}
        aria-describedby={etat.erreurs[nom] ? `erreur-${nom}` : undefined}
      />
      <Pied nom={nom} aide={aide} />
    </label>
  );
}

/** Champ de plusieurs lignes. */
export function ChampTexteLong({ nom, libelle, facultatif, aide }: ProprietesChamp) {
  const etat = use(Etat);
  return (
    <label>
      <Libelle libelle={libelle} facultatif={facultatif} />
      <textarea
        name={nom}
        rows={3}
        defaultValue={etat.valeurs[nom] ?? ""}
        required={!facultatif}
        aria-invalid={etat.erreurs[nom] ? true : undefined}
        aria-describedby={etat.erreurs[nom] ? `erreur-${nom}` : undefined}
      />
      <Pied nom={nom} aide={aide} />
    </label>
  );
}

/** Case à cocher. */
export function ChampCase({ nom, libelle, aide }: Omit<ProprietesChamp, "facultatif">) {
  const valeur = use(Etat).valeurs[nom];
  return (
    <label className="case">
      <input type="checkbox" name={nom} defaultChecked={valeur === "on" || valeur === "true"} />
      <span>
        {libelle}
        {aide && <span className="aide">{aide}</span>}
      </span>
    </label>
  );
}

/** Liste déroulante. */
export function ChampChoix({
  nom,
  libelle,
  aide,
  choix,
}: Omit<ProprietesChamp, "facultatif"> & { choix: { valeur: string; libelle: string }[] }) {
  const etat = use(Etat);
  return (
    <label>
      <Libelle libelle={libelle} />
      <select name={nom} defaultValue={etat.valeurs[nom] ?? ""} required>
        <option value="" disabled>
          Choisir…
        </option>
        {choix.map((c) => (
          <option key={c.valeur} value={c.valeur}>
            {c.libelle}
          </option>
        ))}
      </select>
      <Pied nom={nom} aide={aide} />
    </label>
  );
}
