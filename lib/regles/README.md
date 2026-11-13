# lib/regles

Module unique des règles métier. Uniquement des **fonctions pures** (pas d'accès à la base,
à l'écran ni au réseau), utilisées par l'interface, le PDF, le serveur et les scripts (`scripts/`).
**Interdit de réécrire ces calculs ailleurs** : importer depuis `@/lib/regles`.

| Fichier | Règles (CLAUDE.md) |
| --- | --- |
| `dates.ts` | jour et heure de Paris, calculs sur les dates |
| `main-oeuvre.ts` | §6.2-6.3 : fusion des segments, temps réel, arrondi à la demi-heure, montant MO |
| `deplacement.ts` | §6.4 : zones et forfait, passages, nombre de forfaits |
| `montants.ts` | §6.5-6.6 : arrondi au centime, lignes, total HT |
| `metrologie.ts` | §6.8 : vignettes, échéance, conséquences d'un bon signé, priorité Parc |
| `rectificatif.ts` | §6.7 : ce qu'un rectificatif peut changer, et ses conséquences |
| `horloge.ts` | §6.9 : segments en avance, écart d'horloge |
| `interventions.ts` | §6.1 : ordre de la liste, statut affiché (« En cours » / « En pause »), urgence |
| `roles.ts` | §4 et §7 : rôles, qui gère le parc, onglets selon le rôle |
| `parc.ts` | §5 : contrôle de la saisie d'un client et d'un site |

Montants en **centimes entiers**. Instants en `Date` (UTC), jours en texte `AAAA-MM-JJ` (Paris).

Tests : `npm test` (un fichier `*.test.ts` à côté de chaque règle).
