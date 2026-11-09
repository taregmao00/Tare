# Tare

GMAO pour installateurs et réparateurs de balances (nom de travail).
Version en ligne (développement) : https://tare-hr7q.vercel.app — mise à jour automatique à chaque envoi sur GitHub.

Le cahier des charges complet est dans [CLAUDE.md](CLAUDE.md) ; `prototype.html` sert de référence pour les écrans.

## Commandes

- `npm run dev` : lance l'appli sur le PC, à ouvrir sur http://localhost:3000
- `npm test` : lance les tests des règles métier
- `npm run lint` : vérifie le code
- `npm run build` : construit la version de production

## Base de données (Supabase)

- Projet de développement : `tare-dev` (données fictives uniquement).
- Variables d'environnement : voir `.env.example` (à copier en `.env.local`, et à renseigner dans Vercel).
- Les changements de base sont des fichiers versionnés dans `supabase/migrations/`, appliqués dans l'ordre de leur nom.
- `supabase/tests/` : essais des verrous de la base, à lancer sur un Postgres local (jamais sur un vrai projet).
