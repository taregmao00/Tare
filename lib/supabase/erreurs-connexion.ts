/**
 * Traduit un échec de connexion en deux textes :
 * - `message` : ce que le technicien lit sur l'écran de connexion (simple, sans détail technique) ;
 * - `piste` : ce que le porteur du projet lit dans le terminal du serveur pour corriger.
 * Fonctions pures (aucun accès réseau), testées dans erreurs-connexion.test.ts.
 */

export type CasConnexion =
  | "identifiants"
  | "compte_non_confirme"
  | "compte_desactive"
  | "trop_de_tentatives"
  | "reseau"
  | "service_injoignable"
  | "configuration";

export const MESSAGES_CONNEXION: Record<CasConnexion, string> = {
  identifiants: "Email ou mot de passe incorrect.",
  compte_non_confirme:
    "Ce compte n'est pas encore activé. Demandez à l'administrateur de votre entreprise de le confirmer.",
  compte_desactive:
    "Ce compte est désactivé ou n'est rattaché à aucune entreprise. Contactez l'administrateur de votre entreprise.",
  trop_de_tentatives: "Trop de tentatives. Patientez une minute, puis réessayez.",
  reseau: "Pas de réseau. Vérifiez votre connexion (Wi-Fi ou données mobiles), puis réessayez.",
  service_injoignable:
    "Le service de connexion ne répond pas. Réessayez dans un instant ; si cela dure, prévenez l'administrateur.",
  configuration:
    "L'application est mal configurée (liaison avec la base de données). Prévenez l'administrateur.",
};

/** Ce que Supabase renvoie en cas d'échec (seuls ces champs sont lus : jamais de clé ni de mot de passe). */
export interface ErreurSupabase {
  code?: string | null;
  status?: number | null;
  name?: string | null;
  message?: string | null;
}

export interface DiagnosticConnexion {
  cas: CasConnexion;
  message: string;
  piste: string;
}

function diagnostic(cas: CasConnexion, piste: string): DiagnosticConnexion {
  return { cas, message: MESSAGES_CONNEXION[cas], piste };
}

/** Échec renvoyé par `signInWithPassword` (service de comptes de Supabase). */
export function classerErreurConnexion(erreur: ErreurSupabase): DiagnosticConnexion {
  const code = erreur.code ?? "";
  const statut = erreur.status ?? 0;
  const texte = (erreur.message ?? "").toLowerCase();

  if (code === "invalid_credentials") {
    return diagnostic(
      "identifiants",
      "email inconnu ou mot de passe faux. Supabase : Authentication → Users pour vérifier l'adresse ou remettre un mot de passe.",
    );
  }
  if (code === "email_not_confirmed" || code === "provider_email_needs_verification") {
    return diagnostic(
      "compte_non_confirme",
      "compte créé sans « Auto Confirm User ». Supabase : Authentication → Users → ouvrir le compte → confirmer l'email (ou relancer « npm run demo », qui confirme les comptes de démonstration).",
    );
  }
  if (code === "user_banned") {
    return diagnostic("compte_desactive", "compte banni dans Supabase : Authentication → Users → « Unban user ».");
  }
  if (code === "over_request_rate_limit" || statut === 429) {
    return diagnostic("trop_de_tentatives", "trop d'essais en peu de temps : attendre une minute.");
  }
  if (code === "email_provider_disabled") {
    return diagnostic(
      "configuration",
      "la connexion par email est désactivée. Supabase : Authentication → Sign In / Providers → activer « Email ».",
    );
  }
  if (texte.includes("invalid api key") || texte.includes("unregistered api key") || code === "no_authorization") {
    return diagnostic(
      "configuration",
      "Supabase refuse la clé publique : recopier NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY depuis Project Settings → API Keys, puis relancer « npm run dev ».",
    );
  }
  if (texte.includes("database error")) {
    return diagnostic(
      "configuration",
      "le service de comptes ne lit pas ce compte (souvent un compte créé par une requête SQL au lieu de Authentication → Users). Relancer « npm run demo » ou recréer le compte depuis le tableau de bord.",
    );
  }
  if (erreur.name === "AuthRetryableFetchError" && statut === 0) {
    return diagnostic(
      "service_injoignable",
      "Supabase est injoignable depuis ce serveur : adresse NEXT_PUBLIC_SUPABASE_URL mal recopiée, PC sans Internet, ou projet Supabase en pause. Lancer « npm run diagnostic » pour savoir lequel.",
    );
  }
  if (statut === 404) {
    return diagnostic(
      "configuration",
      "adresse introuvable : NEXT_PUBLIC_SUPABASE_URL ne pointe pas sur un projet Supabase (elle doit s'arrêter à .supabase.co).",
    );
  }
  if (statut === 401 || statut === 403) {
    return diagnostic(
      "configuration",
      "Supabase refuse la requête : vérifier NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Project Settings → API Keys).",
    );
  }
  return diagnostic(
    "service_injoignable",
    "erreur inattendue du service de comptes (projet en pause ou panne passagère ?). Lancer « npm run diagnostic ».",
  );
}

/** Ligne écrite dans le terminal du serveur : la vraie cause, sans clé ni mot de passe. */
export function ligneJournalConnexion(erreur: ErreurSupabase, d: DiagnosticConnexion): string {
  return (
    `[connexion] Échec (${d.cas}) · code Supabase : ${erreur.code || "aucun"} · statut HTTP : ${erreur.status ?? "aucun"}` +
    ` · ${erreur.name || "Erreur"} : ${erreur.message || "sans message"}\n[connexion] Piste : ${d.piste}`
  );
}
