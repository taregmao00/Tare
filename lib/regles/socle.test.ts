import { describe, expect, it } from "vitest";

// Test de démarrage : vérifie seulement que Vitest fonctionne.
// À supprimer quand les vraies règles métier seront écrites (séances 3-4).
describe("socle", () => {
  it("Vitest est en place", () => {
    expect(1 + 1).toBe(2);
  });
});
