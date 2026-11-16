-- Essais des écritures sur les clients, sites et instruments (phase 2, bloc 1, séance 1).
-- Sur un Postgres local, après simulation-supabase.sql et toutes les migrations
-- (voir lancer.sh). Chaque ligne doit afficher « OK » ; un « KO » arrête tout.
-- Le jeu d'essai (deux entreprises, agences A, B et Z) est décrit dans jeu_essai.sql.
\set ON_ERROR_STOP on

\ir jeu_essai.sql

-- La requête doit réussir et toucher exactement `attendu` ligne(s).
create function pg_temp.doit_toucher(nom text, attendu bigint, requete text) returns void language plpgsql as $$
declare n bigint;
begin
  execute requete;
  get diagnostics n = row_count;
  if n <> attendu then raise exception 'KO : % → % ligne(s) touchée(s), attendu %', nom, n, attendu; end if;
  raise notice 'OK (% ligne touchée) : %', n, nom;
end $$;

-- La requête doit être refusée par la base.
create function pg_temp.doit_echouer(nom text, requete text) returns void language plpgsql as $$
begin
  begin execute requete; exception when others then raise notice 'OK (refusé) : % → %', nom, sqlerrm; return; end;
  raise exception 'KO : % aurait dû être refusé', nom;
end $$;

-- La condition doit être vraie (vérifiée avec tous les droits, pour voir le vrai contenu de la base).
create function pg_temp.doit_valoir(nom text, condition text) returns void language plpgsql security definer as $$
declare vrai boolean;
begin
  execute 'select ' || condition into vrai;
  if vrai is not true then raise exception 'KO : %', nom; end if;
  raise notice 'OK (vérifié) : %', nom;
end $$;


-- ---------------------------------------------------------------------------
\echo '--- Chef d''agence A : écrit dans son agence'
-- ---------------------------------------------------------------------------
select pg_temp.devenir((select id from comptes where qui = 'chef d''agence A'));

select pg_temp.doit_toucher('créer un client dans son agence', 1,
  $q$insert into public.client (id, entreprise_id, agence_id, nom, critique) values ('aaaaaaaa-0000-0000-0000-000000000901', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'Nouveau client A', true)$q$);
select pg_temp.doit_toucher('modifier un client de son agence', 1,
  $q$update public.client set nom = 'Client A renommé', note = 'Une seule balance' where id = pg_temp.id('aaaaaaaa', 1)$q$);
select pg_temp.doit_toucher('créer un site chez un client de son agence', 1,
  $q$insert into public.site (id, entreprise_id, client_id, nom, distance_km, contact_email) values ('aaaaaaaa-0000-0000-0000-000000000902', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000901', 'Magasin', 12, 'contact@exemple.fr')$q$);
select pg_temp.doit_toucher('modifier la distance d''un site de son agence', 1,
  $q$update public.site set distance_km = 21 where id = pg_temp.id('aaaaaaaa', 2)$q$);
select pg_temp.doit_toucher('créer un instrument sur un site de son agence, sans numéro', 1,
  $q$insert into public.instrument (id, entreprise_id, site_id, type, marque, modele, numero_serie, portee_max, echelon, statut_metrologie, echeance_verification)
     values ('aaaaaaaa-0000-0000-0000-000000000903', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000902', 'Balance poids-prix', 'Balix', 'C15', 'BX-100', '15 kg', '5 g', 'verte', '2027-05')$q$);
-- L'entreprise a déjà INS-0001 (agence A) et INS-0002 (agence B, invisible pour ce chef d'agence).
select pg_temp.doit_valoir('numéro attribué par le serveur : INS-0003, en comptant l''agence B qu''il ne voit pas',
  $q$(select numero from public.instrument where id = 'aaaaaaaa-0000-0000-0000-000000000903') = 'INS-0003'$q$);
select pg_temp.doit_valoir('l''auteur enregistré est le chef d''agence connecté',
  $q$(select cree_par_id from public.instrument where id = 'aaaaaaaa-0000-0000-0000-000000000903') = 'aaaaaaaa-0000-0000-0000-000000000102'$q$);
select pg_temp.doit_toucher('modifier la fiche d''un instrument de son agence', 1,
  $q$update public.instrument set emplacement = 'Comptoir', millesime = 2021 where id = 'aaaaaaaa-0000-0000-0000-000000000903'$q$);

-- ---------------------------------------------------------------------------
\echo '--- Chef d''agence A : rien hors de son agence'
-- ---------------------------------------------------------------------------
select pg_temp.doit_echouer('créer un client dans l''agence B',
  $q$insert into public.client (entreprise_id, agence_id, nom) values ('e1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b0', 'Intrus')$q$);
select pg_temp.doit_echouer('créer un client dans une autre entreprise',
  $q$insert into public.client (entreprise_id, agence_id, nom) values ('cccccccc-0000-0000-0000-0000000000e2', 'cccccccc-0000-0000-0000-0000000000c0', 'Intrus')$q$);
select pg_temp.doit_toucher('modifier un client de l''agence B : aucune ligne touchée', 0,
  $q$update public.client set nom = 'Piraté' where id = pg_temp.id('bbbbbbbb', 1)$q$);
select pg_temp.doit_echouer('créer un site chez un client de l''agence B',
  $q$insert into public.site (entreprise_id, client_id, nom, distance_km) values ('e1000000-0000-0000-0000-000000000001', pg_temp.id('bbbbbbbb', 1), 'Intrus', 1)$q$);
select pg_temp.doit_toucher('modifier un site de l''agence B : aucune ligne touchée', 0,
  $q$update public.site set distance_km = 1 where id = pg_temp.id('bbbbbbbb', 2)$q$);
select pg_temp.doit_echouer('créer un instrument sur un site de l''agence B',
  $q$insert into public.instrument (entreprise_id, site_id, type, marque, modele, numero_serie, portee_max, echelon) values ('e1000000-0000-0000-0000-000000000001', pg_temp.id('bbbbbbbb', 2), 'Balance', 'Balix', 'C15', 'BX-1', '15 kg', '5 g')$q$);
select pg_temp.doit_toucher('modifier un instrument de l''agence B : aucune ligne touchée', 0,
  $q$update public.instrument set marque = 'Piraté' where id = pg_temp.id('bbbbbbbb', 3)$q$);
select pg_temp.doit_toucher('modifier un instrument d''une autre entreprise : aucune ligne touchée', 0,
  $q$update public.instrument set marque = 'Piraté' where id = pg_temp.id('cccccccc', 3)$q$);

-- ---------------------------------------------------------------------------
\echo '--- Ce qui reste fermé, même dans son agence'
-- ---------------------------------------------------------------------------
select pg_temp.doit_echouer('supprimer un client', $q$delete from public.client where id = 'aaaaaaaa-0000-0000-0000-000000000901'$q$);
select pg_temp.doit_echouer('supprimer un site', $q$delete from public.site where id = 'aaaaaaaa-0000-0000-0000-000000000902'$q$);
select pg_temp.doit_echouer('supprimer un instrument', $q$delete from public.instrument where id = 'aaaaaaaa-0000-0000-0000-000000000903'$q$);
select pg_temp.doit_echouer('remettre en service à la main un instrument (statut métrologique)',
  $q$update public.instrument set statut_metrologie = 'verte', echeance_verification = '2028-01' where id = pg_temp.id('aaaaaaaa', 3)$q$);
select pg_temp.doit_echouer('repousser une échéance à la main',
  $q$update public.instrument set echeance_verification = '2028-05' where id = 'aaaaaaaa-0000-0000-0000-000000000903'$q$);
select pg_temp.doit_echouer('changer le numéro d''un instrument',
  $q$update public.instrument set numero = 'INS-9999' where id = 'aaaaaaaa-0000-0000-0000-000000000903'$q$);
select pg_temp.doit_echouer('choisir soi-même le numéro à la création',
  $q$insert into public.instrument (entreprise_id, site_id, numero, type, marque, modele, numero_serie, portee_max, echelon) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000902', 'INS-7777', 'Balance', 'Balix', 'C15', 'BX-2', '15 kg', '5 g')$q$);
select pg_temp.doit_echouer('déplacer un client vers une autre agence',
  $q$update public.client set agence_id = 'bbbbbbbb-0000-0000-0000-0000000000b0' where id = 'aaaaaaaa-0000-0000-0000-000000000901'$q$);
select pg_temp.doit_echouer('déplacer un instrument vers un autre site',
  $q$update public.instrument set site_id = pg_temp.id('aaaaaaaa', 2) where id = 'aaaaaaaa-0000-0000-0000-000000000903'$q$);
select pg_temp.doit_echouer('instrument sans n° de série',
  $q$insert into public.instrument (entreprise_id, site_id, type, marque, modele, portee_max, echelon) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000902', 'Balance', 'Balix', 'C15', '15 kg', '5 g')$q$);
select pg_temp.doit_echouer('instrument sans échelon',
  $q$insert into public.instrument (entreprise_id, site_id, type, marque, modele, numero_serie, portee_max) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000902', 'Balance', 'Balix', 'C15', 'BX-3', '15 kg')$q$);
select pg_temp.doit_echouer('vider la marque d''un instrument',
  $q$update public.instrument set marque = ' ' where id = 'aaaaaaaa-0000-0000-0000-000000000903'$q$);
select pg_temp.doit_echouer('vignette verte sans échéance à la création',
  $q$insert into public.instrument (entreprise_id, site_id, type, marque, modele, numero_serie, portee_max, echelon, statut_metrologie) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000902', 'Balance', 'Balix', 'C15', 'BX-4', '15 kg', '5 g', 'verte')$q$);
select pg_temp.doit_echouer('se faire passer pour un autre auteur n''est pas possible (colonne fermée)',
  $q$insert into public.instrument (entreprise_id, site_id, cree_par_id, type, marque, modele, numero_serie, portee_max, echelon) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000902', 'aaaaaaaa-0000-0000-0000-000000000101', 'Balance', 'Balix', 'C15', 'BX-5', '15 kg', '5 g')$q$);

-- ---------------------------------------------------------------------------
\echo '--- Technicien et gestionnaire : aucune écriture sur le parc'
-- ---------------------------------------------------------------------------
select pg_temp.devenir((select id from comptes where qui = 'technicien A'));
select pg_temp.doit_echouer('technicien : créer un client dans son agence',
  $q$insert into public.client (entreprise_id, agence_id, nom) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'Intrus')$q$);
select pg_temp.doit_toucher('technicien : modifier un client de son agence : aucune ligne touchée', 0,
  $q$update public.client set nom = 'Piraté' where id = pg_temp.id('aaaaaaaa', 1)$q$);
select pg_temp.doit_echouer('technicien : créer un instrument depuis le parc',
  $q$insert into public.instrument (entreprise_id, site_id, type, marque, modele, numero_serie, portee_max, echelon) values ('e1000000-0000-0000-0000-000000000001', pg_temp.id('aaaaaaaa', 2), 'Balance', 'Balix', 'C15', 'BX-6', '15 kg', '5 g')$q$);
select pg_temp.doit_toucher('technicien : modifier un instrument du parc : aucune ligne touchée', 0,
  $q$update public.instrument set marque = 'Piraté' where id = pg_temp.id('aaaaaaaa', 3)$q$);

select pg_temp.devenir((select id from comptes where qui = 'gestionnaire'));
select pg_temp.doit_echouer('gestionnaire : créer un client',
  $q$insert into public.client (entreprise_id, agence_id, nom) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'Intrus')$q$);
select pg_temp.doit_toucher('gestionnaire : modifier un site : aucune ligne touchée', 0,
  $q$update public.site set distance_km = 1 where id = pg_temp.id('aaaaaaaa', 2)$q$);
select pg_temp.doit_toucher('gestionnaire : modifier un instrument : aucune ligne touchée', 0,
  $q$update public.instrument set marque = 'Piraté' where id = pg_temp.id('bbbbbbbb', 3)$q$);

select pg_temp.devenir((select id from comptes where qui = 'technicien A désactivé'));
select pg_temp.doit_echouer('compte désactivé : créer un client',
  $q$insert into public.client (entreprise_id, agence_id, nom) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'Intrus')$q$);

select pg_temp.devenir(null);
select pg_temp.doit_echouer('visiteur non connecté : créer un client',
  $q$insert into public.client (entreprise_id, agence_id, nom) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'Intrus')$q$);

-- ---------------------------------------------------------------------------
\echo '--- Administrateur : toutes les agences de son entreprise, rien ailleurs'
-- ---------------------------------------------------------------------------
select pg_temp.devenir((select id from comptes where qui = 'administrateur'));
select pg_temp.doit_toucher('administrateur : créer un client dans l''agence B', 1,
  $q$insert into public.client (id, entreprise_id, agence_id, nom) values ('bbbbbbbb-0000-0000-0000-000000000901', 'e1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b0', 'Nouveau client B')$q$);
select pg_temp.doit_toucher('administrateur : modifier un instrument de l''agence A', 1,
  $q$update public.instrument set emplacement = 'Réserve' where id = pg_temp.id('aaaaaaaa', 3)$q$);
select pg_temp.doit_toucher('administrateur : créer un instrument dans l''agence B', 1,
  $q$insert into public.instrument (id, entreprise_id, site_id, type, marque, modele, numero_serie, portee_max, echelon) values ('bbbbbbbb-0000-0000-0000-000000000903', 'e1000000-0000-0000-0000-000000000001', pg_temp.id('bbbbbbbb', 2), 'Plateforme', 'Tarvex', 'PF', 'TX-200', '300 kg', '100 g')$q$);
select pg_temp.doit_valoir('le numéro suit celui de l''agence A : INS-0004, « À vérifier » par défaut',
  $q$(select numero || ' ' || statut_metrologie from public.instrument where id = 'bbbbbbbb-0000-0000-0000-000000000903') = 'INS-0004 a_verifier'$q$);
select pg_temp.doit_echouer('administrateur : créer un client dans une autre entreprise',
  $q$insert into public.client (entreprise_id, agence_id, nom) values ('cccccccc-0000-0000-0000-0000000000e2', 'cccccccc-0000-0000-0000-0000000000c0', 'Intrus')$q$);
select pg_temp.doit_toucher('administrateur : modifier un client d''une autre entreprise : aucune ligne touchée', 0,
  $q$update public.client set nom = 'Piraté' where id = pg_temp.id('cccccccc', 1)$q$);
select pg_temp.doit_echouer('administrateur : supprimer un instrument',
  $q$delete from public.instrument where id = 'bbbbbbbb-0000-0000-0000-000000000903'$q$);

-- ---------------------------------------------------------------------------
\echo '--- Bilan : rien n''a bougé hors des écritures autorisées'
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.doit_valoir('aucun « Intrus » ni « Piraté » dans la base',
  $q$not exists (select 1 from public.client where nom in ('Intrus', 'Piraté'))
     and not exists (select 1 from public.site where nom = 'Intrus' or distance_km = 1)
     and not exists (select 1 from public.instrument where marque = 'Piraté' or numero in ('INS-7777', 'INS-9999'))$q$);
select pg_temp.doit_valoir('la numérotation est propre à chaque entreprise (l''autre garde son seul INS-0003)',
  $q$(select count(*) from public.instrument where entreprise_id = 'cccccccc-0000-0000-0000-0000000000e2') = 1$q$);
\echo FIN DES ESSAIS
