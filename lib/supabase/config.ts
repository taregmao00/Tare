/**
 * Adresse du projet Supabase et clé publique, lues dans les variables d'environnement
 * (fichier .env.local sur le PC, réglages « Environment Variables » sur Vercel).
 * La clé publique peut être vue par le téléphone : c'est la base (RLS) qui protège les données.
 * Jamais de clé de service ici.
 */
export function configSupabase(): { url: string; clePublique: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clePublique = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clePublique) {
    throw new Error(
      "Configuration Supabase manquante : renseigner NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (voir .env.example).",
    );
  }
  return { url, clePublique };
}
