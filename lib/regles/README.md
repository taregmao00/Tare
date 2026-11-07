# lib/regles

Module unique des règles métier (CLAUDE.md §6.3 à §6.6 et §6.8) :
main-d'œuvre facturée, forfait de déplacement, passages, total du bon, statut métrologique.

- Uniquement des **fonctions pures** (pas d'accès à la base, à l'écran ni au réseau).
- Utilisé par l'interface, le PDF et le serveur. Interdit de réécrire ces calculs ailleurs.
- Chaque règle a ses tests (`*.test.ts`), lancés avec `npm test`.

À construire en séances 3-4 de la phase 1.
