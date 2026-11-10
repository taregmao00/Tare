/**
 * `npm run demo` : crée (ou complète) l'entreprise de démonstration du §11 dans le projet Supabase
 * de développement. À lancer sur le PC, jamais sur Vercel.
 *
 * - Peut être relancé autant de fois qu'on veut : ce qui existe déjà est gardé tel quel,
 *   seul ce qui manque est créé. Rien n'est jamais supprimé.
 * - L'entreprise « Pesage Démo » et le compte de Karim créés à la main sont réutilisés.
 * - Les 4 comptes de démonstration sont confirmés et reçoivent le mot de passe DEMO_MOT_DE_PASSE.
 * - La clé secrète et le mot de passe sont lus dans .env.admin ; ils ne sont jamais affichés.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { arreter, clientAdmin, cleSecrete, configPublique, estBanni, tousLesComptes } from "./commun.ts";
import {
  AGENCE_DEMO,
  construireDemo,
  NOM_ENTREPRISE_DEMO,
  UTILISATEURS_DEMO,
  type CleUtilisateur,
} from "./donnees-demo.ts";

/** Arrête le script avec une explication si Supabase a refusé une opération. */
function exiger<T>(quoi: string, resultat: { data: T; error: { message: string; code?: string } | null }): T {
  if (resultat.error) {
    arreter(`${quoi} : refusé par Supabase (${resultat.error.code ?? "sans code"}) — ${resultat.error.message}`);
  }
  return resultat.data;
}

// --- 1. Réglages lus sur le PC ---------------------------------------------------------------
const { url } = configPublique();
const secrete = cleSecrete();
if (!secrete) {
  arreter(
    "Il manque SUPABASE_SECRET_KEY dans le fichier .env.admin.\n" +
      "  Copier .env.admin.example en .env.admin, puis y coller la clé « Secret key » du projet tare-dev.",
  );
}
const motDePasse = process.env.DEMO_MOT_DE_PASSE ?? "";
if (motDePasse.length < 8) {
  arreter("Il manque DEMO_MOT_DE_PASSE dans .env.admin (mot de passe des comptes de démonstration, 8 caractères au moins).");
}

console.log(`Démonstration Tare → projet ${url}\n`);
const admin: SupabaseClient = clientAdmin(url, secrete);

// --- 2. Garde-fou : jamais sur une base qui contient de vrais comptes ---------------------------
{
  const vrais = exiger(
    "Lecture des utilisateurs",
    await admin.from("utilisateur").select("email").not("email", "like", "%@exemple.fr").limit(5),
  );
  if (vrais.length > 0) {
    arreter(
      "Cette base contient des utilisateurs dont l'email ne finit pas par @exemple.fr.\n" +
        "  Le script de démonstration ne s'utilise que sur le projet de développement (données fictives).",
    );
  }
}

// --- 3. Entreprise « Pesage Démo » (réutilisée si elle existe) ---------------------------------
type Entreprise = {
  id: string;
  taux_horaire_centimes: number;
  limite_zone1_km: number;
  limite_zone2_km: number;
  montant_zone1_centimes: number;
  montant_zone2_centimes: number;
  montant_zone3_centimes: number;
  prefixe_numerotation: string;
};
const COLONNES_ENTREPRISE =
  "id, taux_horaire_centimes, limite_zone1_km, limite_zone2_km, montant_zone1_centimes, montant_zone2_centimes, montant_zone3_centimes, prefixe_numerotation";

let entreprise: Entreprise;
{
  const trouvees = exiger(
    "Recherche de l'entreprise",
    await admin.from("entreprise").select(COLONNES_ENTREPRISE).eq("nom", NOM_ENTREPRISE_DEMO).returns<Entreprise[]>(),
  );
  if (trouvees.length > 1) {
    arreter(`Il existe ${trouvees.length} entreprises nommées « ${NOM_ENTREPRISE_DEMO} » : impossible de choisir. Rien n'a été modifié.`);
  }
  if (trouvees.length === 1) {
    entreprise = trouvees[0];
    console.log(`✔ Entreprise « ${NOM_ENTREPRISE_DEMO} » : déjà présente, réutilisée.`);
  } else {
    entreprise = exiger(
      "Création de l'entreprise",
      await admin.from("entreprise").insert({ nom: NOM_ENTREPRISE_DEMO }).select(COLONNES_ENTREPRISE).single<Entreprise>(),
    );
    console.log(`✔ Entreprise « ${NOM_ENTREPRISE_DEMO} » : créée.`);
  }
}

// --- 4. Comptes existants et fiche de Karim ------------------------------------------------------
const comptes = await tousLesComptes(admin);
const compteDe = (email: string): User | undefined => comptes.find((c) => c.email?.toLowerCase() === email);

type Fiche = { id: string; email: string; entreprise_id: string; agence_id: string | null };
const fiches = exiger(
  "Lecture des fiches utilisateur",
  await admin
    .from("utilisateur")
    .select("id, email, entreprise_id, agence_id")
    .in("email", UTILISATEURS_DEMO.map((u) => u.email))
    .returns<Fiche[]>(),
);
for (const fiche of fiches) {
  if (fiche.entreprise_id !== entreprise.id) {
    arreter(
      `Le compte ${fiche.email} est rattaché à une autre entreprise que « ${NOM_ENTREPRISE_DEMO} ».\n` +
        "  Le script ne déplace jamais un utilisateur d'une entreprise à l'autre. Rien d'autre n'a été modifié.",
    );
  }
}

// --- 5. Agence : celle de Karim si elle existe, sinon la seule agence, sinon on la crée --------
let agenceId: string;
{
  const agences = exiger(
    "Lecture des agences",
    await admin.from("agence").select("id, nom").eq("entreprise_id", entreprise.id).order("cree_le").returns<{ id: string; nom: string }[]>(),
  );
  const agenceKarim = fiches.find((f) => f.email === "karim@exemple.fr")?.agence_id;
  const choisie = agences.find((a) => a.id === agenceKarim) ?? agences[0];
  if (choisie) {
    agenceId = choisie.id;
    console.log(`✔ Agence « ${choisie.nom} » : déjà présente, réutilisée.`);
  } else {
    const creee = exiger(
      "Création de l'agence",
      await admin.from("agence").insert({ entreprise_id: entreprise.id, ...AGENCE_DEMO }).select("id").single<{ id: string }>(),
    );
    agenceId = creee.id;
    console.log(`✔ Agence « ${AGENCE_DEMO.nom} » : créée.`);
  }
}

// --- 6. Les 4 comptes : créés ou réparés (confirmés, mot de passe de démonstration) -------------
const utilisateurs = {} as Record<CleUtilisateur, string>;
for (const u of UTILISATEURS_DEMO) {
  const existant = compteDe(u.email);
  let id: string;
  if (existant) {
    const reparations = [
      existant.email_confirmed_at ? null : "email confirmé",
      estBanni(existant) ? "suspension levée" : null,
    ].filter(Boolean);
    const { error } = await admin.auth.admin.updateUserById(existant.id, {
      password: motDePasse,
      email_confirm: true,
      ban_duration: "none",
    });
    if (error) arreter(`Compte ${u.email} : mise à jour refusée par Supabase (${error.code ?? error.status}) — ${error.message}`);
    id = existant.id;
    console.log(`✔ Compte ${u.email} : déjà présent, réutilisé (mot de passe de démonstration appliqué${reparations.map((r) => `, ${r}`).join("")}).`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: motDePasse, email_confirm: true });
    if (error || !data.user) {
      arreter(`Compte ${u.email} : création refusée par Supabase (${error?.code ?? error?.status}) — ${error?.message}`);
    }
    id = data.user.id;
    console.log(`✔ Compte ${u.email} : créé.`);
  }
  utilisateurs[u.cle] = id;

  // Fiche utilisateur : rôle, habilitation et agence de la démonstration (§11).
  const fiche = {
    id,
    entreprise_id: entreprise.id,
    agence_id: u.avecAgence ? agenceId : null,
    nom: u.nom,
    email: u.email,
    role: u.role,
    habilite_verifications: u.habilite,
    actif: true,
  };
  exiger(`Fiche de ${u.nom}`, await admin.from("utilisateur").upsert(fiche, { onConflict: "id" }).select("id"));
}

// --- 7. Clients, sites, instruments, catalogue, interventions, bons ------------------------------
const NOMS: Record<string, string> = {
  client: "Clients",
  site: "Sites",
  instrument: "Instruments",
  article: "Articles du catalogue",
  intervention: "Interventions",
  intervention_instrument: "Instruments des interventions",
  segment_chrono: "Segments de chrono",
  journal: "Lignes de journal",
  bon: "Bons signés",
  bon_instrument: "Sections « instrument » des bons",
  ligne_bon: "Lignes de pièces",
};

const lots = construireDemo({
  entrepriseId: entreprise.id,
  agenceId,
  utilisateurs,
  reglages: {
    tauxHoraireCentimes: entreprise.taux_horaire_centimes,
    limiteZone1Km: entreprise.limite_zone1_km,
    limiteZone2Km: entreprise.limite_zone2_km,
    montantZone1Centimes: entreprise.montant_zone1_centimes,
    montantZone2Centimes: entreprise.montant_zone2_centimes,
    montantZone3Centimes: entreprise.montant_zone3_centimes,
    prefixeNumerotation: entreprise.prefixe_numerotation,
  },
  maintenant: new Date(),
});

for (const lot of lots) {
  if (lot.lignes.length === 0) continue;
  // « ignoreDuplicates » : une ligne déjà présente n'est ni modifiée ni recréée.
  const creees = exiger(
    NOMS[lot.table],
    await admin
      .from(lot.table)
      .upsert(lot.lignes, { onConflict: lot.cle, ignoreDuplicates: true })
      .select(lot.cle.split(",")[0]),
  );
  const deja = lot.lignes.length - creees.length;
  console.log(
    `✔ ${NOMS[lot.table]} : ${creees.length} créé(s)${deja > 0 ? `, ${deja} déjà présent(s) (gardés tels quels)` : ""}.`,
  );
}

console.log(
  "\nTerminé. Comptes de démonstration (mot de passe : celui de DEMO_MOT_DE_PASSE dans .env.admin) :\n" +
    UTILISATEURS_DEMO.map((u) => `  - ${u.email} (${u.nom})`).join("\n") +
    "\nVérifier ensuite avec : npm run diagnostic",
);
