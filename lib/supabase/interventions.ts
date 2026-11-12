import {
  statutAffiche,
  trierInterventions,
  urgenceVisible,
  type Priorite,
  type StatutAffiche,
  type StatutIntervention,
  type TypeIntervention,
} from "@/lib/regles";
import type { ClientSupabase } from "./utilisateur-courant";

/** Ce qu'une carte de la liste affiche pour une intervention. */
export interface InterventionListee {
  id: string;
  numero: string;
  type: TypeIntervention;
  statut: StatutIntervention;
  /** « En cours » devient « En pause » quand aucun chrono ne tourne. */
  statutAffiche: StatutAffiche;
  chronoTourne: boolean;
  priorite: Priorite;
  urgente: boolean;
  recueLe: Date;
  client: string;
  site: string;
  agence: string;
  titulaire: string | null;
  /** Numéros des instruments concernés (INS-0802, INS-0803…). */
  instruments: string[];
}

interface LigneLue {
  id: string;
  numero: string;
  type: TypeIntervention;
  statut: StatutIntervention;
  priorite: Priorite;
  recue_le: string;
  client: { nom: string } | null;
  site: { nom: string } | null;
  agence: { nom: string } | null;
  titulaire: { nom: string } | null;
  intervention_instrument: { instrument: { numero: string | null; reference_provisoire: string | null } | null }[];
  segment_chrono: { id: string }[];
}

// Chaque lien précise la contrainte de la base qu'il suit (nom après le « ! ») : plusieurs
// tables sont reliées de deux façons (ex. titulaire, créateur), on ne laisse rien deviner.
const COLONNES = `
  id, numero, type, statut, priorite, recue_le,
  client:client!intervention_client_meme_agence(nom),
  site:site!intervention_site_du_client(nom),
  agence:agence!intervention_agence_meme_entreprise(nom),
  titulaire:utilisateur!intervention_titulaire_meme_entreprise(nom),
  intervention_instrument!ii_intervention_meme_entreprise(
    instrument:instrument!ii_instrument_du_site(numero, reference_provisoire)
  ),
  segment_chrono!segment_intervention_meme_entreprise(id)
`.replace(/\s+/g, "");

export type ListeInterventions =
  | { ok: true; interventions: InterventionListee[] }
  | { ok: false; code: string; detail: string };

/**
 * Les interventions que l'utilisateur connecté a le droit de voir (c'est la base qui filtre :
 * son agence pour un technicien ou un chef d'agence, toutes pour un gestionnaire), triées
 * selon le §6.1. Lecture seule.
 */
export async function listerInterventions(supabase: ClientSupabase): Promise<ListeInterventions> {
  const { data, error } = await supabase
    .from("intervention")
    .select(COLONNES)
    // Seuls les segments encore ouverts sont lus : s'il y en a un, le chrono tourne.
    .is("segment_chrono.fin", null)
    .returns<LigneLue[]>();

  if (error) return { ok: false, code: error.code ?? "inconnu", detail: error.message };

  const interventions = data.map((l): InterventionListee => {
    const chronoTourne = l.segment_chrono.length > 0;
    return {
      id: l.id,
      numero: l.numero,
      type: l.type,
      statut: l.statut,
      statutAffiche: statutAffiche(l.statut, chronoTourne),
      chronoTourne,
      priorite: l.priorite,
      urgente: urgenceVisible(l.statut, l.priorite),
      recueLe: new Date(l.recue_le),
      client: l.client?.nom ?? "Client inconnu",
      site: l.site?.nom ?? "Site inconnu",
      agence: l.agence?.nom ?? "",
      titulaire: l.titulaire?.nom ?? null,
      instruments: l.intervention_instrument
        .map((ii) => ii.instrument?.numero ?? ii.instrument?.reference_provisoire ?? "")
        .filter(Boolean)
        .sort(),
    };
  });

  return { ok: true, interventions: trierInterventions(interventions) };
}
