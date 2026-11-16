-- Essais du cloisonnement (séance 7), au niveau de la base et non de l'écran (CLAUDE.md §9).
-- Sur un Postgres local, après simulation-supabase.sql et toutes les migrations
-- (voir lancer.sh). Chaque ligne doit afficher « OK » ; un « KO » arrête tout.
-- Le jeu d'essai (deux entreprises, agences A, B et Z) est décrit dans jeu_essai.sql.
\set ON_ERROR_STOP on

\ir jeu_essai.sql

-- ---------------------------------------------------------------------------
-- Outils d'essai
-- ---------------------------------------------------------------------------
create temp table tables_essai (nom text primary key, par_agence boolean);
grant select on tables_essai to anon, authenticated;
insert into tables_essai values
  ('entreprise', false), ('agence', false), ('utilisateur', false), ('article', false),
  ('client', true), ('site', true), ('instrument', true), ('intervention', true),
  ('intervention_instrument', true), ('segment_chrono', true), ('journal', true), ('bon', true),
  ('bon_instrument', true), ('ligne_bon', true), ('photo', true), ('alerte', true);

-- Garde-fou : si une migration ajoute une table, elle doit être ajoutée à ces essais.
do $$
declare oubli text;
begin
  select string_agg(tablename, ', ') into oubli from pg_tables
    where schemaname = 'public' and tablename not in (select nom from tables_essai);
  if oubli is not null then raise exception 'KO : table(s) sans essai de cloisonnement : %', oubli; end if;
end $$;

-- Nombre de lignes lues dans une table ; « permission refusée » compte pour zéro ligne lue.
create function pg_temp.lues(nom_table text, filtre text default 'true') returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I t where %s', nom_table, filtre) into n;
  return n;
exception when insufficient_privilege then return 0;
end $$;

-- Vérifie, pour la personne en place, le nombre de lignes lues dans CHAQUE table.
--   generales : entreprise, agence, utilisateur, article (dans cet ordre) ;
--   par_agence : nombre attendu dans chacune des tables métier ; alertes : nombre d'alertes ;
--   interdits : préfixes d'identifiants dont aucune ligne ne doit être lue, dans aucune table métier.
create function pg_temp.verifier(qui text, generales int[], par_agence int, alertes int, interdits text[])
returns void language plpgsql as $$
declare
  t record;
  attendu bigint;
  lu bigint;
  prefixe text;
begin
  for t in select * from tables_essai loop
    attendu := case t.nom
      when 'entreprise' then generales[1] when 'agence' then generales[2]
      when 'utilisateur' then generales[3] when 'article' then generales[4]
      when 'alerte' then alertes else par_agence end;
    lu := pg_temp.lues(t.nom);
    if lu <> attendu then
      raise exception 'KO : % lit % ligne(s) de « % » (attendu : %)', qui, lu, t.nom, attendu;
    end if;
    foreach prefixe in array interdits loop
      lu := pg_temp.lues(t.nom, format('to_jsonb(t)::text like %L', '%' || prefixe || '-%'));
      if t.par_agence and lu <> 0 then
        raise exception 'KO : % lit % ligne(s) de « % » appartenant à « % »', qui, lu, t.nom, prefixe;
      end if;
    end loop;
  end loop;
  raise notice 'OK : % → % ligne(s) par table métier, % alerte(s), rien de %', qui, par_agence, alertes, interdits;
end $$;

-- Vérifie que la personne en place ne peut rien écrire, dans aucune table.
create function pg_temp.verifier_aucune_ecriture(qui text, sauf text[] default '{}') returns void language plpgsql as $$
declare
  t record;
  ordre text;
begin
  for t in select * from tables_essai where nom <> all (sauf) loop
    foreach ordre in array array[
      format('insert into public.%I default values', t.nom),
      format('update public.%I set entreprise_id = null', t.nom),
      format('delete from public.%I', t.nom),
      format('truncate public.%I cascade', t.nom)
    ] loop
      begin
        execute ordre;
      exception
        when insufficient_privilege then continue;   -- refusé : c'est ce qu'on veut
        when undefined_column then                   -- la table « entreprise » n'a pas de colonne entreprise_id
          begin execute format('update public.%I set nom = nom', t.nom);
          exception when insufficient_privilege then continue; end;
      end;
      raise exception 'KO : % a pu exécuter « % »', qui, ordre;
    end loop;
  end loop;
  raise notice 'OK : % ne peut rien écrire (ajout, modification, suppression, vidage refusés sur % tables)',
    qui, (select count(*) from tables_essai where nom <> all (sauf));
end $$;

-- ---------------------------------------------------------------------------
-- Essais de lecture, personne par personne
-- ---------------------------------------------------------------------------
\echo '--- Personne non connectée, compte désactivé, compte sans fiche : rien'
select pg_temp.devenir(null);
select pg_temp.verifier('visiteur non connecté', array[0, 0, 0, 0], 0, 0, array['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
select pg_temp.devenir((select id from comptes where qui = 'technicien A désactivé'));
select pg_temp.verifier('technicien A désactivé', array[0, 0, 0, 0], 0, 0, array['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
select pg_temp.devenir('dddddddd-0000-0000-0000-000000000001');
select pg_temp.verifier('compte sans fiche', array[0, 0, 0, 0], 0, 0, array['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);

\echo '--- Technicien et chef d''agence : leur agence seulement'
select pg_temp.devenir((select id from comptes where qui = 'technicien A'));
select pg_temp.verifier('technicien A', array[1, 2, 6, 1], 1, 0, array['bbbbbbbb', 'cccccccc']);
select pg_temp.devenir((select id from comptes where qui = 'technicien B'));
select pg_temp.verifier('technicien B', array[1, 2, 6, 1], 1, 0, array['aaaaaaaa', 'cccccccc']);
select pg_temp.devenir((select id from comptes where qui = 'chef d''agence A'));
select pg_temp.verifier('chef d''agence A', array[1, 2, 6, 1], 1, 1, array['bbbbbbbb', 'cccccccc']);

\echo '--- Gestionnaire et administrateur : toutes les agences de leur entreprise'
select pg_temp.devenir((select id from comptes where qui = 'gestionnaire'));
select pg_temp.verifier('gestionnaire', array[1, 2, 6, 1], 2, 2, array['cccccccc']);
select pg_temp.devenir((select id from comptes where qui = 'administrateur'));
select pg_temp.verifier('administrateur', array[1, 2, 6, 1], 2, 2, array['cccccccc']);

\echo '--- Autre entreprise : rien de la première'
select pg_temp.devenir((select id from comptes where qui = 'technicien autre entreprise'));
select pg_temp.verifier('technicien autre entreprise', array[1, 1, 2, 1], 1, 0, array['aaaaaaaa', 'bbbbbbbb']);
select pg_temp.devenir((select id from comptes where qui = 'gestionnaire autre entreprise'));
select pg_temp.verifier('gestionnaire autre entreprise', array[1, 1, 2, 1], 1, 1, array['aaaaaaaa', 'bbbbbbbb']);

-- ---------------------------------------------------------------------------
-- Écritures depuis l'appli : seuls le chef d'agence et l'administrateur écrivent, et seulement
-- dans les clients, sites et instruments (essais détaillés dans ecritures_parc.sql).
-- ---------------------------------------------------------------------------
\echo '--- Écritures fermées depuis l''appli'
select pg_temp.devenir(null);
select pg_temp.verifier_aucune_ecriture('visiteur non connecté');
select pg_temp.devenir((select id from comptes where qui = 'technicien A'));
select pg_temp.verifier_aucune_ecriture('technicien A');
select pg_temp.devenir((select id from comptes where qui = 'gestionnaire'));
select pg_temp.verifier_aucune_ecriture('gestionnaire');
select pg_temp.devenir((select id from comptes where qui = 'chef d''agence A'));
select pg_temp.verifier_aucune_ecriture('chef d''agence A (hors clients, sites, instruments)', array['client', 'site', 'instrument']);
select pg_temp.devenir((select id from comptes where qui = 'administrateur'));
select pg_temp.verifier_aucune_ecriture('administrateur (hors clients, sites, instruments)', array['client', 'site', 'instrument']);

-- Même contrôle au niveau des droits accordés (sans compter sur la RLS pour refuser).
reset role;
do $$
declare ouvert text;
begin
  select string_agg(r || ' → ' || t.nom, ', ') into ouvert
  from tables_essai t, unnest(array['anon', 'authenticated']) r
  where has_table_privilege(r, 'public.' || t.nom, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or (r = 'anon' and has_any_column_privilege(r, 'public.' || t.nom, 'SELECT, INSERT, UPDATE'))
     or (t.nom not in ('client', 'site', 'instrument')
         and has_any_column_privilege(r, 'public.' || t.nom, 'INSERT, UPDATE'));
  if ouvert is not null then raise exception 'KO : droit(s) en trop : %', ouvert; end if;
  raise notice 'OK : aucun droit de suppression nulle part, aucun droit d''écriture hors clients, sites et instruments, aucun droit pour le visiteur';
end $$;

-- ---------------------------------------------------------------------------
-- Un compte désactivé perd la lecture tout de suite ; un visiteur n'appelle pas les fonctions
-- ---------------------------------------------------------------------------
\echo '--- Désactivation et fonctions'
reset role;
update public.utilisateur set actif = false where nom = 'technicien B';
select pg_temp.devenir((select id from comptes where qui = 'technicien B'));
select pg_temp.verifier('technicien B, une fois désactivé', array[0, 0, 0, 0], 0, 0, array['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);

select pg_temp.devenir(null);
do $$
declare f text;
begin
  foreach f in array array['entreprise_courante', 'agences_visibles', 'agences_alertes_visibles', 'agences_gerables'] loop
    begin
      execute format('select public.%I()', f);
    exception when insufficient_privilege then
      raise notice 'OK : un visiteur non connecté ne peut pas appeler %()', f;
      continue;
    end;
    raise exception 'KO : un visiteur non connecté a pu appeler %()', f;
  end loop;
end $$;
reset role;
\echo FIN DES ESSAIS
