"use client";

import { useEffect, useState } from "react";
import { Pied, useEtatFormulaire } from "@/app/_composants/formulaire";
import { LIBELLES_STATUT, LIBELLES_TYPE, normaliserReference } from "@/lib/regles";
import type { ReferenceConnue } from "@/lib/supabase/references";
import { suggestionsReference } from "../../actions";

const formatJour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" });

/**
 * Champ de la référence externe, avec les références déjà utilisées qui ressemblent à la saisie :
 * on voit tout de suite si « OS-2026-0412 » existe déjà, et sur quelles interventions, au lieu de
 * créer « os 2026-0412 » par une faute de frappe.
 */
export function ChampReference({ libelle, interventionId }: { libelle: string; interventionId: string }) {
  const etat = useEtatFormulaire();
  const [valeur, setValeur] = useState(etat.valeurs.reference ?? "");
  const [suggestions, setSuggestions] = useState<ReferenceConnue[]>([]);
  const [recherche, setRecherche] = useState(false);

  useEffect(() => {
    const cherchee = normaliserReference(valeur);
    if (cherchee.length < 2) return;
    let abandonnee = false;
    // On attend une courte pause dans la frappe avant d'interroger la base.
    const minuteur = setTimeout(async () => {
      setRecherche(true);
      try {
        const resultat = await suggestionsReference(valeur, interventionId);
        if (!abandonnee) setSuggestions(resultat);
      } catch {
        if (!abandonnee) setSuggestions([]); // pas de réseau : la saisie reste possible, sans suggestion
      } finally {
        if (!abandonnee) setRecherche(false);
      }
    }, 300);
    return () => {
      abandonnee = true;
      clearTimeout(minuteur);
    };
  }, [valeur, interventionId]);

  const assezLongue = normaliserReference(valeur).length >= 2;
  const affichees = assezLongue ? suggestions : [];
  const identique = affichees.find((s) => s.identique);

  return (
    <div className="champ-reference">
      <label>
        <span>
          {libelle}
          <span className="facultatif"> (facultatif)</span>
        </span>
        <input
          type="text"
          name="reference"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={80}
          aria-invalid={etat.erreurs.reference ? true : undefined}
          aria-describedby="suggestions-reference"
        />
        <Pied nom="reference" aide="Laisser vide pour retirer la référence. Majuscules et espaces en trop ne comptent pas." />
      </label>

      <div id="suggestions-reference" aria-live="polite">
        {recherche && affichees.length === 0 && <p className="discret">Recherche des références existantes…</p>}
        {identique && (
          <p className="avertissement">
            « {identique.reference} » est déjà utilisée par {identique.interventions.length} autre
            {identique.interventions.length > 1 ? "s" : ""} intervention{identique.interventions.length > 1 ? "s" : ""} : c&apos;est
            normal si elles concernent la même commande.
          </p>
        )}
        {affichees.length > 0 && (
          <>
            <p className="discret">Références déjà utilisées :</p>
            <ul className="suggestions">
              {affichees.map((s) => (
                <li key={s.normalisee}>
                  <button type="button" className="suggestion" onClick={() => setValeur(s.reference)}>
                    <span className="ligne-entre">
                      <strong>{s.reference}</strong>
                      <span className="discret">{s.identique ? "identique" : "reprendre"}</span>
                    </span>
                    {s.interventions.slice(0, 3).map((i) => (
                      <span key={i.id} className="discret">
                        {i.numero} · {i.client} · {LIBELLES_TYPE[i.type]} · {LIBELLES_STATUT[i.statut]} ·{" "}
                        {formatJour.format(new Date(i.recueLe))}
                      </span>
                    ))}
                    {s.interventions.length > 3 && (
                      <span className="discret">et {s.interventions.length - 3} autre(s)</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
