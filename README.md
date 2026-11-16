# Tare

GMAO pour installateurs et réparateurs de balances (nom de travail).
Version en ligne (développement) : https://tare-hr7q.vercel.app — mise à jour automatique à chaque envoi sur GitHub.

Le cahier des charges complet est dans [CLAUDE.md](CLAUDE.md) ; `prototype.html` sert de référence pour les écrans.

## Commandes

- `npm run dev` : lance l'appli sur le PC, à ouvrir sur http://localhost:3000
- `npm test` : lance les tests des règles métier et des données de démonstration
- `npm run lint` : vérifie le code
- `npm run build` : construit la version de production
- `npm run demo` : crée ou complète l'entreprise de démonstration dans `tare-dev` (voir plus bas)
- `npm run diagnostic` : dit en clair pourquoi la connexion ne marche pas (ne modifie rien)

## Base de données (Supabase)

- Projet de développement : `tare-dev` (données fictives uniquement).
- Variables d'environnement de l'appli : voir `.env.example` (à copier en `.env.local`, et à renseigner dans Vercel).
- Les changements de base sont des fichiers versionnés dans `supabase/migrations/`. On ne modifie jamais
  un fichier déjà appliqué : tout changement passe par un nouveau fichier.

### Appliquer les migrations sur `tare-dev`

Dans Supabase → SQL Editor, coller puis exécuter chaque fichier **dans cet ordre**, une seule fois chacun :

1. `20261109120000_entreprise_agence_utilisateur.sql` (séance 5)
2. `20261109130000_tables_metier.sql` (séance 6)
3. `20261110090000_cloisonnement_lecture.sql` (séance 7 : qui voit quoi)
4. `20261112090000_ecriture_clients_sites_instruments.sql` (phase 2, bloc 1 : qui peut créer et modifier clients, sites, instruments)

### Données de démonstration

Les 5 comptes, 6 clients, 8 instruments, le catalogue et les 9 interventions du prototype (CLAUDE.md §11).

1. Copier `.env.admin.example` en `.env.admin` et le remplir : clé **secrète** du projet `tare-dev`
   et mot de passe commun des comptes de démonstration. Ce fichier reste sur le PC : jamais sur GitHub,
   jamais dans Vercel, jamais dans `.env.local`.
2. Lancer `npm run demo`.

Le script peut être relancé autant de fois qu'on veut : ce qui existe déjà est gardé tel quel, seul ce qui
manque est créé, rien n'est supprimé. Il confirme les 5 comptes et leur donne le mot de passe de démonstration.
Il refuse de tourner sur une base qui contient des comptes hors `@exemple.fr`.

Comptes : `karim@exemple.fr` (technicien habilité), `lucas@exemple.fr` (technicien), `sophie@exemple.fr`
(cheffe d'agence), `nadia@exemple.fr` (gestionnaire, toutes les agences), `claire@exemple.fr` (administratrice, toutes les agences).

### La connexion ne marche pas ?

1. Regarder le terminal de `npm run dev` : chaque échec écrit une ligne `[connexion]` avec le code d'erreur
   de Supabase et une piste de correction.
2. Lancer `npm run diagnostic` : il contrôle `.env.local`, la liaison avec Supabase, les tables, les comptes,
   puis essaie une vraie connexion avec chaque compte de démonstration.

## Essais automatiques

À chaque envoi sur GitHub et à chaque demande de fusion (`.github/workflows/essais.yml`) :

- **Appli** : lint, tests (`npm test`), construction ;
- **Base** : les migrations sont rejouées sur un Postgres vierge, puis `supabase/tests/verrous.sql`
  (journal en ajout seul, bon signé verrouillé…) et `supabase/tests/cloisonnement.sql` (qui voit quoi,
  rôle par rôle, sur chaque table) et `supabase/tests/ecritures_parc.sql` (qui peut créer et modifier
  clients, sites et instruments).

Une croix rouge sur GitHub = un essai a échoué ; le message indique lequel.
Pour lancer les essais de la base sur un PC qui a Postgres : `bash supabase/tests/lancer.sh`
(uniquement sur un Postgres local, jamais sur un projet Supabase).
