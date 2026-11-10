# Mission du 10/11/2026 : terminer la phase 1

Ce document liste **les résultats attendus**. Le « comment » est à ton choix, dans le respect de
`CLAUDE.md` (qui fait foi). Le porteur du projet n'est pas développeur : explique en français simple
et demande avant toute décision difficile à défaire (structure de base, nouvelle dépendance,
suppression de données).

## Point de départ

- Partir de la branche `claude/session-continuation-cvpzf8` (pas encore fusionnée dans `main`).
- Séances 1 à 6 faites : projet Next.js 16 (`cacheComponents` activé ; lire
  `node_modules/next/dist/docs/` avant d'écrire du code Next), module `lib/regles/` (79 tests),
  connexion Supabase (`proxy.ts`, `lib/supabase/`, `app/connexion/`), deux migrations dans
  `supabase/migrations/`, essais des verrous dans `supabase/tests/`.
- **Les deux migrations existantes sont déjà appliquées** sur le projet Supabase `tare-dev`
  (le porteur les a collées dans le SQL Editor). Ne plus jamais les modifier : tout changement de
  base passe par un **nouveau** fichier de migration.
- Tu n'as pas accès au tableau de bord Supabase ni au PC du porteur. Tout ce qu'il doit faire
  lui-même (coller une migration, lancer un script) doit lui être expliqué pas à pas.
- Décisions déjà prises : réglages de l'entreprise en colonnes contrôlées ; échéance stockée en
  texte `AAAA-MM` ; signature stockée dans la ligne du bon ; RLS activée sans règle sur les tables
  de la séance 6.

## Résultats attendus

### 0. La connexion de Karim fonctionne

Constat : sur le PC (`npm run dev`, localhost:3000), la connexion avec `karim@exemple.fr` affiche
« Connexion impossible pour le moment ». Les migrations sont passées.

- La cause est trouvée et corrigée, ou expliquée au porteur avec la marche à suivre (pistes :
  compte créé sans « Auto Confirm User », adresse ou clé mal recopiée dans `.env.local`).
- L'écran de connexion distingue les cas utiles au terrain : identifiants faux, compte non confirmé
  ou désactivé, réseau absent, configuration de l'appli incorrecte.
- La vraie cause technique apparaît dans le terminal du serveur (code d'erreur Supabase), sans jamais
  afficher de clé ni de mot de passe.

### 1. Cloisonnement par agence (séance 7)

Nouvelle migration qui ouvre la **lecture** depuis l'appli, table par table, selon §4 et §8 :

| Qui | Voit |
| --- | --- |
| Visiteur non connecté, compte désactivé, compte sans fiche | rien |
| Tout utilisateur actif | son entreprise, ses agences, les utilisateurs de son entreprise, le catalogue |
| Technicien, chef d'agence | uniquement les données de **leur agence** : clients, sites, instruments, interventions et tout ce qui en dépend (instruments d'intervention, segments, journal, bons, lignes, photos) |
| Gestionnaire, administrateur | les mêmes données pour **toutes les agences** de l'entreprise |
| Alertes | chef d'agence (son agence), gestionnaire et administrateur (toutes) ; jamais le technicien |

- Personne ne voit quoi que ce soit d'une autre entreprise.
- Aucune écriture n'est ouverte depuis l'appli dans cette séance (elles viendront bloc par bloc en
  phase 2) ; les verrous existants (journal, bon signé, retrait d'instrument) restent intacts.
- **Tests au niveau de la base** (pas de l'écran), avec au minimum le cas exigé par §9 : un
  technicien de l'agence A ne lit aucune ligne de l'agence B, sur chaque table concernée ; le
  gestionnaire lit les deux ; une autre entreprise ne lit rien ; un visiteur et un compte désactivé
  ne lisent rien.

### 2. Tous les tests tournent sur GitHub à chaque envoi

- À chaque envoi de code et à chaque demande de fusion : lint, tests `lib/regles/`, construction de
  l'appli, application des migrations sur une base Postgres vierge, essais des verrous et du
  cloisonnement.
- Un essai qui échoue fait apparaître une croix rouge sur GitHub ; le message dit en clair quel
  essai a échoué.
- Aucune clé ni donnée réelle dans cette configuration ; aucune nouvelle dépendance npm sans accord.

### 3. Script d'administration et données de démonstration (séance 8)

- Un script, lancé par le porteur depuis son PC avec une commande documentée, crée l'entreprise de
  démonstration du §11 dans `tare-dev` : les 4 utilisateurs avec leur rôle et leur habilitation, les
  6 clients et leurs sites (distances 18, 32, 4, 24, 3, 3 km), les 8 instruments `INS-0421` à
  `INS-0910`, le catalogue de 3 articles, et les interventions du prototype (`prototype.html`, avec
  la vérification Primeurs Dubois sur INS-0802 **et** INS-0803).
- Une seule agence, sauf meilleure proposition validée par le porteur ; Nadia G. sans agence.
- Le script peut être relancé sans créer de doublons. L'entreprise « Pesage Démo » et le compte
  Karim créés à la main sont **réutilisés**, jamais supprimés.
- La clé secrète Supabase et le mot de passe des comptes de démo sont lus dans des variables
  d'environnement du PC, jamais écrits dans le code, jamais envoyés à Vercel ni au navigateur.
- Uniquement des données fictives (marques Tarvex, Balix ; téléphones `06 00 00 00 0X` ; emails
  `@exemple.fr`).

### 4. Liste des interventions sur le téléphone (séance 9)

- Une fois connecté, l'écran d'accueil affiche les interventions lues depuis la base, avec le
  cloisonnement de la séance 7 : Karim voit celles de son agence, Nadia celles de toutes les agences.
- Tri du §6.1 : En cours, À faire, Prise, Terminée, Facturée ; à statut égal, urgentes d'abord, puis
  par date de réception.
- Chaque carte montre au moins : numéro, client, site, type, priorité (urgente bien visible), statut
  (« En cours » si un segment tourne, « En pause » sinon) et titulaire.
- Liste vide : message explicite. Mobile d'abord, cibles ≥ 44 px, thèmes clair et sombre.
- Lecture seule : ni filtres, ni compteurs, ni actions (prévus en phase 2).

## Rendu

- Un commit par étape, messages en français.
- Une **demande de fusion** (pull request) vers `main` avec un résumé en français ; ne pas fusionner
  toi-même.
- Pour le porteur, en fin de séance :
  - ce qui a été fait ;
  - la liste **dans l'ordre** des fichiers SQL à coller dans le SQL Editor ;
  - la commande du script de démonstration ;
  - comment tester sur le téléphone ;
  - ce qui reste.
