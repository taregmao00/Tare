# lib/regles

Module unique des règles métier. Uniquement des **fonctions pures** (pas d'accès à la base,
à l'écran ni au réseau), utilisées par l'interface, le PDF, le serveur et les scripts (`scripts/`).
**Interdit de réécrire ces calculs ailleurs** : importer depuis `@/lib/regles`.

| Fichier | Règles (CLAUDE.md) |
| --- | --- |
| `dates.ts` | jour et heure de Paris, calculs sur les dates |
| `main-oeuvre.ts` | §6.2-6.3 : fusion des segments, temps réel, arrondi à la demi-heure, montant MO (aussi à partir des minutes figées d'un bon) |
| `deplacement.ts` | §6.4 : zones et forfait, passages, nombre de forfaits |
| `montants.ts` | §6.5-6.6 : arrondi au centime, lignes, total HT |
| `metrologie.ts` | §6.8 : vignettes, échéance, conséquences d'un bon signé, priorité Parc |
| `rectificatif.ts` | §6.7 : ce qu'un rectificatif peut changer, et ses conséquences |
| `reference.ts` | Référence externe des interventions : nettoyage, comparaison, total de main-d'œuvre de plusieurs interventions (arrondi par intervention) |
| `horloge.ts` | §6.9 : segments en avance, écart d'horloge |
| `interventions.ts` | §6.1 : ordre de la liste, statut affiché (« En cours » / « En pause »), urgence |
| `roles.ts` | §4 et §7 : rôles, qui gère le parc, onglets selon le rôle |
| `parc.ts` | §5 : contrôle de la saisie d'un client, d'un site et d'un instrument (champs obligatoires, vignette, échéance) |
| `import-instruments.ts` | Import CSV des instruments : contrôle ligne par ligne, tout ou rien, n° de série déjà connus (la lecture du fichier lui-même est dans `lib/csv.ts`) |

Montants en **centimes entiers**. Instants en `Date` (UTC), jours en texte `AAAA-MM-JJ` (Paris).

Tests : `npm test` (un fichier `*.test.ts` à côté de chaque règle).
