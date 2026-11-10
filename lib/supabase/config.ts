/**
 * Adresse du projet Supabase et clé publique, lues dans les variables d'environnement
 * (fichier .env.local sur le PC, réglages « Environment Variables » sur Vercel).
 * La clé publique peut être vue par le téléphone : c'est la base (RLS) qui protège les données.
 * Jamais de clé de service ici.
 */

export type ConfigSupabase =
  | { ok: true; url: string; clePublique: string }
  /** `probleme` : phrase en français, qui ne contient jamais la valeur d'une clé. */
  | { ok: false; probleme: string };

const NOM_URL = "NEXT_PUBLIC_SUPABASE_URL";
const NOM_CLE = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

/** Vrai si la clé est une clé secrète (« sb_secret_… » ou ancienne clé « service_role »). */
export function estCleSecrete(cle: string): boolean {
  if (cle.startsWith("sb_secret_")) return true;
  // Anciennes clés : un jeton en trois morceaux, dont le deuxième contient le rôle.
  const morceaux = cle.split(".");
  if (morceaux.length !== 3) return false;
  try {
    const contenu = JSON.parse(atob(morceaux[1].replace(/-/g, "+").replace(/_/g, "/")));
    return contenu?.role === "service_role";
  } catch {
    return false;
  }
}

/**
 * Vérifie les deux variables sans jamais lever d'erreur : sert à l'écran de connexion et à la
 * commande `npm run diagnostic` pour dire en clair ce qui ne va pas.
 */
export function examinerConfigSupabase(
  urlBrute: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  cleBrute: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
): ConfigSupabase {
  const url = (urlBrute ?? "").trim();
  const clePublique = (cleBrute ?? "").trim();

  if (!url) return { ok: false, probleme: `${NOM_URL} est vide (voir .env.example).` };
  if (!clePublique) return { ok: false, probleme: `${NOM_CLE} est vide (voir .env.example).` };
  if (url.includes("xxxx") || clePublique.includes("xxxx")) {
    return {
      ok: false,
      probleme: "les valeurs d'exemple (xxxx…) n'ont pas été remplacées par celles du projet Supabase.",
    };
  }

  let adresse: URL;
  try {
    adresse = new URL(url);
  } catch {
    return { ok: false, probleme: `${NOM_URL} n'est pas une adresse valide (attendu : https://….supabase.co).` };
  }
  const local = adresse.hostname === "localhost" || adresse.hostname === "127.0.0.1";
  if (adresse.protocol !== "https:" && !local) {
    return { ok: false, probleme: `${NOM_URL} doit commencer par https://.` };
  }
  if (adresse.pathname !== "/" || adresse.search || adresse.hash) {
    return {
      ok: false,
      probleme: `${NOM_URL} doit s'arrêter au nom du projet (https://….supabase.co), sans rien derrière.`,
    };
  }

  if (/\s/.test(clePublique)) {
    return { ok: false, probleme: `${NOM_CLE} contient un espace ou un retour à la ligne (mal recopiée ?).` };
  }
  if (estCleSecrete(clePublique)) {
    return {
      ok: false,
      probleme:
        `${NOM_CLE} contient une clé SECRÈTE. Mettre la clé publique (« publishable ») à la place, ` +
        "et régénérer la clé secrète dans Supabase : elle a pu être exposée.",
    };
  }

  return { ok: true, url: adresse.origin, clePublique };
}

/** Même contrôle, mais lève une erreur : pour le code qui ne peut pas continuer sans Supabase. */
export function configSupabase(): { url: string; clePublique: string } {
  const config = examinerConfigSupabase();
  if (!config.ok) throw new Error(`Configuration Supabase incorrecte : ${config.probleme}`);
  return { url: config.url, clePublique: config.clePublique };
}
