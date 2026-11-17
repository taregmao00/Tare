import {
  normaliserReference,
  totalMainOeuvre,
  type StatutIntervention,
  type TotalMainOeuvre,
  type TypeIntervention,
} from "@/lib/regles";
import type { Lecture } from "./parc";
import type { ClientSupabase } from "./utilisateur-courant";

/** Une intervention liée à une référence, telle qu'on la montre dans les suggestions. */
export interface InterventionLiee {
  id: string;
  numero: string;
  type: TypeIntervention;
  statut: StatutIntervention;
  client: string;
  recueLe: string; // ISO : passe tel quel du serveur au téléphone
}

export interface ReferenceConnue {
  /** Telle que saisie la première fois (c'est ce qu'on propose de reprendre). */
  reference: string;
  normalisee: string;
  /** La saisie en cours désigne exactement cette référence (casse et espaces mis à part). */
  identique: boolean;
  interventions: InterventionLiee[];
}

const LIEN_INTERVENTION =
  "intervention:intervention!ir_intervention_meme_entreprise(id, numero, type, statut, recue_le, client:client!intervention_client_meme_agence(nom))";

interface LienLu {
  reference: string;
  reference_normalisee: string;
  intervention: {
    id: string;
    numero: string;
    type: TypeIntervention;
    statut: StatutIntervention;
    recue_le: string;
    client: { nom: string } | null;
  } | null;
}

/** Échappe les caractères qui ont un sens particulier dans une recherche « contient ». */
function motifContient(texte: string): string {
  return `%${texte.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Références déjà utilisées qui ressemblent à la saisie (elle y est contenue, casse et espaces
 * mis à part), avec les interventions qui les portent. Sert à éviter les doublons dus aux fautes
 * de frappe. Seules les interventions que l'utilisateur a le droit de voir sont proposées.
 */
export async function suggererReferences(supabase: ClientSupabase, saisie: string): Promise<Lecture<ReferenceConnue[]>> {
  const cherchee = normaliserReference(saisie);
  if (cherchee.length < 2) return { ok: true, donnees: [] };

  const { data, error } = await supabase
    .from("intervention_reference")
    .select(`reference, reference_normalisee, ${LIEN_INTERVENTION}`)
    .ilike("reference_normalisee", motifContient(cherchee))
    .limit(60)
    .returns<LienLu[]>();
  if (error) return { ok: false, code: error.code ?? "inconnu", detail: error.message };

  const parReference = new Map<string, ReferenceConnue>();
  for (const lien of data) {
    if (!lien.intervention) continue;
    const groupe = parReference.get(lien.reference_normalisee) ?? {
      reference: lien.reference,
      normalisee: lien.reference_normalisee,
      identique: lien.reference_normalisee === cherchee,
      interventions: [],
    };
    groupe.interventions.push({
      id: lien.intervention.id,
      numero: lien.intervention.numero,
      type: lien.intervention.type,
      statut: lien.intervention.statut,
      client: lien.intervention.client?.nom ?? "",
      recueLe: lien.intervention.recue_le,
    });
    parReference.set(lien.reference_normalisee, groupe);
  }

  // La référence identique d'abord, puis celles qui commencent par la saisie, puis les autres.
  const rang = (r: ReferenceConnue) => (r.identique ? 0 : r.normalisee.startsWith(cherchee) ? 1 : 2);
  const suggestions = [...parReference.values()]
    .map((r) => ({ ...r, interventions: r.interventions.sort((a, b) => b.recueLe.localeCompare(a.recueLe)) }))
    .sort((a, b) => rang(a) - rang(b) || a.normalisee.localeCompare(b.normalisee))
    .slice(0, 8);
  return { ok: true, donnees: suggestions };
}

// ---------------------------------------------------------------------------
// Vue par référence
// ---------------------------------------------------------------------------

export interface InterventionDeLaReference {
  id: string;
  numero: string;
  type: TypeIntervention;
  statut: StatutIntervention;
  client: string;
  site: string;
  recueLe: Date;
  /** Le bon valide (le rectificatif s'il y en a un), ou `null` tant que rien n'est signé. */
  bon: {
    numero: string | null;
    signeLe: Date;
    nombrePersonnes: number;
    minutesFacturees: number;
    montantCentimes: number;
  } | null;
}

export interface VueReference {
  reference: string;
  interventions: InterventionDeLaReference[];
  /** Main-d'œuvre facturable des bons signés : arrondie intervention par intervention, puis additionnée. */
  total: TotalMainOeuvre;
}

interface BonLu {
  numero: string | null;
  statut: "valide" | "annule_remplace" | "refuse";
  signe_le: string;
  minutes_facturees_par_personne: number;
  nombre_personnes: number;
  taux_horaire_applique_centimes: number;
}

/** Toutes les interventions visibles qui portent cette référence (casse et espaces mis à part). */
export async function lireReference(supabase: ClientSupabase, saisie: string): Promise<Lecture<VueReference | null>> {
  const cherchee = normaliserReference(saisie);
  if (cherchee === "") return { ok: true, donnees: null };

  const { data, error } = await supabase
    .from("intervention_reference")
    .select(
      "reference, intervention:intervention!ir_intervention_meme_entreprise(id, numero, type, statut, recue_le, " +
        "client:client!intervention_client_meme_agence(nom), site:site!intervention_site_du_client(nom), " +
        "bon!bon_intervention_meme_entreprise(numero, statut, signe_le, minutes_facturees_par_personne, nombre_personnes, taux_horaire_applique_centimes))",
    )
    .eq("reference_normalisee", cherchee)
    .returns<
      {
        reference: string;
        intervention: {
          id: string;
          numero: string;
          type: TypeIntervention;
          statut: StatutIntervention;
          recue_le: string;
          client: { nom: string } | null;
          site: { nom: string } | null;
          bon: BonLu[];
        } | null;
      }[]
    >();
  if (error) return { ok: false, code: error.code ?? "inconnu", detail: error.message };
  if (data.length === 0) return { ok: true, donnees: null };

  const interventions = data
    .flatMap((lien) => (lien.intervention ? [lien.intervention] : []))
    .map((i) => {
      // Seul le bon « valide » compte : jamais un bon annulé et remplacé, jamais un rectificatif refusé.
      const bon = i.bon.find((b) => b.statut === "valide") ?? null;
      return { intervention: i, bon };
    })
    .sort((a, b) => b.intervention.recue_le.localeCompare(a.intervention.recue_le));

  const signes = interventions.filter((x) => x.bon !== null);
  const total = totalMainOeuvre(
    signes.map(({ bon }) => ({
      minutesFactureesParPersonne: bon!.minutes_facturees_par_personne,
      nombrePersonnes: bon!.nombre_personnes,
      tauxHoraireCentimes: bon!.taux_horaire_applique_centimes,
    })),
  );

  return {
    ok: true,
    donnees: {
      reference: data[0].reference,
      total,
      interventions: interventions.map(({ intervention: i, bon }) => {
        const mo = bon ? total.detail[signes.findIndex((s) => s.intervention.id === i.id)] : null;
        return {
          id: i.id,
          numero: i.numero,
          type: i.type,
          statut: i.statut,
          client: i.client?.nom ?? "",
          site: i.site?.nom ?? "",
          recueLe: new Date(i.recue_le),
          bon:
            bon && mo
              ? {
                  numero: bon.numero,
                  signeLe: new Date(bon.signe_le),
                  nombrePersonnes: bon.nombre_personnes,
                  minutesFacturees: mo.minutesFactureesTotales,
                  montantCentimes: mo.montantCentimes,
                }
              : null,
        };
      }),
    },
  };
}
