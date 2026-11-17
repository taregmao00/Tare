"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { echecFormulaire, MESSAGE_CHAMPS, saisieDe, type EtatFormulaire } from "@/lib/formulaire";
import { controlerLibelleReference, peutModifierReglages } from "@/lib/regles";
import { session } from "@/lib/supabase/utilisateur-courant";

/** Nom affiché du champ « référence externe » (« N° de message », « N° d'OS »…). Administrateur seul. */
export async function modifierLibelleReference(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const { supabase, utilisateur } = await session();
  if (utilisateur === null) redirect("/connexion");
  if (utilisateur === "sans_fiche" || !peutModifierReglages(utilisateur.role)) {
    return echecFormulaire("Seul l'administrateur change les réglages de l'entreprise.", saisie);
  }

  const controle = controlerLibelleReference(saisie.libelle_reference_externe);
  if (!controle.ok) return echecFormulaire(MESSAGE_CHAMPS, saisie, { libelle_reference_externe: controle.erreur });

  const { data, error } = await supabase
    .from("entreprise")
    .update({ libelle_reference_externe: controle.libelle })
    .eq("id", utilisateur.entrepriseId)
    .select("id");
  if (error || data.length === 0) {
    console.error(`[réglages] Libellé refusé (${error?.code ?? "aucune ligne"}) : ${error?.message ?? ""}`);
    return echecFormulaire(
      error?.code
        ? `L'enregistrement a échoué (code ${error.code}). La base est-elle à jour ? Prévenez l'administrateur.`
        : "Le service ne répond pas. Vérifiez le réseau et réessayez.",
      saisie,
    );
  }

  revalidatePath("/", "layout");
  redirect("/reglages?enregistre=1");
}
