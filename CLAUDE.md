# CLAUDE.md — Tare, GMAO pour installateurs et réparateurs de balances

Ce fichier décrit le produit à construire et la façon de travailler sur ce projet.
Lis-le en entier avant toute tâche. En cas de doute entre ce fichier et une demande, demande-moi.
**Ce fichier fait foi** : en cas d'écart avec le prototype, c'est ce fichier qui gagne.

---

## 1. Qui je suis et comment travailler avec moi

- Je suis le porteur du projet. Je viens du terrain (maintenance, électricité, mesure), **pas du développement**.
- Explique tes choix en français simple, sans jargon inutile. Quand un terme technique est nécessaire, définis-le en une phrase.
- **Avant toute fonctionnalité nouvelle : propose un plan** (fichiers touchés, ce que tu réutilises, ce que tu crées) et attends ma validation.
- Pour toute décision difficile à défaire (structure de la base, bibliothèque majeure, suppression de données, changement d'architecture) : **demande avant d'agir**.
- Je travaille environ 1 h par jour. Découpe le travail en morceaux qui tiennent dans une séance et qui laissent l'appli dans un état qui fonctionne.
- À la fin de chaque séance, résume : ce qui a été fait, comment le tester sur mon téléphone, ce qui reste.

## 2. Règles absolues

1. **Aucune donnée réelle d'une entreprise** (clients, tarifs, fichiers de références, documents internes) dans le code, les tests ou la base de développement. Uniquement des **données fictives**.
2. **Un bon d'intervention signé est verrouillé** : plus aucune modification possible, ni par l'interface ni par l'API. Une erreur se corrige uniquement par un **bon rectificatif** (§6.7), qui ne peut jamais assouplir une décision métrologique.
3. **Aucune fonction pour contourner la réglementation métrologique** (masquer la nature d'une intervention, remettre en service un instrument « À vérifier », antidater, supprimer une ligne du journal). Toute correction est tracée avec son auteur, sa date et son motif.
4. **Le journal d'une intervention est en ajout seul** : on n'efface ni ne modifie une entrée.
5. Chaque entreprise cliente ne voit **que ses propres données** (cloisonnement strict, voir §8).
6. Les clés et mots de passe ne sont jamais écrits dans le code ni dans la conversation : variables d'environnement uniquement.

---

## 3. Le produit en une phrase

Une appli mobile (PWA) qui permet aux techniciens d'une société de pesage de **choisir leurs interventions, chronométrer la main-d'œuvre, remplir un bon numérique signé par le client**, et qui suit automatiquement **les obligations de métrologie légale** de chaque instrument.

**Utilisateurs cibles :** sociétés qui installent, réparent et vérifient des instruments de pesage (balances, plateformes, ponts-bascules…), organisées en une ou plusieurs agences.

**Problèmes résolus :**
- Demandes suivies dans un Excel, oublis, urgences mal priorisées.
- Bons d'intervention sur carnet autocopiant, ressaisis au bureau, archives lentes à retrouver.
- Temps et déplacements notés à la main, facturation approximative.
- Échéances de vérification périodique suivies à la main.

**Ce que le produit ne fait PAS (V1) :** planning des techniciens (abandonné volontairement : jamais respecté sur le terrain), gestion de stock, commandes fournisseurs, facturation comptable, portail client, inscription en libre-service.

**Prototype :** `prototype.html`, à la racine du projet (HTML autonome, données fictives, s'ouvre dans un navigateur). Il sert de référence pour les écrans, les textes et l'enchaînement. Ne pas réutiliser son code. Ses règles de calcul peuvent être en retard sur ce fichier.

---

## 4. Rôles

| Rôle | Peut faire |
| --- | --- |
| Technicien | Voir les interventions de son agence, prendre une intervention, lancer/mettre en pause le chrono, corriger son propre temps (avec motif), remplir et faire signer un bon, créer une demande, **créer un instrument depuis une intervention** (sans pouvoir modifier ni supprimer ceux du parc) |
| Chef d'agence | Tout ce que fait le technicien + gérer clients, sites, instruments de son agence, **corriger le temps d'un technicien avant signature** (avec motif), créer un bon rectificatif, marquer « Facturée » |
| Gestionnaire (bureau / siège) | Voir les interventions et les bons de **toutes les agences** en lecture, marquer « Facturée », exporter en **CSV simple** les bons terminés (numéro, date, client, agence, MO, déplacement, pièces, petit matériel, total HT) sur une période. Ne gère ni clients, ni instruments, ni interventions, ne touche pas au chrono |
| Administrateur (entreprise) | Tout + réglages de l'entreprise (tarifs, forfaits, catalogue, utilisateurs, habilitations, agences) |

Un utilisateur a un attribut **habilité vérifications** (oui/non). Seuls les habilités peuvent prendre ou démarrer une intervention de type Vérification.

---

## 5. Modèle de données (V1)

**Identifiants** : chaque ligne a un **UUID généré par le téléphone** (ou le serveur), pour pouvoir créer bons, segments, instruments hors ligne. Les numéros lisibles (`INT-`, `BI-`, `INS-`) sont des colonnes à part, attribuées par le serveur.

**Heures** : toutes stockées en **UTC**, affichées à l'heure de Paris (Europe/Paris), y compris pour le calcul des passages et le contrôle d'horloge.

Toutes les tables métier portent `entreprise_id`. L'intervention porte aussi **`agence_id`** directement (même si on peut la retrouver par le client), pour des règles de cloisonnement simples. Noms de tables et de colonnes en snake_case, en français, **sans accents** (ex. `recue_le`, `echeance_verification`). Les accents restent dans l'interface. Les noms ci-dessous décrivent le contenu ; adapte-les à cette règle.

- **entreprise** : nom, réglages (taux horaire, limites et montants des forfaits de déplacement, montant du forfait consommables, préfixe de numérotation).
- **agence** : entreprise, nom, adresse.
- **utilisateur** : entreprise, agence, nom, email, rôle, habilité_verifications, actif.
- **client** : entreprise, agence, nom, critique (bool), note (ex. « un seul pont-bascule, expéditions à l'arrêt »).
- **site** : client, nom, adresse, contact (nom, fonction, téléphone, **email**), **distance_km** (aller, depuis l'agence).
- **instrument** : site, numéro interne (ex. `INS-0421`), type, marque, modèle, n° de série, portée max, échelon (e), millésime, emplacement, statut_metrologie, échéance_verification, motif_statut.
- **intervention** : numéro (`INT-0001`…), type (Réparation | Vérification | Installation), client, site, priorité (normale | urgente), statut, **titulaire** (utilisateur), reçue_le, durée estimée, nombre de personnes prévu, description.
- **intervention_instrument** : intervention, instrument. **Une intervention concerne un ou plusieurs instruments du même site** (ex. 5 balances d'un primeur vérifiées dans la même visite).
- **segment_chrono** : intervention, démarré_par (utilisateur), appareil (identifiant du téléphone), début, fin (nulle si en cours), recu_serveur_le. **Le chrono appartient à l'intervention**, pas au technicien.
- **journal** : intervention, horodatage, auteur, texte. Ajout seul.
- **bon** : intervention, numéro définitif (`BI-AAAA-NNNN`, nul tant que non synchronisé), référence provisoire, statut (valide | annule_remplace | refuse), bon_remplace_id (nullable), motif_rectification, date/heure de signature, titulaire, travaux réalisés, minutes_chrono, minutes_corrigées (nullable), motif_correction, corrigé_par, nombre_personnes, minutes_facturées_par_personne, taux_horaire_appliqué, distance_km, forfait_deplacement_appliqué, libellé_zone, nombre_passages (calculé), nombre_passages_corrige + motif (nullable), nombre_forfaits_factures, nom_signataire, signature (image), email_envoi, envoyé (bool), total_ht, recu_serveur_le, ecart_horloge_minutes.
- **bon_instrument** : bon, instrument, chaîne_de_mesure_touchée (bool), résultat_verification (conforme | non_conforme | null), nouvelle_échéance, observations. **Une ligne par instrument de l'intervention** : chaque instrument a ses propres résultats métrologiques sur le même bon.
- **ligne_bon** : bon, nature (catalogue | petit_materiel), code_article (si catalogue), désignation, quantité, prix_unitaire_ht. **Le prix est copié au moment de la signature** (un changement de catalogue ne modifie pas les anciens bons).
- **article** (catalogue) : entreprise, code, désignation, prix_unitaire_ht, actif.
- **photo** : intervention ou bon, fichier.
- **alerte** : type, agence, intervention ou bon concerné, créée_le, détail, traitée_par (nullable), traitée_le (nullable). Voir §6.10.

Les montants sont stockés en **centimes (entiers)**.

---

## 6. Règles métier

### 6.1 Statuts d'intervention

```
À faire ──prendre──▶ Prise ──commencer──▶ En cours ──bon signé──▶ Terminée ──▶ Facturée (définitif)
   ▲                   │                    │
   ├────libérer────────┘                    ├─ pause / reprise (reste « En cours »)
   └────abandonner (motif obligatoire)──────┘
À faire ──commencer maintenant──▶ En cours
```

- « Prise » = réservée par un technicien (le titulaire), visible par tous.
- Un collègue peut commencer une intervention prise par un autre (cas d'urgence) : **il en devient le titulaire**, c'est tracé au journal.
- **Abandonner** une intervention « En cours » : chrono arrêté, segments conservés, retour à « À faire », motif obligatoire au journal. Le prochain technicien reprend le même chrono cumulé. Chaque reprise après abandon compte comme un **nouveau passage** (utile pour les déplacements, §6.4).
- **Prise hors ligne par deux techniciens** : le premier synchronisé devient titulaire ; le second reçoit **un message dans l'appli à sa synchronisation** (« INT-… a déjà été prise par … »), une ligne est écrite au journal, et une alerte est créée (§6.10). S'ils ont tous deux lancé le chrono, les segments sont fusionnés (§6.2).
- « Facturée » est **définitif**, posé par le gestionnaire, le chef d'agence ou l'administrateur, et seulement sur un bon qui a déjà son **numéro définitif**. Pas d'annulation en V1.
- « En cours » s'affiche **En cours** si le chrono tourne, **En pause** sinon.
- Tri de la liste : En cours, puis À faire, puis Prise, puis Terminée, puis Facturée ; à statut égal, les urgentes d'abord, puis par date de réception.
- Une demande créée pour un client marqué **critique** est **urgente par défaut** (modifiable).

### 6.2 Chrono de main-d'œuvre

- **Un seul chrono par intervention**, même si plusieurs techniciens sont présents. Le nombre de personnes est saisi sur le bon (prérempli avec le nombre prévu).
- Démarrer = créer un segment (début = maintenant). Pause = fermer le segment. Reprise = nouveau segment.
- **Un technicien n'a qu'un chrono actif à la fois** : quand il démarre une autre intervention, seul le chrono **qu'il a lui-même démarré** est mis en pause (et c'est écrit au journal). Si un collègue a démarré le chrono de l'intervention commune, celui-ci continue.
- Le chrono doit survivre à la fermeture de l'appli, au redémarrage du téléphone et à l'absence de réseau (calcul à partir des horodatages, pas d'un compteur en mémoire).
- **Mettre en pause, reprendre, terminer et faire le bon** : le titulaire, ou le technicien qui a démarré le segment en cours. Les autres voient le chrono en lecture.
- « Terminer et faire le bon » ferme le segment en cours et ouvre le bon.
- **Correction du temps** avant signature : par le titulaire ou par le chef d'agence, minutes réelles + **motif obligatoire**. La correction (auteur, motif, avant/après) apparaît sur le bon et au journal.
- **Deux téléphones** : si des segments du même chrono se chevauchent à la synchronisation (démarré sur deux appareils), on **fusionne les périodes qui se recouvrent** (le temps n'est jamais compté deux fois) et on l'écrit au journal.

### 6.3 Calcul de la main-d'œuvre facturée

Le temps réel = **somme exacte de tous les segments** (en secondes, périodes qui se recouvrent fusionnées), puis on garde les **minutes entières une seule fois sur le total** (jamais par segment). Arrondi à la demi-heure, **la borne exacte va à la tranche du dessous**, minimum 30 min :

```
si minutes <= 45 : facturé = 30
sinon            : facturé = 30 × plafond((minutes − 15) / 30)

minutes_facturées_totales = facturé × nombre_personnes
montant_MO_HT = minutes_facturées_totales / 60 × taux_horaire
```

| Temps réel (par chrono) | Facturé par personne |
| --- | --- |
| 0 à 45 min | 30 min |
| 46 min à 1 h 15 | 1 h |
| 1 h 16 à 1 h 45 | 1 h 30 |
| 1 h 46 à 2 h 15 | 2 h |

Si le temps est corrigé, le calcul part des minutes corrigées. Taux horaire = réglage entreprise (exemple : 65 € HT/h).

### 6.4 Forfait de déplacement

Forfait selon la distance aller agence → site (`site.distance_km`), **borne exacte dans la zone du dessous** :

| Distance | Forfait HT (exemple, réglable) |
| --- | --- |
| jusqu'à 20 km inclus | 50 € |
| de 21 à 50 km inclus | 80 € |
| plus de 50 km | 120 € |

Les deux limites et les trois montants sont des réglages entreprise. Les distances sont en **kilomètres entiers**. Le technicien peut modifier la distance **sur le bon** (détour, autre point de départ) : cela ne modifie **pas** la fiche du site, mais c'est visible sur le bon.

**Le temps de trajet n'est pas facturé** : le forfait couvre le trajet, le chrono démarre sur place.

**Nombre de passages** : calculé automatiquement = nombre de **jours différents** où le chrono a démarré (une installation sur 2 jours = 2 passages), **plus** chaque reprise après abandon faite **le même jour** que l'abandon. Un abandon le lundi repris le mardi = 2 passages (le changement de jour compte déjà la reprise). Un segment compte pour le **jour où il a démarré** (un dépannage de nuit qui passe minuit = 1 jour). Les jours sont comptés à l'**heure de Paris**. Le technicien peut **corriger ce nombre avec un motif** (tracé au journal).

**Plusieurs passages** : le bon affiche le nombre de passages et le technicien choisit **le nombre de forfaits facturés, entre 1 et le nombre de passages** (selon ce qui était prévu et selon que le passage supplémentaire est dû ou non à l'entreprise). Par défaut : 1. Le choix est écrit au journal.

### 6.5 Pièces et petit matériel

- **Pièces catalogue** : choisies par code article, prix du catalogue non modifiable sur le bon, quantité modifiable. Ajouter un code déjà présent incrémente la quantité.
- **Petit matériel** : lignes libres (désignation obligatoire, quantité, prix unitaire HT libre). Raccourci « Forfait consommables » (15 € HT par défaut, réglable).
- Hors ligne, le bon garde **le prix affiché sur le téléphone au moment de la signature**, même si le catalogue a changé entre-temps.
- Les deux natures restent distinguées sur le bon et dans les exports.

### 6.6 Total du bon

```
total_HT = main-d'œuvre + (forfait déplacement × nombre de forfaits facturés) + Σ(pièces) + Σ(petit matériel)
```

Chaque montant de ligne est **arrondi au centime le plus proche** (0,5 centime arrondi au-dessus), puis on additionne les lignes. Pas de TVA dans la V1 (montants HT uniquement).

### 6.7 Bon d'intervention

Le bon contient **une section par instrument** de l'intervention (chaîne de mesure touchée, ou résultat et échéance pour une vérification, observations), et une seule partie commune (travaux, temps, déplacement, pièces, signature).

Champs obligatoires pour valider : travaux réalisés, nombre de personnes, nom du signataire, signature, résultat de **chaque** instrument (si Vérification), motif (si correction de temps), désignation (pour chaque ligne de petit matériel). L'email d'envoi est prérempli avec l'email du contact du site et reste modifiable.

À la validation : bon verrouillé, intervention → Terminée.

**Numérotation hors ligne :** sur le téléphone, le bon reçoit une **référence provisoire unique** contenant l'identifiant de l'appareil (ex. `PROV-<appareil>-<date-heure>`). Le **numéro définitif** `BI-AAAA-NNNN` est attribué par le serveur à la synchronisation :
- séquence par entreprise et par année, sans trou ;
- **l'année est celle de la signature** (un bon signé le 31/12 et synchronisé le 2/01 prend le prochain numéro de l'année de signature) ;
- les numéros suivent l'ordre de synchronisation, pas forcément celui de signature : c'est accepté, car le bon d'intervention n'est pas une facture (la facture est numérotée par le logiciel de facturation).

Le PDF est généré et envoyé par mail **après** attribution du numéro définitif. L'écran indique « Numéro attribué à l'envoi ».

**Bon rectificatif :** si une erreur est découverte après signature, le titulaire ou le chef d'agence crée un rectificatif depuis le bon : copie modifiable du bon, **motif obligatoire**, nouvelle signature du client, nouveau numéro. Le bon d'origine passe en « Annulé et remplacé par BI-… » (reste consultable, barré). Impossible si l'intervention est « Facturée ». Possible hors ligne, comme un bon normal, mais **seulement si le bon d'origine a déjà son numéro définitif** (sinon le bouton indique « Disponible après l'envoi du bon »). Si le serveur refuse un rectificatif à la synchronisation (intervention passée « Facturée » entre-temps), le rectificatif est **conservé avec le statut « Refusé »**, visible, **sans numéro définitif** (la séquence reste sans trou), et une alerte est créée pour le chef d'agence et le gestionnaire (§6.10).

Un rectificatif peut **ajouter** un instrument oublié, mais **jamais en retirer un** (ce serait effacer une vérification ou une réparation). Le PDF corrigé est envoyé automatiquement au client avec la mention « Annule et remplace le bon BI-… ».

Dans un rectificatif, **les champs métrologiques ne peuvent pas être assouplis** :
- « chaîne de mesure touchée » peut passer de non à oui (ce qui déclenche les règles du §6.8), **jamais de oui à non** ;
- le résultat d'une vérification et l'échéance ne sont **pas modifiables pour les instruments déjà présents sur le bon d'origine** ; une erreur de vérification se traite par une nouvelle intervention de vérification ;
- pour un instrument **ajouté** par le rectificatif, la saisie complète est **obligatoire** (chaîne de mesure touchée, ou résultat et échéance) et déclenche les règles du §6.8 ;
- les interventions déjà créées automatiquement ne sont jamais annulées par un rectificatif.

### 6.8 Métrologie légale

Statuts d'instrument : **Vignette verte** (avec échéance) · **À vérifier** (usage réglementé interdit) · **Vignette rouge** (refusé).

Affichage :
- verte et échéance > 45 jours → vert
- verte et échéance ≤ 45 jours → orange « Vérification dans N j »
- échéance dépassée → rouge « Vignette périmée »
- À vérifier ou rouge → rouge

Règles automatiques à la signature d'un bon, **appliquées instrument par instrument** (une intervention automatique regroupe tous les instruments concernés du même bon) :
- **Réparation ou installation avec « chaîne de mesure touchée » coché** (capteur, câble de mesure, réglage, scellé brisé) → instrument passe **À vérifier** (motif : vérification après réparation, ou vérification primitive pour une installation) + création automatique d'une intervention **Vérification** (urgente si client critique).
- **Vérification conforme** → vignette verte, nouvelle échéance **proposée à +1 an**, modifiable par le technicien **entre demain et +2 ans** (certains instruments ont une périodicité de 2 ans), avec un avertissement visible au-delà d'un an. La périodicité par type d'instrument viendra après la V1.
- **Vérification non conforme** → vignette rouge + création automatique d'une intervention **Réparation** « Remise en conformité ».

Ces créations automatiques sont faites **par le serveur à la synchronisation** (jamais par le téléphone), pour éviter les doublons. Hors ligne, le téléphone affiche « Vérification créée à l'envoi » et met déjà l'instrument en « À vérifier » localement.

Onglet Parc : liste des échéances ≤ 45 jours et des instruments en alerte, avec création d'une demande de vérification en un geste, pouvant **regrouper plusieurs instruments du même site** (pas de doublon si une vérification est déjà ouverte pour un instrument). Priorité de cette demande : **urgente** si la vignette est périmée, rouge ou « À vérifier », ou si le client est critique ; normale sinon.

### 6.9 Mode hors ligne (obligatoire)

**Architecture « local d'abord »** : dès le bloc 3 (chrono), toutes les écritures du terrain (chrono, bon, photos, prise d'intervention) passent par le stockage local du téléphone, puis sont envoyées au serveur par une file de synchronisation. Ne jamais construire une version qui exige le réseau pour ces actions.

Certains sites sont en zone blanche. Doivent fonctionner sans réseau : consulter les interventions déjà chargées, démarrer/mettre en pause le chrono, remplir et signer un bon, prendre des photos. Tout est stocké localement puis **synchronisé au retour du réseau**, avec un indicateur visible « Hors ligne · N en attente ». En cas de conflit, ne jamais écraser un bon signé (voir aussi §6.2 pour les chronos).

**Heure du téléphone** : hors ligne, les heures viennent de l'horloge du téléphone, qui peut être modifiée. Le serveur enregistre aussi **son heure de réception** pour chaque segment et chaque bon. À la synchronisation, il compare l'heure du téléphone à la sienne : un **écart de plus de 5 minutes** est écrit au journal et crée une alerte pour le chef d'agence (le bon n'est pas bloqué).

**Un segment n'est jamais refusé** (les téléphones avancent souvent d'une ou deux minutes, et du temps de travail serait perdu) :
- fin du segment jusqu'à 5 minutes après l'heure du serveur → acceptée telle quelle ;
- au-delà → la fin est **ramenée à l'heure du serveur**, c'est écrit au journal et une alerte est créée ;
- même règle pour le **début** d'un segment : s'il est plus de 5 minutes après l'heure du serveur, il est ramené à l'heure du serveur, avec journal et alerte.

Limite connue : si l'heure du téléphone est modifiée puis remise à l'heure avant la synchronisation, ce contrôle ne le voit pas. C'est accepté en V1, car tout le reste est tracé.

**Ajouter un instrument sur place** : le technicien peut ajouter à une intervention en cours un autre instrument **du même site** (y compris hors ligne, et y compris un instrument créé sur place s'il n'est pas encore dans le parc). C'est écrit au journal. Retirer un instrument d'une intervention n'est possible qu'**avant** la signature du bon, et c'est aussi écrit au journal.

**Créer un instrument sur place** :
- le technicien peut créer un instrument **depuis une intervention** uniquement ; il ne peut ni modifier ni supprimer les instruments du parc ;
- hors ligne, l'instrument reçoit une **référence provisoire** (comme les bons) ; le numéro définitif `INS-xxxx` est attribué par le serveur à la synchronisation ;
- si le **numéro de série existe déjà** dans l'entreprise, le serveur crée quand même l'instrument mais crée une alerte « instrument en double possible » pour que le chef d'agence vérifie (jamais de fusion automatique).

### 6.10 Alertes

En V1, les alertes s'affichent **dans l'appli** : un badge et une liste « À traiter » pour le chef d'agence (son agence) et le gestionnaire (toutes les agences). Chaque alerte a un type, une date, un lien vers l'intervention ou le bon, et un bouton « Traité » (qui note qui l'a traitée et quand). Pas d'email d'alerte en V1.

Types d'alertes V1 : écart d'horloge > 5 min, début ou fin de segment ramené à l'heure du serveur, rectificatif refusé, intervention prise en double hors ligne, instrument en double possible.

Le technicien ne reçoit pas d'alertes : il est prévenu par un **message dans l'appli** à sa synchronisation quand une de ses actions est concernée (prise en double, segment ajusté).

---

## 7. Écrans (V1)

Navigation en bas **selon le rôle** :

| Rôle | Onglets | Bouton « + Nouvelle demande » | Barre du chrono |
| --- | --- | --- | --- |
| Technicien | Interventions · Parc · Réglages | Oui | Oui |
| Chef d'agence | Interventions · Parc · À traiter (badge) · Réglages | Oui | Oui |
| Gestionnaire | Interventions · À traiter (badge) · Réglages | Non | Non |
| Administrateur | Interventions · Parc · À traiter (badge) · Réglages | Oui | Oui |

La barre du chrono actif s'affiche au-dessus de la navigation (temps, montant, Pause/Reprendre). Le badge « À traiter » indique le nombre d'alertes non traitées.

1. **Interventions** : compteurs (Urgentes, À faire, En cours, À facturer), filtres (Toutes, Les miennes, À faire, Prises, En cours, Terminées, Facturées), cartes.
2. **Fiche intervention** : description, actions selon le statut, chrono, client (contact, distance, forfait), **liste des instruments** avec la vignette de chacun et un bouton « Ajouter un instrument du site », journal.
3. **Bon** : main-d'œuvre (nombre de personnes) et déplacement (passages, forfaits), correction de temps, travaux, pièces et petit matériel, **une section par instrument** (chaîne de mesure touchée, ou résultat et échéance, observations), photos, email d'envoi, signataire, signature au doigt, total HT en direct.
4. **Bon signé** : vue « papier », tampon « Signé et verrouillé », bouton « Créer un rectificatif » (selon rôle).
5. **Parc** : échéances et alertes, recherche (n° d'instrument, client, n° de série), fiche instrument avec historique.
6. **Nouvelle demande** : client, site, **un ou plusieurs instruments** du site (cases à cocher), type, priorité, description, durée estimée, nombre de personnes.
7. **À traiter** (chef d'agence, gestionnaire, administrateur) : liste des alertes du §6.10 ; pour le gestionnaire, aussi la liste des bons terminés à facturer et l'export CSV.

   **Export CSV** : période choisie sur la **date de signature** ; contient les bons valides, y compris les rectificatifs qui remplacent un bon ; **jamais** les bons « Annulé et remplacé » ni les rectificatifs « Refusé » ; une colonne indique si le bon est déjà « Facturé ».
8. **Réglages** : utilisateur, taux horaire, règle d'arrondi (affichée), forfaits de déplacement, forfait consommables, catalogue (saisie + import CSV).

**Règles d'interface :** mobile d'abord (Android), cibles tactiles ≥ 44 px, champs en 16 px minimum, un bon doit se remplir en **moins de 2 à 3 minutes**, textes en français clair, thèmes clair et sombre, état « vide » explicite sur chaque liste.

---

## 8. Technique

| Brique | Choix |
| --- | --- |
| Front | Next.js (App Router) + TypeScript, en PWA installable |
| Données, comptes, fichiers | Supabase (Postgres, Auth, Storage), région Europe |
| Hébergement | Vercel |
| Envoi des emails | Resend (ou équivalent, à valider avec moi) |
| Hors ligne | Service worker + IndexedDB, file d'attente de synchronisation |
| PDF | Génération côté serveur |
| Tests | Vitest pour la logique, Playwright pour un parcours complet |
| Code | Dépôt GitHub privé |

- **Cloisonnement**, garanti par la base elle-même (Row Level Security Supabase sur toutes les tables), jamais seulement par l'interface :
  - tout le monde est limité à son `entreprise_id` ;
  - le technicien et le chef d'agence ne voient **que leur agence** ;
  - le gestionnaire et l'administrateur voient **toutes les agences** de l'entreprise ; l'agence du compte d'un gestionnaire peut rester vide.
- Jamais de clé de service côté client.
- **Connexion** : email + mot de passe. Pas d'inscription : les comptes sont créés par l'administrateur. La session reste ouverte sur le téléphone (un technicien en zone blanche ne doit jamais être déconnecté ni devoir se reconnecter pour travailler).
- **Deux projets Supabase** : `tare-dev` (données fictives, utilisé dès la phase 1) et, plus tard, `tare-prod` (données réelles), créé seulement le moment venu. Région Paris si proposée, sinon Francfort.
- **Dépendances validées pour la phase 1** : `next`, `react`, `typescript`, `@supabase/supabase-js`, `@supabase/ssr`, `vitest`, et la commande Supabase (via `npx`, sans installation globale). Toute autre dépendance : me demander.
- **Migrations SQL** versionnées pour tout changement de base ; jamais de modification manuelle en production.
- Sauvegardes automatiques de la base activées.
- Les calculs métier (§6.3 à §6.6, statut métrologique §6.8) vivent dans **un seul module** de fonctions pures (`lib/regles/`), utilisé par l'interface, le PDF et le serveur. Interdit de les réécrire ailleurs.
- **Création des entreprises en V1** : par un script d'administration (pas d'inscription en ligne). Une entreprise de démonstration est créée avec les données fictives du §11.

**Plan de la phase 1** (séances d'environ 1 h) : 1. projet Next.js + git · 2. dépôt GitHub privé + Vercel, appli ouverte sur le téléphone · 3-4. `lib/regles/` et ses tests · 5. Supabase, connexion, tables entreprise / agence / utilisateur · 6. toutes les tables du §5 · 7. cloisonnement (RLS) et ses tests · 8. script d'administration + données fictives · 9. liste des interventions lue depuis la base, sur le téléphone.

---

## 9. Règles de qualité du code

- **Avant d'écrire une fonction ou un composant, cherche s'il en existe déjà un.** Réutilise ou étends plutôt que dupliquer.
- Une fonctionnalité à la fois ; l'appli doit fonctionner à la fin de chaque étape. Un commit par étape, message clair en français.
- Si une correction s'empile sur une autre correction, arrête-toi et propose de reprendre proprement.
- **Tests obligatoires** sur le module de règles métier, avec au minimum ces cas :
  - main-d'œuvre par personne (minutes → facturé) : 0 → 30 · 20 → 30 · 45 → 30 · 46 → 60 · 75 → 60 · 76 → 90 · 105 → 90 · 106 → 120 · 135 → 120 · 136 → 150 · 45 min 59 s → 30
  - plusieurs personnes : 50 min × 2 personnes → 2 h facturées
  - déplacement : 0 → 50 € · 20 → 50 € · 21 → 80 € · 50 → 80 € · 51 → 120 €
  - total : 50 min corrigées (→ 1 h) à 65 € + 18 km + 3 × 4,50 € + 8,50 € = 65,00 + 50,00 + 13,50 + 8,50 = **137,00 € HT**
  - arrondi au centime : 1 h 30 à 65,33 €/h = 97,995 → **98,00 €**
  - chevauchement : segments 10:00–11:00 et 10:30–11:15 → 75 min
  - secondes sur le total : 10 segments de 4 min 40 s = 46 min 40 s → 46 min → 1 h facturée (et non 10 × 4 min = 40 min)
  - passages : 2 passages, 2 forfaits choisis, site à 18 km → 100 € ; 1 forfait choisi → 50 €
  - échéance : refusée si antérieure ou égale à aujourd'hui, ou au-delà de +2 ans
  - rectificatif : décocher « chaîne de mesure touchée » est refusé ; la cocher crée la vérification
  - plusieurs instruments : vérification de INS-0802 (conforme) et INS-0803 (non conforme) sur un bon → 1 seul forfait de déplacement, INS-0802 en vignette verte, INS-0803 en rouge, 1 intervention « Remise en conformité » créée pour INS-0803 seul
  - passages : chrono le lundi et le mardi → 2 passages calculés
  - segment en avance : fin à serveur + 3 min → acceptée ; fin à serveur + 12 min → ramenée à l'heure du serveur + alerte
  - passages : abandon lundi, reprise mardi → 2 ; abandon et reprise le même lundi → 2 ; segment lundi 23:30–mardi 01:00 seul → 1
  - rectificatif : retirer un instrument est refusé ; en ajouter un est accepté (saisie métrologique obligatoire) ; un rectificatif refusé n'a pas de numéro
  - cloisonnement : un technicien de l'agence A ne lit aucune donnée de l'agence B (test au niveau de la base, pas de l'écran) ; le gestionnaire lit les deux
  - instrument créé sur place avec un n° de série existant → créé + alerte « double possible »
  - export CSV : un bon annulé et remplacé n'apparaît pas, son rectificatif apparaît
  - horloge : au moment de la synchronisation, le téléphone annonce 10:00 alors que le serveur est à 10:20 → écart de 20 min signalé au journal (un bon signé hors ligne la veille et envoyé aujourd'hui n'est PAS un écart : on compare l'heure du téléphone au moment de l'envoi, pas l'heure de signature)
  - métrologie : réparation avec chaîne de mesure touchée → instrument « À vérifier » + vérification créée
- Pas de nouvelle dépendance sans m'expliquer pourquoi.
- **Point de ménage** tous les 2 ou 3 blocs de la phase 2 : relire le projet, signaler le code dupliqué ou mort, proposer une simplification.

---

## 10. Ordre de construction

**Phase 1 — Socle** : projet Next.js, Supabase, connexion, tables + RLS, déploiement Vercel, une liste d'interventions lue depuis la base, module `lib/regles/` et ses tests.

**Phase 2 — V1**, dans cet ordre :
1. Clients, sites (avec distance et email), instruments + import CSV
2. Demandes d'intervention, liste, filtres, statuts
3. Stockage local + file de synchronisation, prise d'intervention et chrono (local d'abord, §6.9)
4. Catalogue et petit matériel
5. Bon : photos, signature, verrouillage, total HT (local d'abord)
6. Numérotation définitive, PDF et envoi par mail
7. Règles métrologiques et onglet Parc (créations automatiques côté serveur)
8. Finitions du hors ligne : reprise après coupure, conflits, indicateur « Hors ligne · N en attente », test en zone blanche
9. Bon rectificatif
10. Écran « À traiter » (alertes, bons à facturer, export CSV)
11. Réglages

**Critère de fin de V1** : une intervention fictive complète, de la demande au PDF reçu par mail, réalisée sans réseau sur le terrain puis synchronisée.

**Après la V1 (ne pas anticiper dans le code)** : import complet du fichier de références, devis PDF, demande d'approvisionnement automatique après devis signé, rappels d'échéance aux clients, périodicité de vérification par type d'instrument, tableau de bord, connexion directe au logiciel de facturation (au-delà du CSV simple de la V1), alertes par email, portail client, inscription en libre-service, abonnements (Stripe).

---

## 11. Données fictives de démonstration

Utiliser les mêmes jeux que le prototype : 4 utilisateurs (Karim B. technicien habilité, Lucas M. technicien non habilité, Sophie R. cheffe d'agence habilitée, Nadia G. gestionnaire au siège), 6 clients (Carrière Ferrand, Fromagerie des Causses, Boulangerie Arnal, Coopérative Saint-Clair, Primeurs Dubois, Pharmacie du Marché) avec leurs distances (18, 32, 4, 24, 3, 3 km), 8 instruments `INS-0421` à `INS-0910` (l'intervention de vérification chez Primeurs Dubois porte sur **les deux** balances INS-0802 et INS-0803), catalogue de 3 articles :

| Code | Désignation | Prix HT |
| --- | --- | --- |
| 1 | Câble de capteur blindé 4 fils (le mètre) | 4,50 € |
| 2 | Capteur de pesage 2 t inox | 185,00 € |
| 3 | Bloc alimentation indicateur 12 V | 62,00 € |

Marques fictives : Tarvex, Balix. Téléphones au format `06 00 00 00 0X`. Emails en `@exemple.fr` uniquement (domaine réservé, aucun envoi réel vers de vraies personnes).

---

## 12. Questions ouvertes (ne pas trancher seul)

- Champs obligatoires de la fiche instrument (millésime et autres).
- Documents métrologiques à produire et durée de conservation.
- Format du fichier de références fourni par les clients.
- Périodicité réglementaire par type d'instrument (après la V1).
- Nom définitif du produit (« Tare » est un nom de travail).

## 13. Glossaire

- **Vérification périodique** : contrôle réglementaire obligatoire d'un instrument en service, à intervalle fixe.
- **Vérification primitive** : vérification avant la première mise en service (ou après certaines interventions).
- **Vignette verte / rouge** : marque apposée après vérification ; verte = conforme jusqu'à l'échéance, rouge = refusé, usage interdit.
- **Chaîne de mesure** : capteurs, câbles de mesure, indicateur et réglages qui déterminent le résultat de pesée.
- **Portée (Max)** : charge maximale de l'instrument. **Échelon (e)** : plus petit écart de lecture réglementaire.
- **Bon d'intervention (BI)** : document signé par le client qui décrit et chiffre l'intervention.
- **Bon rectificatif** : nouveau bon qui annule et remplace un bon signé contenant une erreur.
