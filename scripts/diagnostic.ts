/**
 * `npm run diagnostic` : dit en clair pourquoi la connexion ne marche pas.
 * Ne modifie rien dans la base. N'affiche jamais une clé ni un mot de passe.
 */
import { classerErreurConnexion } from "../lib/supabase/erreurs-connexion.ts";
import { examinerConfigSupabase } from "../lib/supabase/config.ts";
import { clientAdmin, clientPublic, cleSecrete, estBanni, tousLesComptes } from "./commun.ts";

const ok = (texte: string) => console.log(`   ✔ ${texte}`);
const ko = (texte: string) => {
  console.log(`   ✖ ${texte}`);
  problemes++;
};
const info = (texte: string) => console.log(`   · ${texte}`);
let problemes = 0;

function conclure(): never {
  console.log(
    problemes === 0
      ? "\nTout est bon de ce côté. Si la connexion échoue encore, regarder la ligne « [connexion] » dans le terminal de « npm run dev »."
      : `\n${problemes} point(s) à corriger ci-dessus (lignes ✖), dans l'ordre.`,
  );
  process.exit(problemes === 0 ? 0 : 1);
}

console.log("Diagnostic Tare (lecture seule, aucune clé affichée)\n");

// 1. Les deux variables de .env.local ---------------------------------------------------------
console.log("1. Fichier .env.local");
const config = examinerConfigSupabase();
if (!config.ok) {
  ko(config.probleme);
  info("Corriger .env.local (modèle : .env.example), puis relancer « npm run dev » et ce diagnostic.");
  conclure();
}
ok(`Adresse du projet : ${config.url}`);
ok(`Clé publique présente (${config.clePublique.length} caractères).`);

// 2. Supabase répond-il, et accepte-t-il la clé ? ----------------------------------------------
console.log("\n2. Supabase répond-il ?");
try {
  const reponse = await fetch(`${config.url}/auth/v1/settings`, {
    headers: { apikey: config.clePublique },
    signal: AbortSignal.timeout(15_000),
  });
  if (reponse.ok) {
    ok("Le service de comptes répond et accepte la clé publique.");
    const reglages = (await reponse.json()) as { external?: { email?: boolean } };
    if (reglages.external?.email === false) {
      ko("La connexion par email est désactivée : Supabase → Authentication → Sign In / Providers → activer « Email ».");
    } else {
      ok("Connexion par email activée.");
    }
  } else if (reponse.status === 401 || reponse.status === 403) {
    ko(
      `Supabase refuse la clé publique (statut ${reponse.status}). Recopier NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ` +
        "depuis Project Settings → API Keys (bouton « copier », sans espace ni guillemet).",
    );
    conclure();
  } else {
    ko(
      `Réponse inattendue (statut ${reponse.status}). L'adresse est-elle bien celle du projet tare-dev ? ` +
        "Le projet est-il en pause (tableau de bord Supabase → « Restore project ») ?",
    );
    conclure();
  }
} catch (erreur) {
  const cause = (erreur as { cause?: { code?: string } }).cause?.code ?? (erreur as Error).name;
  if (cause === "ENOTFOUND") {
    ko("Adresse inconnue sur Internet : NEXT_PUBLIC_SUPABASE_URL est mal recopiée (ou le PC n'a pas d'accès Internet).");
  } else {
    ko(`Supabase est injoignable depuis ce PC (${cause}) : vérifier la connexion Internet, puis l'adresse du projet.`);
  }
  conclure();
}

// 3. Les tables existent-elles ? ----------------------------------------------------------------
console.log("\n3. Tables de la base");
const visiteur = clientPublic(config.url, config.clePublique);
{
  const { error } = await visiteur.from("utilisateur").select("id").limit(1);
  // « permission refusée » est la bonne réponse pour un visiteur non connecté : la table existe.
  if (!error || error.code === "42501") ok("La table « utilisateur » existe (migrations appliquées).");
  else if (error.code === "PGRST205" || error.code === "42P01") {
    ko("La table « utilisateur » n'existe pas : coller les fichiers de supabase/migrations/ dans le SQL Editor, dans l'ordre.");
    conclure();
  } else ko(`Lecture de test refusée (${error.code}) : ${error.message}`);
}

// 4. Les comptes (seulement si la clé secrète est dans .env.admin) --------------------------------
console.log("\n4. Comptes de connexion et fiches utilisateur");
const secrete = cleSecrete();
const emailsAEssayer: string[] = [];
if (!secrete) {
  info("Étape sautée : pas de SUPABASE_SECRET_KEY dans .env.admin (voir .env.admin.example).");
} else {
  const admin = clientAdmin(config.url, secrete);
  const comptes = await tousLesComptes(admin);
  const { data: fiches, error } = await admin
    .from("utilisateur")
    .select("id, email, nom, role, actif, agence(nom), entreprise(nom)")
    .returns<
      { id: string; email: string; nom: string; role: string; actif: boolean; agence: { nom: string } | null; entreprise: { nom: string } | null }[]
    >();
  if (error) ko(`Lecture des fiches impossible (${error.code}) : ${error.message}`);
  if (comptes.length === 0) ko("Aucun compte de connexion : lancer « npm run demo ».");
  for (const compte of comptes) {
    const fiche = fiches?.find((f) => f.id === compte.id);
    const defauts: string[] = [];
    if (!compte.email_confirmed_at) defauts.push("email NON confirmé (compte créé sans « Auto Confirm User »)");
    if (estBanni(compte)) defauts.push("compte suspendu dans Supabase");
    if (!fiche) defauts.push("pas de fiche dans la table « utilisateur »");
    else if (!fiche.actif) defauts.push("fiche désactivée (actif = faux)");
    const detail = fiche ? `${fiche.role}, ${fiche.entreprise?.nom ?? "?"}, ${fiche.agence?.nom ?? "sans agence"}` : "";
    if (compte.email) emailsAEssayer.push(compte.email);
    if (defauts.length === 0) {
      ok(`${compte.email} : compte confirmé, fiche active (${detail}).`);
    } else {
      ko(`${compte.email} : ${defauts.join(" ; ")}. → « npm run demo » répare les comptes de démonstration.`);
    }
  }
}

// 5. Essai de connexion réel avec le mot de passe de démonstration ---------------------------------
console.log("\n5. Essai de connexion (comme l'appli)");
const motDePasse = process.env.DEMO_MOT_DE_PASSE ?? "";
const demo = emailsAEssayer.filter((email) => email.endsWith("@exemple.fr"));
if (!motDePasse || demo.length === 0) {
  info("Étape sautée : il faut SUPABASE_SECRET_KEY et DEMO_MOT_DE_PASSE dans .env.admin, et des comptes @exemple.fr.");
} else {
  for (const email of demo) {
    const essai = clientPublic(config.url, config.clePublique);
    const { error } = await essai.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      const d = classerErreurConnexion(error);
      ko(`${email} : ${d.message} (code Supabase : ${error.code ?? "aucun"}) → ${d.piste}`);
      continue;
    }
    const lecture = await essai.from("intervention").select("id", { count: "exact", head: true });
    if (lecture.error?.code === "42501") {
      ko(`${email} : connexion réussie, mais la migration du cloisonnement (3e fichier de supabase/migrations/) n'est pas appliquée.`);
    } else if (lecture.error) {
      ko(`${email} : connexion réussie, mais lecture des interventions refusée (${lecture.error.code}) : ${lecture.error.message}`);
    } else {
      ok(`${email} : connexion réussie, ${lecture.count ?? 0} intervention(s) visible(s).`);
    }
    await essai.auth.signOut();
  }
}

conclure();
