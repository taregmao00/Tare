"use client";

import { useState } from "react";
import { Champ, Pied, useEtatFormulaire } from "@/app/_composants/formulaire";
import {
  anneesDesLimites,
  LIBELLES_STATUT_METROLOGIE,
  moisDansLimites,
  type MoisCalendaire,
  type StatutMetrologie,
} from "@/lib/regles";

const STATUTS: StatutMetrologie[] = ["verte", "a_verifier", "rouge"];
const NOM_DU_MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const MOIS = Array.from({ length: 12 }, (_, i) => {
  const numero = String(i + 1).padStart(2, "0");
  return { valeur: String(i + 1), numero, libelle: `${numero} · ${NOM_DU_MOIS.format(new Date(Date.UTC(2000, i, 1)))}` };
});

/**
 * La vignette que porte l'instrument au moment où on l'enregistre.
 * L'échéance ne se tape jamais au clavier (§7) : deux listes, mois et année, et les mois hors
 * limites ne peuvent pas être choisis.
 */
export function ChampsVignette({ limites }: { limites: { min: MoisCalendaire; max: MoisCalendaire } }) {
  const etat = useEtatFormulaire();
  const [statut, setStatut] = useState(etat.valeurs.statut_metrologie ?? "");
  const [annee, setAnnee] = useState(etat.valeurs.echeance_annee ?? "");
  const [mois, setMois] = useState(etat.valeurs.echeance_mois ?? "");

  const autorise = (m: (typeof MOIS)[number], a: string) => a === "" || moisDansLimites(`${a}-${m.numero}`, limites);

  function changerAnnee(nouvelle: string) {
    setAnnee(nouvelle);
    // Le mois déjà choisi n'existe peut-être pas dans les limites de cette année-là.
    const choisi = MOIS.find((m) => m.valeur === mois);
    if (choisi && !autorise(choisi, nouvelle)) setMois("");
  }

  return (
    <>
      <label>
        <span>Vignette portée aujourd&apos;hui</span>
        <select
          name="statut_metrologie"
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          required
          aria-invalid={etat.erreurs.statut_metrologie ? true : undefined}
        >
          <option value="" disabled>
            Choisir…
          </option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {LIBELLES_STATUT_METROLOGIE[s]}
            </option>
          ))}
        </select>
        <Pied
          nom="statut_metrologie"
          aide="À relever sur l'instrument. Ensuite, la vignette ne changera plus que par un bon signé."
        />
      </label>

      {statut === "verte" && (
        <fieldset className="echeance">
          <legend>Échéance inscrite sur la vignette</legend>
          <div className="deux-colonnes">
            <label>
              <span>Mois</span>
              <select
                name="echeance_mois"
                value={mois}
                onChange={(e) => setMois(e.target.value)}
                required
                aria-invalid={etat.erreurs.echeance ? true : undefined}
              >
                <option value="" disabled>
                  Mois…
                </option>
                {MOIS.map((m) => (
                  <option key={m.valeur} value={m.valeur} disabled={!autorise(m, annee)}>
                    {m.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Année</span>
              <select
                name="echeance_annee"
                value={annee}
                onChange={(e) => changerAnnee(e.target.value)}
                required
                aria-invalid={etat.erreurs.echeance ? true : undefined}
              >
                <option value="" disabled>
                  Année…
                </option>
                {anneesDesLimites(limites).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Pied
            nom="echeance"
            aide="La vignette est valable jusqu'au dernier jour de ce mois. Une vignette déjà périmée s'enregistre telle quelle."
          />
        </fieldset>
      )}

      {(statut === "a_verifier" || statut === "rouge") && (
        <Champ
          nom="motif_statut"
          libelle="Motif"
          facultatif
          aide="Exemple : vérification primitive à réaliser, scellé brisé, refusé à la dernière vérification."
        />
      )}
    </>
  );
}
