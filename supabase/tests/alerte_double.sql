-- Essais de l'alerte « instrument en double possible » (phase 2, bloc 1, séance 4 ; §6.9).
-- Sur un Postgres local, après simulation-supabase.sql et toutes les migrations
-- (voir lancer.sh). Chaque ligne doit afficher « OK » ; un « KO » arrête tout.
-- Le jeu d'essai (deux entreprises, agences A, B et Z) est décrit dans jeu_essai.sql :
-- l'agence A a INS-0001 (n° de série TX-1), l'agence B INS-0002 (TX-2), l'autre entreprise TX-3.
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

-- Raccourci : créer un instrument sur le site de l'agence A.
create function pg_temp.creer(id_instrument text, serie text) returns text language sql as $$
  select format(
    $i$insert into public.instrument (id, entreprise_id, site_id, type, marque, modele, numero_serie, portee_max, echelon)
       values (%L, 'e1000000-0000-0000-0000-000000000001', pg_temp.id('aaaaaaaa', 2), 'Balance', 'Balix', 'C15', %L, '15 kg', '5 g')$i$,
    id_instrument, serie)
$$;

-- ---------------------------------------------------------------------------
\echo '--- Création par le chef d''agence A'
-- ---------------------------------------------------------------------------
select pg_temp.devenir((select id from comptes where qui = 'chef d''agence A'));

select pg_temp.doit_toucher('n° de série jamais vu : instrument créé', 1, pg_temp.creer('aaaaaaaa-0000-0000-0000-000000000911', 'BX-900'));
select pg_temp.doit_valoir('n° de série jamais vu : aucune alerte',
  $q$not exists (select 1 from public.alerte where type = 'instrument_double')$q$);

select pg_temp.doit_toucher('n° de série de INS-0001 (majuscules et espaces différents) : instrument créé quand même', 1,
  pg_temp.creer('aaaaaaaa-0000-0000-0000-000000000912', ' tx-1 '));
select pg_temp.doit_valoir('une alerte « instrument_double » pour l''agence A, liée au nouvel instrument, qui nomme INS-0001',
  $q$(select count(*) from public.alerte
      where type = 'instrument_double'
        and agence_id = 'aaaaaaaa-0000-0000-0000-0000000000a0'
        and instrument_id = 'aaaaaaaa-0000-0000-0000-000000000912'
        and detail like '%INS-0001%' and detail like '%INS-0004%'
        and traitee_le is null) = 1$q$);

select pg_temp.doit_toucher('n° de série d''un instrument de l''agence B : instrument créé', 1,
  pg_temp.creer('aaaaaaaa-0000-0000-0000-000000000913', 'TX-2'));
select pg_temp.doit_valoir('alerte créée sans écrire le numéro de l''instrument de l''agence B',
  $q$(select count(*) from public.alerte
      where instrument_id = 'aaaaaaaa-0000-0000-0000-000000000913'
        and agence_id = 'aaaaaaaa-0000-0000-0000-0000000000a0'
        and detail like '%autre agence%' and detail not like '%INS-0002%') = 1$q$);

select pg_temp.doit_toucher('n° de série qui n''existe que dans une autre entreprise : instrument créé', 1,
  pg_temp.creer('aaaaaaaa-0000-0000-0000-000000000914', 'TX-3'));
select pg_temp.doit_valoir('aucune alerte : les entreprises ne se voient jamais',
  $q$not exists (select 1 from public.alerte where instrument_id = 'aaaaaaaa-0000-0000-0000-000000000914')$q$);

-- ---------------------------------------------------------------------------
\echo '--- Import : plusieurs instruments en une seule fois'
-- ---------------------------------------------------------------------------
select pg_temp.doit_toucher('trois instruments d''un coup, dont deux avec le même n° de série', 3,
  $q$insert into public.instrument (id, entreprise_id, site_id, type, marque, modele, numero_serie, portee_max, echelon) values
     ('aaaaaaaa-0000-0000-0000-000000000921', 'e1000000-0000-0000-0000-000000000001', pg_temp.id('aaaaaaaa', 2), 'Balance', 'Balix', 'C15', 'BX-921', '15 kg', '5 g'),
     ('aaaaaaaa-0000-0000-0000-000000000922', 'e1000000-0000-0000-0000-000000000001', pg_temp.id('aaaaaaaa', 2), 'Balance', 'Balix', 'C15', 'BX-922', '15 kg', '5 g'),
     ('aaaaaaaa-0000-0000-0000-000000000923', 'e1000000-0000-0000-0000-000000000001', pg_temp.id('aaaaaaaa', 2), 'Balance', 'Balix', 'C15', 'BX-921', '15 kg', '5 g')$q$);
select pg_temp.doit_valoir('les trois numéros se suivent sans doublon : INS-0007, INS-0008, INS-0009',
  $q$(select string_agg(numero, ' ' order by numero) from public.instrument
      where id in ('aaaaaaaa-0000-0000-0000-000000000921', 'aaaaaaaa-0000-0000-0000-000000000922', 'aaaaaaaa-0000-0000-0000-000000000923'))
     = 'INS-0007 INS-0008 INS-0009'$q$);
select pg_temp.doit_valoir('une seule alerte pour le double à l''intérieur du même envoi',
  $q$(select count(*) from public.alerte
      where instrument_id in ('aaaaaaaa-0000-0000-0000-000000000921', 'aaaaaaaa-0000-0000-0000-000000000922', 'aaaaaaaa-0000-0000-0000-000000000923')) = 1$q$);

-- ---------------------------------------------------------------------------
\echo '--- Modification d''une fiche'
-- ---------------------------------------------------------------------------
select pg_temp.doit_toucher('changer l''emplacement d''un instrument', 1,
  $q$update public.instrument set emplacement = 'Comptoir' where id = 'aaaaaaaa-0000-0000-0000-000000000912'$q$);
select pg_temp.doit_valoir('pas de nouvelle alerte : le n° de série n''a pas changé',
  $q$(select count(*) from public.alerte where instrument_id = 'aaaaaaaa-0000-0000-0000-000000000912') = 1$q$);
select pg_temp.doit_toucher('corriger un n° de série vers un numéro déjà porté', 1,
  $q$update public.instrument set numero_serie = 'BX-922' where id = 'aaaaaaaa-0000-0000-0000-000000000911'$q$);
select pg_temp.doit_valoir('alerte créée à la modification',
  $q$(select count(*) from public.alerte
      where instrument_id = 'aaaaaaaa-0000-0000-0000-000000000911' and detail like '%INS-0008%') = 1$q$);

-- ---------------------------------------------------------------------------
\echo '--- Qui voit ces alertes, et qui peut en écrire'
-- ---------------------------------------------------------------------------
select pg_temp.doit_valoir('le chef d''agence A lit les 4 alertes de double de son agence',
  $q$(select count(*) from public.alerte where type = 'instrument_double') = 4$q$);
select pg_temp.doit_echouer('le chef d''agence ne peut pas écrire une alerte lui-même',
  $q$insert into public.alerte (entreprise_id, agence_id, type, instrument_id, detail)
     values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'instrument_double', pg_temp.id('aaaaaaaa', 3), 'Fausse alerte')$q$);
select pg_temp.doit_echouer('ni en supprimer une',
  $q$delete from public.alerte where type = 'instrument_double'$q$);

select pg_temp.devenir((select id from comptes where qui = 'technicien A'));
select pg_temp.doit_toucher('le technicien A ne lit aucune alerte (§6.10)', 0, $q$select 1 from public.alerte$q$);

select pg_temp.devenir((select id from comptes where qui = 'technicien B'));
select pg_temp.doit_toucher('l''agence B n''a reçu aucune alerte de double', 0,
  $q$select 1 from public.alerte where type = 'instrument_double'$q$);

select pg_temp.devenir((select id from comptes where qui = 'gestionnaire'));
select pg_temp.doit_toucher('le gestionnaire lit les 4 alertes de double', 4,
  $q$select 1 from public.alerte where type = 'instrument_double'$q$);

reset role;
\echo FIN DES ESSAIS
