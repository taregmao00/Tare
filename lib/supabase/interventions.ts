import {
  statutAffiche,
  trierInterventions,
  urgenceVisible,
  type Priorite,
  type StatutAffiche,
  type StatutIntervention,
  type StatutMetrologie,
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
  /** Référence externe (N° de message, N° d'OS…), si elle a été saisie. */
  reference: string | null;
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
  intervention_reference: { reference: string }[];
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
  segment_chrono!segment_intervention_meme_entreprise(id),
  intervention_reference!ir_intervention_meme_entreprise(reference)
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
      reference: l.intervention_reference[0]?.reference ?? null,
    };
  });

  return { ok: true, interventions: trierInterventions(interventions) };
}

// ---------------------------------------------------------------------------
// Fiche d'une intervention (lecture seule, sauf la référence externe)
// ---------------------------------------------------------------------------

export interface InterventionDetail extends InterventionListee {
  description: string | null;
  dureeEstimeeMinutes: number | null;
  nombrePersonnesPrevu: number;
  clientId: string;
  distanceKm: number;
  instrumentsDetail: {
    id: string;
    numero: string;
    type: string;
    statut: StatutMetrologie;
    echeance: string | null;
  }[];
  bons: { numero: string | null; referenceProvisoire: string; statut: string; signeLe: Date; totalHtCentimes: number }[];
  journal: { id: string; horodatage: Date; texte: string; auteur: string | null }[];
}

const COLONNES_DETAIL = `
  id, numero, type, statut, priorite, recue_le, description, duree_estimee_minutes, nombre_personnes_prevu,
  client:client!intervention_client_meme_agence(id, nom),
  site:site!intervention_site_du_client(nom, distance_km),
  agence:agence!intervention_agence_meme_entreprise(nom),
  titulaire:utilisateur!intervention_titulaire_meme_entreprise(nom),
  intervention_instrument!ii_intervention_meme_entreprise(
    instrument:instrument!ii_instrument_du_site(id, numero, reference_provisoire, type, statut_metrologie, echeance_verification)
  ),
  segment_chrono!segment_intervention_meme_entreprise(id, fin),
  intervention_reference!ir_intervention_meme_entreprise(reference),
  bon!bon_intervention_meme_entreprise(numero, reference_provisoire, statut, signe_le, total_ht_centimes),
  journal!journal_intervention_meme_entreprise(id, horodatage, texte, auteur:utilisateur!journal_auteur_meme_entreprise(nom))
`.replace(/\s+/g, "");

/** Une intervention, avec ses instruments, ses bons et son journal. `null` si elle n'est pas visible. */
export async function lireIntervention(
  supabase: ClientSupabase,
  id: string,
): Promise<{ ok: true; donnees: InterventionDetail | null } | { ok: false; code: string; detail: string }> {
  const { data, error } = await supabase
    .from("intervention")
    .select(COLONNES_DETAIL)
    .eq("id", id)
    .maybeSingle<{
      id: string;
      numero: string;
      type: TypeIntervention;
      statut: StatutIntervention;
      priorite: Priorite;
      recue_le: string;
      description: string | null;
      duree_estimee_minutes: number | null;
      nombre_personnes_prevu: number;
      client: { id: string; nom: string } | null;
      site: { nom: string; distance_km: number } | null;
      agence: { nom: string } | null;
      titulaire: { nom: string } | null;
      intervention_instrument: {
        instrument: {
          id: string;
          numero: string | null;
          reference_provisoire: string | null;
          type: string;
          statut_metrologie: StatutMetrologie;
          echeance_verification: string | null;
        } | null;
      }[];
      segment_chrono: { id: string; fin: string | null }[];
      intervention_reference: { reference: string }[];
      bon: { numero: string | null; reference_provisoire: string; statut: string; signe_le: string; total_ht_centimes: number }[];
      journal: { id: string; horodatage: string; texte: string; auteur: { nom: string } | null }[];
    }>();
  if (error) return { ok: false, code: error.code ?? "inconnu", detail: error.message };
  if (!data) return { ok: true, donnees: null };

  const chronoTourne = data.segment_chrono.some((s) => s.fin === null);
  const instrumentsDetail = data.intervention_instrument
    .flatMap((ii) => (ii.instrument ? [ii.instrument] : []))
    .map((i) => ({
      id: i.id,
      numero: i.numero ?? i.reference_provisoire ?? "",
      type: i.type,
      statut: i.statut_metrologie,
      echeance: i.echeance_verification,
    }))
    .sort((a, b) => a.numero.localeCompare(b.numero));

  return {
    ok: true,
    donnees: {
      id: data.id,
      numero: data.numero,
      type: data.type,
      statut: data.statut,
      statutAffiche: statutAffiche(data.statut, chronoTourne),
      chronoTourne,
      priorite: data.priorite,
      urgente: urgenceVisible(data.statut, data.priorite),
      recueLe: new Date(data.recue_le),
      client: data.client?.nom ?? "Client inconnu",
      clientId: data.client?.id ?? "",
      site: data.site?.nom ?? "Site inconnu",
      distanceKm: data.site?.distance_km ?? 0,
      agence: data.agence?.nom ?? "",
      titulaire: data.titulaire?.nom ?? null,
      instruments: instrumentsDetail.map((i) => i.numero),
      instrumentsDetail,
      reference: data.intervention_reference[0]?.reference ?? null,
      description: data.description,
      dureeEstimeeMinutes: data.duree_estimee_minutes,
      nombrePersonnesPrevu: data.nombre_personnes_prevu,
      bons: data.bon
        .map((b) => ({
          numero: b.numero,
          referenceProvisoire: b.reference_provisoire,
          statut: b.statut,
          signeLe: new Date(b.signe_le),
          totalHtCentimes: b.total_ht_centimes,
        }))
        .sort((a, b) => a.signeLe.getTime() - b.signeLe.getTime()),
      journal: data.journal
        .map((j) => ({ id: j.id, horodatage: new Date(j.horodatage), texte: j.texte, auteur: j.auteur?.nom ?? null }))
        .sort((a, b) => b.horodatage.getTime() - a.horodatage.getTime()),
    },
  };
}
