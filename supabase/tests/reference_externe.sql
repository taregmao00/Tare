-- Essais de la référence externe des interventions (décision du 17/11/2026).
-- Sur un Postgres local, après simulation-supabase.sql et toutes les migrations
-- (voir lancer.sh). Chaque ligne doit afficher « OK » ; un « KO » arrête tout.
-- Le jeu d'essai (deux entreprises, agences A, B et Z) est décrit dans jeu_essai.sql :
-- l'intervention de chaque agence y porte déjà une référence (« OS-aaaaaaaa », etc.).
\set ON_ERROR_STOP on

\ir jeu_essai.sql

create function pg_temp.doit_toucher(nom text, attendu bigint, requete text) returns void language plpgsql as $$
declare n bigint;
begin
  execute requete;
  get diagnostics n = row_count;
  if n <> attendu then raise exception 'KO : % → % ligne(s) touchée(s), attendu %', nom, n, attendu; end if;
  raise notice 'OK (% ligne touchée) : %', n, nom;
end $$;

create function pg_temp.doit_echouer(nom text, requete text) returns void language plpgsql as $$
begin
  begin execute requete; exception when others then raise notice 'OK (refusé) : % → %', nom, sqlerrm; return; end;
  raise exception 'KO : % aurait dû être refusé', nom;
end $$;

-- Vérifiée avec tous les droits, pour voir le vrai contenu de la base.
create function pg_temp.doit_valoir(nom text, condition text) returns void language plpgsql security definer as $$
declare vrai boolean;
begin
  execute 'select ' || condition into vrai;
  if vrai is not true then raise exception 'KO : %', nom; end if;
  raise notice 'OK (vérifié) : %', nom;
end $$;

-- Dernière ligne du journal d'une intervention.
create function pg_temp.dernier_journal(intervention uuid) returns text language sql security definer as $$
  select texte from public.journal where intervention_id = intervention order by horodatage desc, id desc limit 1
$$;

-- ---------------------------------------------------------------------------
\echo '--- Normalisation (mêmes exemples que lib/regles/reference.test.ts)'
-- ---------------------------------------------------------------------------
select pg_temp.doit_valoir('« ␣ os  2026-0412 ␣ » → « OS 2026-0412 »', $q$public.normaliser_reference('  os  2026-0412 ') = 'OS 2026-0412'$q$);
select pg_temp.doit_valoir('« Msg-éà 12 » → « MSG-ÉÀ 12 » (accents mis en majuscules)', $q$public.normaliser_reference('Msg-éà 12') = 'MSG-ÉÀ 12'$q$);
select pg_temp.doit_valoir('tabulations et retours à la ligne comptent comme des espaces', $q$public.normaliser_reference(e'os\t\n12') = 'OS 12'$q$);
select pg_temp.doit_valoir('tirets et points gardés : « OS-12 » ≠ « OS12 »', $q$public.normaliser_reference('OS-12') <> public.normaliser_reference('OS12')$q$);

-- ---------------------------------------------------------------------------
\echo '--- Technicien A : saisit la référence des interventions de son agence'
-- ---------------------------------------------------------------------------
select pg_temp.devenir((select id from comptes where qui = 'technicien A'));
select pg_temp.doit_toucher('modifier la référence d''une intervention de son agence', 1,
  $q$update public.intervention_reference set reference = 'msg 12' where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_valoir('forme de comparaison calculée par la base : « MSG 12 »',
  $q$(select reference_normalisee from public.intervention_reference where intervention_id = pg_temp.id('aaaaaaaa', 4)) = 'MSG 12'$q$);
select pg_temp.doit_valoir('modification écrite au journal, avec l''ancienne et la nouvelle valeur',
  $q$pg_temp.dernier_journal(pg_temp.id('aaaaaaaa', 4)) = 'Référence externe modifiée : « OS-aaaaaaaa » → « msg 12 »'$q$);
select pg_temp.doit_valoir('auteur de la modification : le technicien connecté',
  $q$(select modifiee_par_id from public.intervention_reference where intervention_id = pg_temp.id('aaaaaaaa', 4)) = 'aaaaaaaa-0000-0000-0000-000000000101'
     and (select auteur_id from public.journal where intervention_id = pg_temp.id('aaaaaaaa', 4) order by horodatage desc, id desc limit 1) = 'aaaaaaaa-0000-0000-0000-000000000101'$q$);
select pg_temp.doit_echouer('espaces en trop non nettoyés : refusés (l''appli nettoie avant d''envoyer)',
  $q$update public.intervention_reference set reference = '  msg   12 ' where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_echouer('référence vide',
  $q$update public.intervention_reference set reference = '' where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_echouer('référence de plus de 60 caractères',
  $q$update public.intervention_reference set reference = repeat('x', 61) where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_echouer('V1 : une deuxième référence sur la même intervention',
  $q$insert into public.intervention_reference (entreprise_id, intervention_id, reference) values ('e1000000-0000-0000-0000-000000000001', pg_temp.id('aaaaaaaa', 4), 'Autre')$q$);
select pg_temp.doit_echouer('écrire soi-même la forme de comparaison (colonne fermée)',
  $q$update public.intervention_reference set reference_normalisee = 'X' where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_echouer('déplacer la référence vers une autre intervention (colonne fermée)',
  $q$update public.intervention_reference set intervention_id = pg_temp.id('bbbbbbbb', 4) where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_toucher('retirer la référence', 1,
  $q$delete from public.intervention_reference where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_valoir('retrait écrit au journal',
  $q$pg_temp.dernier_journal(pg_temp.id('aaaaaaaa', 4)) = 'Référence externe retirée (était « msg 12 »)'$q$);
select pg_temp.doit_toucher('remettre une référence', 1,
  $q$insert into public.intervention_reference (entreprise_id, intervention_id, reference) values ('e1000000-0000-0000-0000-000000000001', pg_temp.id('aaaaaaaa', 4), 'OS-12')$q$);
select pg_temp.doit_valoir('ajout écrit au journal, auteur posé par la base',
  $q$pg_temp.dernier_journal(pg_temp.id('aaaaaaaa', 4)) = 'Référence externe ajoutée : « OS-12 »'
     and (select ajoutee_par_id from public.intervention_reference where intervention_id = pg_temp.id('aaaaaaaa', 4)) = 'aaaaaaaa-0000-0000-0000-000000000101'$q$);

\echo '--- Technicien A : rien hors de son agence'
select pg_temp.doit_toucher('modifier la référence d''une intervention de l''agence B : aucune ligne touchée', 0,
  $q$update public.intervention_reference set reference = 'Piraté' where intervention_id = pg_temp.id('bbbbbbbb', 4)$q$);
select pg_temp.doit_toucher('retirer la référence d''une intervention de l''agence B : aucune ligne touchée', 0,
  $q$delete from public.intervention_reference where intervention_id = pg_temp.id('bbbbbbbb', 4)$q$);
select pg_temp.doit_echouer('ajouter une référence sur une intervention d''une autre entreprise',
  $q$insert into public.intervention_reference (entreprise_id, intervention_id, reference) values ('cccccccc-0000-0000-0000-0000000000e2', pg_temp.id('cccccccc', 4), 'Intrus')$q$);

-- ---------------------------------------------------------------------------
\echo '--- Plusieurs interventions partagent une référence (pas d''unicité)'
-- ---------------------------------------------------------------------------
reset role;
insert into public.intervention (id, entreprise_id, agence_id, numero, type, client_id, site_id)
  values ('aaaaaaaa-0000-0000-0000-000000000204', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0',
          'INT-0201', 'verification', pg_temp.id('aaaaaaaa', 1), pg_temp.id('aaaaaaaa', 2));
select pg_temp.devenir((select id from comptes where qui = 'chef d''agence A'));
select pg_temp.doit_toucher('chef d''agence : même référence, autre casse, sur une 2e intervention', 1,
  $q$insert into public.intervention_reference (entreprise_id, intervention_id, reference) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000204', 'os-12')$q$);
select pg_temp.doit_valoir('les deux interventions sont retrouvées par la même forme de comparaison',
  $q$(select count(*) from public.intervention_reference where reference_normalisee = 'OS-12') = 2$q$);

-- ---------------------------------------------------------------------------
\echo '--- Gestionnaire : lit, ne modifie pas'
-- ---------------------------------------------------------------------------
select pg_temp.devenir((select id from comptes where qui = 'gestionnaire'));
select pg_temp.doit_valoir('gestionnaire : lit les références des deux agences',
  $q$(select count(*) from public.intervention_reference) = 4$q$);
select pg_temp.doit_toucher('gestionnaire : modifier une référence : aucune ligne touchée', 0,
  $q$update public.intervention_reference set reference = 'Piraté'$q$);
select pg_temp.doit_toucher('gestionnaire : retirer une référence : aucune ligne touchée', 0,
  $q$delete from public.intervention_reference$q$);
select pg_temp.doit_echouer('gestionnaire : ajouter une référence',
  $q$insert into public.intervention_reference (entreprise_id, intervention_id, reference) values ('e1000000-0000-0000-0000-000000000001', pg_temp.id('bbbbbbbb', 4), 'Intrus')$q$);

-- ---------------------------------------------------------------------------
\echo '--- Administrateur : toutes les agences ; référence figée une fois « Facturée »'
-- ---------------------------------------------------------------------------
select pg_temp.devenir((select id from comptes where qui = 'administrateur'));
select pg_temp.doit_toucher('administrateur : modifier la référence d''une intervention de l''agence B', 1,
  $q$update public.intervention_reference set reference = 'OS-B-1' where intervention_id = pg_temp.id('bbbbbbbb', 4)$q$);
reset role;
update public.intervention set statut = 'facturee', facturee_le = now(), facturee_par_id = 'e1000000-0000-0000-0000-000000000201'
  where id = pg_temp.id('bbbbbbbb', 4);
select pg_temp.devenir((select id from comptes where qui = 'administrateur'));
select pg_temp.doit_echouer('modifier la référence d''une intervention « Facturée »',
  $q$update public.intervention_reference set reference = 'OS-B-2' where intervention_id = pg_temp.id('bbbbbbbb', 4)$q$);
select pg_temp.doit_echouer('retirer la référence d''une intervention « Facturée »',
  $q$delete from public.intervention_reference where intervention_id = pg_temp.id('bbbbbbbb', 4)$q$);
reset role;
select pg_temp.doit_echouer('même avec tous les droits (clé secrète), une intervention « Facturée » garde sa référence',
  $q$update public.intervention_reference set reference = 'OS-B-2' where intervention_id = pg_temp.id('bbbbbbbb', 4)$q$);

-- ---------------------------------------------------------------------------
\echo '--- Libellé du champ : un réglage de l''entreprise, changé par l''administrateur seul'
-- ---------------------------------------------------------------------------
select pg_temp.doit_valoir('libellé par défaut : « Référence externe »',
  $q$(select libelle_reference_externe from public.entreprise where id = 'e1000000-0000-0000-0000-000000000001') = 'Référence externe'$q$);
select pg_temp.devenir((select id from comptes where qui = 'chef d''agence A'));
select pg_temp.doit_toucher('chef d''agence : changer le libellé : aucune ligne touchée', 0,
  $q$update public.entreprise set libelle_reference_externe = 'N° d''OS'$q$);
select pg_temp.devenir((select id from comptes where qui = 'administrateur'));
select pg_temp.doit_toucher('administrateur : changer le libellé de son entreprise', 1,
  $q$update public.entreprise set libelle_reference_externe = 'N° de message'$q$);
select pg_temp.doit_echouer('administrateur : libellé vide', $q$update public.entreprise set libelle_reference_externe = ''$q$);
select pg_temp.doit_echouer('administrateur : libellé de plus de 40 caractères', $q$update public.entreprise set libelle_reference_externe = repeat('x', 41)$q$);
select pg_temp.doit_echouer('administrateur : changer un autre réglage (taux horaire)', $q$update public.entreprise set taux_horaire_centimes = 1$q$);
select pg_temp.doit_valoir('l''autre entreprise garde son libellé',
  $q$(select libelle_reference_externe from public.entreprise where id = 'cccccccc-0000-0000-0000-0000000000e2') = 'Référence externe'$q$);
select pg_temp.devenir((select id from comptes where qui = 'gestionnaire autre entreprise'));
select pg_temp.doit_toucher('gestionnaire d''une autre entreprise : changer le libellé : aucune ligne touchée', 0,
  $q$update public.entreprise set libelle_reference_externe = 'Piraté'$q$);
select pg_temp.devenir((select id from comptes where qui = 'technicien A'));
select pg_temp.doit_toucher('le journal reprend le nouveau libellé', 1,
  $q$update public.intervention_reference set reference = 'OS-13' where intervention_id = pg_temp.id('aaaaaaaa', 4)$q$);
select pg_temp.doit_valoir('« N° de message modifiée : … »',
  $q$pg_temp.dernier_journal(pg_temp.id('aaaaaaaa', 4)) = 'N° de message modifiée : « OS-12 » → « OS-13 »'$q$);

select pg_temp.devenir(null);
select pg_temp.doit_echouer('visiteur non connecté : lire les références', $q$select count(*) from public.intervention_reference$q$);
reset role;
\echo FIN DES ESSAIS
