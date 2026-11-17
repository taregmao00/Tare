"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { echecFormulaire, MESSAGE_CHAMPS, saisieDe, type EtatFormulaire } from "@/lib/formulaire";
import { controlerReference, peutSaisirReference } from "@/lib/regles";
import { suggererReferences, type ReferenceConnue } from "@/lib/supabase/references";
import { libelleReference, session } from "@/lib/supabase/utilisateur-courant";

/** Références déjà utilisées qui ressemblent à ce qui est tapé (appelé pendant la frappe). */
export async function suggestionsReference(saisie: string, interventionId: string): Promise<ReferenceConnue[]> {
  const { supabase, utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return [];
  const suggestions = await suggererReferences(supabase, saisie);
  if (!suggestions.ok) {
    console.error(`[référence] Suggestions impossibles (${suggestions.code}) : ${suggestions.detail}`);
    return [];
  }
  // L'intervention en cours de saisie n'est pas un « doublon » d'elle-même.
  return suggestions.donnees
    .map((r) => ({ ...r, interventions: r.interventions.filter((i) => i.id !== interventionId) }))
    .filter((r) => r.interventions.length > 0);
}

/** Ajoute, modifie ou retire (champ vide) la référence externe d'une intervention. */
export async function enregistrerReference(
  interventionId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const saisie = saisieDe(formulaire);
  const { supabase, utilisateur } = await session();
  if (utilisateur === null) redirect("/connexion");
  if (utilisateur === "sans_fiche") return echecFormulaire("Votre compte est désactivé ou n'est rattaché à aucune entreprise.", saisie);
  const libelle = await libelleReference();
  if (!peutSaisirReference(utilisateur.role)) {
    return echecFormulaire(`Le gestionnaire consulte la ${libelle.toLowerCase()} sans la modifier.`, saisie);
  }

  const controle = controlerReference(saisie.reference, libelle);
  if (!controle.ok) return echecFormulaire(MESSAGE_CHAMPS, saisie, { reference: controle.erreur });

  const existante = await supabase
    .from("intervention_reference")
    .select("id, reference")
    .eq("intervention_id", interventionId)
    .maybeSingle<{ id: string; reference: string }>();
  if (existante.error) return echecFormulaire(messageRefus(existante.error), saisie);

  const { reference } = controle;
  let resultat: { error: { code?: string; message: string } | null } = { error: null };
  if (reference === null && existante.data) {
    resultat = await supabase.from("intervention_reference").delete().eq("id", existante.data.id);
  } else if (reference !== null && existante.data && existante.data.reference !== reference) {
    resultat = await supabase.from("intervention_reference").update({ reference }).eq("id", existante.data.id);
  } else if (reference !== null && !existante.data) {
    resultat = await supabase.from("intervention_reference").insert({
      id: crypto.randomUUID(),
      entreprise_id: utilisateur.entrepriseId,
      intervention_id: interventionId,
      reference,
    });
  }
  if (resultat.error) return echecFormulaire(messageRefus(resultat.error), saisie);

  revalidatePath("/", "layout");
  redirect(`/interventions/${interventionId}`);
}

function messageRefus(erreur: { code?: string; message: string }): string {
  console.error(`[référence] Refusé par la base (${erreur.code || "sans code"}) : ${erreur.message}`);
  if (erreur.code === "23001") return "L'intervention est « Facturée » : sa référence ne se modifie plus.";
  if (erreur.code === "42501") return "La base a refusé l'enregistrement : votre rôle ou votre agence ne le permet pas.";
  if (!erreur.code) return "Le service ne répond pas. Vérifiez le réseau et réessayez.";
  return `L'enregistrement a échoué (code ${erreur.code}). Réessayez ; si cela dure, prévenez l'administrateur.`;
}
