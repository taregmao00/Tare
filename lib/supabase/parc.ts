import type { MoisCalendaire, ReglagesDeplacement, StatutMetrologie } from "@/lib/regles";
import type { ClientSupabase } from "./utilisateur-courant";

/** Résultat d'une lecture : les données, ou le code d'erreur de la base. */
export type Lecture<T> = { ok: true; donnees: T } | { ok: false; code: string; detail: string };

function echec(erreur: { code?: string; message: string }): { ok: false; code: string; detail: string } {
  return { ok: false, code: erreur.code ?? "inconnu", detail: erreur.message };
}

// Chaque lien précise la contrainte de la base qu'il suit (nom après le « ! »), comme dans
// interventions.ts : on ne laisse rien deviner.
const LIEN_AGENCE = "agence:agence!client_agence_meme_entreprise(nom)";
const LIEN_SITES = "site!site_client_meme_entreprise";
const LIEN_INSTRUMENTS = "instrument!instrument_site_meme_entreprise";

export interface ClientListe {
  id: string;
  nom: string;
  critique: boolean;
  agence: string;
  nombreSites: number;
  nombreInstruments: number;
}

/** Les clients que l'utilisateur a le droit de voir (la base filtre par agence), par ordre alphabétique. */
export async function listerClients(supabase: ClientSupabase): Promise<Lecture<ClientListe[]>> {
  const { data, error } = await supabase
    .from("client")
    .select(`id, nom, critique, ${LIEN_AGENCE}, ${LIEN_SITES}(id, ${LIEN_INSTRUMENTS}(id))`)
    .returns<
      {
        id: string;
        nom: string;
        critique: boolean;
        agence: { nom: string } | null;
        site: { id: string; instrument: { id: string }[] }[];
      }[]
    >();
  if (error) return echec(error);

  const clients = data.map((c) => ({
    id: c.id,
    nom: c.nom,
    critique: c.critique,
    agence: c.agence?.nom ?? "",
    nombreSites: c.site.length,
    nombreInstruments: c.site.reduce((total, s) => total + s.instrument.length, 0),
  }));
  return { ok: true, donnees: clients.sort((a, b) => a.nom.localeCompare(b.nom, "fr")) };
}

export interface InstrumentResume {
  id: string;
  /** Numéro INS-xxxx, ou référence provisoire tant que le serveur n'a pas attribué le numéro. */
  numero: string;
  type: string;
  marque: string;
  modele: string;
  statut: StatutMetrologie;
  echeance: MoisCalendaire | null;
}

export interface SiteDetail {
  id: string;
  nom: string;
  adresse: string | null;
  contact_nom: string | null;
  contact_fonction: string | null;
  contact_telephone: string | null;
  contact_email: string | null;
  distance_km: number;
  instruments: InstrumentResume[];
}

export interface ClientDetail {
  id: string;
  nom: string;
  critique: boolean;
  note: string | null;
  agenceId: string;
  agence: string;
  sites: SiteDetail[];
}

const COLONNES_SITE = "id, nom, adresse, contact_nom, contact_fonction, contact_telephone, contact_email, distance_km";

/** Un client avec ses sites et leurs instruments. `donnees` vaut `null` s'il n'existe pas (ou n'est pas visible). */
export async function lireClient(supabase: ClientSupabase, id: string): Promise<Lecture<ClientDetail | null>> {
  const { data, error } = await supabase
    .from("client")
    .select(
      `id, nom, critique, note, agence_id, ${LIEN_AGENCE}, ` +
        `${LIEN_SITES}(${COLONNES_SITE}, ${LIEN_INSTRUMENTS}(id, numero, reference_provisoire, type, marque, modele, statut_metrologie, echeance_verification))`,
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      nom: string;
      critique: boolean;
      note: string | null;
      agence_id: string;
      agence: { nom: string } | null;
      site: (Omit<SiteDetail, "instruments"> & {
        instrument: {
          id: string;
          numero: string | null;
          reference_provisoire: string | null;
          type: string;
          marque: string;
          modele: string;
          statut_metrologie: StatutMetrologie;
          echeance_verification: MoisCalendaire | null;
        }[];
      })[];
    }>();
  if (error) return echec(error);
  if (!data) return { ok: true, donnees: null };

  return {
    ok: true,
    donnees: {
      id: data.id,
      nom: data.nom,
      critique: data.critique,
      note: data.note,
      agenceId: data.agence_id,
      agence: data.agence?.nom ?? "",
      sites: data.site
        .map(({ instrument, ...site }) => ({
          ...site,
          instruments: instrument
            .map((i) => ({
              id: i.id,
              numero: i.numero ?? i.reference_provisoire ?? "",
              type: i.type,
              marque: i.marque,
              modele: i.modele,
              statut: i.statut_metrologie,
              echeance: i.echeance_verification,
            }))
            .sort((a, b) => a.numero.localeCompare(b.numero)),
        }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    },
  };
}

export interface SiteAModifier extends Omit<SiteDetail, "instruments"> {
  clientId: string;
  client: string;
}

/** Un site et le nom de son client, pour le formulaire de modification. */
export async function lireSite(supabase: ClientSupabase, id: string): Promise<Lecture<SiteAModifier | null>> {
  const { data, error } = await supabase
    .from("site")
    .select(`${COLONNES_SITE}, client_id, client:client!site_client_meme_entreprise(nom)`)
    .eq("id", id)
    .maybeSingle<Omit<SiteDetail, "instruments"> & { client_id: string; client: { nom: string } | null }>();
  if (error) return echec(error);
  if (!data) return { ok: true, donnees: null };
  const { client_id, client, ...site } = data;
  return { ok: true, donnees: { ...site, clientId: client_id, client: client?.nom ?? "" } };
}

/** Les agences de l'entreprise (pour qu'un administrateur choisisse celle d'un nouveau client). */
export async function listerAgences(supabase: ClientSupabase): Promise<Lecture<{ id: string; nom: string }[]>> {
  const { data, error } = await supabase.from("agence").select("id, nom").order("nom").returns<{ id: string; nom: string }[]>();
  return error ? echec(error) : { ok: true, donnees: data };
}

/** Les réglages de déplacement de l'entreprise (§6.4), pour afficher le forfait de chaque site. */
export async function lireReglagesDeplacement(supabase: ClientSupabase): Promise<Lecture<ReglagesDeplacement | null>> {
  const { data, error } = await supabase
    .from("entreprise")
    .select("limite_zone1_km, limite_zone2_km, montant_zone1_centimes, montant_zone2_centimes, montant_zone3_centimes")
    .maybeSingle<{
      limite_zone1_km: number;
      limite_zone2_km: number;
      montant_zone1_centimes: number;
      montant_zone2_centimes: number;
      montant_zone3_centimes: number;
    }>();
  if (error) return echec(error);
  if (!data) return { ok: true, donnees: null };
  return {
    ok: true,
    donnees: {
      limiteZone1Km: data.limite_zone1_km,
      limiteZone2Km: data.limite_zone2_km,
      montantZone1Centimes: data.montant_zone1_centimes,
      montantZone2Centimes: data.montant_zone2_centimes,
      montantZone3Centimes: data.montant_zone3_centimes,
    },
  };
}
