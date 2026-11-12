/**
 * Outils partagés par les scripts d'administration (`npm run diagnostic`, `npm run demo`).
 * Ces scripts tournent sur le PC du porteur du projet, jamais sur Vercel ni dans le navigateur.
 * Ils lisent :
 *   - .env.local  : adresse du projet et clé publique (les mêmes que l'appli) ;
 *   - .env.admin  : clé SECRÈTE et mot de passe des comptes de démonstration (voir .env.admin.example).
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { estCleSecrete, examinerConfigSupabase } from "../lib/supabase/config.ts";

export function arreter(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Adresse du projet et clé publique, ou arrêt avec une explication. */
export function configPublique(): { url: string; clePublique: string } {
  const config = examinerConfigSupabase();
  if (!config.ok) arreter(`Fichier .env.local : ${config.probleme}`);
  return config;
}

/** Clé secrète lue dans .env.admin (`undefined` si elle n'y est pas). Jamais affichée. */
export function cleSecrete(): string | undefined {
  const cle = (process.env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!cle || cle.includes("xxxx")) return undefined;
  if (!estCleSecrete(cle)) {
    arreter(
      "Fichier .env.admin : SUPABASE_SECRET_KEY n'est pas une clé secrète.\n" +
        "  Attendu : la clé « Secret key » (sb_secret_…) de Supabase → Project Settings → API Keys.",
    );
  }
  return cle;
}

/** Connexion « administrateur » : passe au-dessus du cloisonnement. À n'utiliser que dans ces scripts. */
export function clientAdmin(url: string, cle: string): SupabaseClient {
  return createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Connexion ordinaire, comme celle de l'appli (clé publique, soumise au cloisonnement). */
export function clientPublic(url: string, clePublique: string): SupabaseClient {
  return createClient(url, clePublique, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Tous les comptes de connexion du projet (lus page par page). */
export async function tousLesComptes(admin: SupabaseClient): Promise<User[]> {
  const comptes: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) arreter(`Lecture des comptes impossible (${error.code ?? error.status}) : ${error.message}`);
    comptes.push(...data.users);
    if (data.users.length < 200) return comptes;
  }
}

/** Vrai si le compte est suspendu dans Supabase (« banned »). */
export function estBanni(compte: User): boolean {
  const jusquA = (compte as User & { banned_until?: string | null }).banned_until;
  return Boolean(jusquA) && new Date(jusquA as string).getTime() > Date.now();
}
