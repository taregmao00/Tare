import { describe, expect, it } from "vitest";
import { classerErreurConnexion, ligneJournalConnexion } from "./erreurs-connexion";
import { estCleSecrete, examinerConfigSupabase } from "./config";

describe("échec de connexion → message pour l'écran", () => {
  it("identifiants faux", () => {
    const d = classerErreurConnexion({ code: "invalid_credentials", status: 400, name: "AuthApiError" });
    expect(d.cas).toBe("identifiants");
    expect(d.message).toBe("Email ou mot de passe incorrect.");
  });

  it("compte créé sans « Auto Confirm User »", () => {
    const d = classerErreurConnexion({ code: "email_not_confirmed", status: 400, message: "Email not confirmed" });
    expect(d.cas).toBe("compte_non_confirme");
    expect(d.piste).toContain("Auto Confirm User");
  });

  it("compte banni dans Supabase", () => {
    expect(classerErreurConnexion({ code: "user_banned", status: 400 }).cas).toBe("compte_desactive");
  });

  it("trop de tentatives", () => {
    expect(classerErreurConnexion({ code: "over_request_rate_limit", status: 429 }).cas).toBe("trop_de_tentatives");
  });

  it("Supabase injoignable (adresse fausse, pas d'Internet, projet en pause)", () => {
    const d = classerErreurConnexion({ name: "AuthRetryableFetchError", status: 0, message: "fetch failed" });
    expect(d.cas).toBe("service_injoignable");
    expect(d.piste).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("clé publique refusée", () => {
    const d = classerErreurConnexion({ name: "AuthApiError", status: 401, message: "Invalid API key" });
    expect(d.cas).toBe("configuration");
    expect(d.piste).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("adresse qui ne pointe pas sur un projet Supabase", () => {
    expect(classerErreurConnexion({ name: "AuthUnknownError", status: 404 }).cas).toBe("configuration");
  });

  it("compte créé par une requête SQL (« Database error querying schema »)", () => {
    const d = classerErreurConnexion({
      name: "AuthRetryableFetchError",
      status: 500,
      code: "unexpected_failure",
      message: "Database error querying schema",
    });
    expect(d.cas).toBe("configuration");
  });

  it("panne passagère du service", () => {
    expect(classerErreurConnexion({ name: "AuthRetryableFetchError", status: 503 }).cas).toBe("service_injoignable");
  });

  it("la ligne du terminal donne le code Supabase et une piste", () => {
    const erreur = { code: "email_not_confirmed", status: 400, name: "AuthApiError", message: "Email not confirmed" };
    const ligne = ligneJournalConnexion(erreur, classerErreurConnexion(erreur));
    expect(ligne).toContain("code Supabase : email_not_confirmed");
    expect(ligne).toContain("statut HTTP : 400");
    expect(ligne).toContain("Piste :");
  });
});

describe("contrôle de la configuration Supabase", () => {
  const URL_OK = "https://abcdefghijkl.supabase.co";
  const CLE_OK = "sb_publishable_abcdefghijklmnop";
  // Anciennes clés : jetons en trois morceaux (ici faux, fabriqués pour l'essai).
  const jeton = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=+$/, "")}.signature`;

  it("accepte une adresse et une clé publique correctes", () => {
    expect(examinerConfigSupabase(URL_OK, CLE_OK)).toEqual({ ok: true, url: URL_OK, clePublique: CLE_OK });
    expect(examinerConfigSupabase(`${URL_OK}/ `, ` ${jeton("anon")}`).ok).toBe(true);
  });

  it("signale une variable vide ou restée sur l'exemple", () => {
    expect(examinerConfigSupabase(undefined, CLE_OK).ok).toBe(false);
    expect(examinerConfigSupabase(URL_OK, "").ok).toBe(false);
    expect(examinerConfigSupabase("https://xxxxxxxxxxxx.supabase.co", "sb_publishable_xxxxxxxxxxxx").ok).toBe(false);
  });

  it("signale une adresse mal recopiée", () => {
    expect(examinerConfigSupabase("abcdefghijkl.supabase.co", CLE_OK).ok).toBe(false);
    expect(examinerConfigSupabase("http://abcdefghijkl.supabase.co", CLE_OK).ok).toBe(false);
    expect(examinerConfigSupabase(`${URL_OK}/rest/v1/`, CLE_OK).ok).toBe(false);
  });

  it("refuse une clé secrète, sans jamais la recopier dans le message", () => {
    for (const secrete of ["sb_secret_abcdefghijklmnop", jeton("service_role")]) {
      expect(estCleSecrete(secrete)).toBe(true);
      const config = examinerConfigSupabase(URL_OK, secrete);
      expect(config.ok).toBe(false);
      if (!config.ok) expect(config.probleme).not.toContain(secrete);
    }
    expect(estCleSecrete(CLE_OK)).toBe(false);
    expect(estCleSecrete(jeton("anon"))).toBe(false);
  });
});
