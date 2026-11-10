-- Essais du cloisonnement (séance 7), au niveau de la base et non de l'écran (CLAUDE.md §9).
-- Sur un Postgres local, après simulation-supabase.sql et toutes les migrations
-- (voir lancer.sh). Chaque ligne doit afficher « OK » ; un « KO » arrête tout.
--
-- Jeu d'essai : deux entreprises. La première a deux agences (A et B), la seconde une seule (Z).
-- Chaque agence reçoit exactement UNE ligne dans chaque table métier.
-- Les identifiants commencent par aaaaaaaa (agence A), bbbbbbbb (agence B) ou cccccccc
-- (autre entreprise) : on peut ainsi vérifier, table par table, à qui appartient une ligne lue.
\set ON_ERROR_STOP on

create function pg_temp.id(prefixe text, n int) returns uuid language sql immutable as $$
  select (prefixe || '-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- Une ligne dans chaque table métier, pour une agence.
create function pg_temp.jeu(p text, n int, entreprise uuid, agence uuid, technicien uuid) returns void
language plpgsql as $$
begin
  insert into public.client (id, entreprise_id, agence_id, nom) values (pg_temp.id(p, 1), entreprise, agence, 'Client ' || p);
  insert into public.site (id, entreprise_id, client_id, nom, distance_km) values (pg_temp.id(p, 2), entreprise, pg_temp.id(p, 1), 'Site', 10);
  insert into public.instrument (id, entreprise_id, site_id, numero, type) values (pg_temp.id(p, 3), entreprise, pg_temp.id(p, 2), 'INS-000' || n, 'Balance');
  insert into public.intervention (id, entreprise_id, agence_id, numero, type, client_id, site_id, statut, titulaire_id)
    values (pg_temp.id(p, 4), entreprise, agence, 'INT-000' || n, 'reparation', pg_temp.id(p, 1), pg_temp.id(p, 2), 'en_cours', technicien);
  insert into public.intervention_instrument (intervention_id, instrument_id, entreprise_id, site_id)
    values (pg_temp.id(p, 4), pg_temp.id(p, 3), entreprise, pg_temp.id(p, 2));
  insert into public.segment_chrono (id, entreprise_id, intervention_id, demarre_par_id, appareil, debut, fin)
    values (pg_temp.id(p, 5), entreprise, pg_temp.id(p, 4), technicien, 'tel', '2026-11-09 09:00Z', '2026-11-09 09:50Z');
  insert into public.journal (id, entreprise_id, intervention_id, auteur_id, texte)
    values (pg_temp.id(p, 6), entreprise, pg_temp.id(p, 4), technicien, 'Chrono démarré');
  insert into public.bon (id, entreprise_id, intervention_id, reference_provisoire, signe_le, titulaire_id, travaux_realises,
      minutes_chrono, nombre_personnes, minutes_facturees_par_personne, taux_horaire_applique_centimes, distance_km,
      forfait_deplacement_applique_centimes, libelle_zone, nombre_passages, nombre_forfaits_factures, nom_signataire, signature, total_ht_centimes)
    values (pg_temp.id(p, 7), entreprise, pg_temp.id(p, 4), 'PROV-' || p, '2026-11-09 09:55Z', technicien, 'Réparation',
      50, 1, 60, 6500, 10, 5000, 'Jusqu''à 20 km', 1, 1, 'Signataire', 'data:image/png;base64,AAAA', 11500);
  insert into public.bon_instrument (bon_id, instrument_id, entreprise_id, chaine_mesure_touchee)
    values (pg_temp.id(p, 7), pg_temp.id(p, 3), entreprise, false);
  insert into public.ligne_bon (id, entreprise_id, bon_id, nature, designation, quantite, prix_unitaire_ht_centimes)
    values (pg_temp.id(p, 8), entreprise, pg_temp.id(p, 7), 'petit_materiel', 'Gaine', 1, 100);
  insert into public.photo (id, entreprise_id, intervention_id, bon_id, chemin, prise_le)
    values (pg_temp.id(p, 9), entreprise, pg_temp.id(p, 4), pg_temp.id(p, 7), 'photos/' || p || '.jpg', '2026-11-09 09:30Z');
  insert into public.alerte (id, entreprise_id, agence_id, type, intervention_id, detail)
    values (pg_temp.id(p, 10), entreprise, agence, 'ecart_horloge', pg_temp.id(p, 4), 'Écart de 20 min');
end $$;

-- ---------------------------------------------------------------------------
-- Jeu d'essai
-- ---------------------------------------------------------------------------
insert into public.entreprise (id, nom) values
  ('e1000000-0000-0000-0000-000000000001', 'Pesage Démo'),
  ('cccccccc-0000-0000-0000-0000000000e2', 'Autre Pesage');
insert into public.agence (id, entreprise_id, nom) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'e1000000-0000-0000-0000-000000000001', 'Agence A'),
  ('bbbbbbbb-0000-0000-0000-0000000000b0', 'e1000000-0000-0000-0000-000000000001', 'Agence B'),
  ('cccccccc-0000-0000-0000-0000000000c0', 'cccccccc-0000-0000-0000-0000000000e2', 'Agence Z');

create temp table comptes (qui text primary key, id uuid, entreprise uuid, agence uuid, role text, actif boolean);
grant select on comptes to anon, authenticated;
insert into comptes values
  ('technicien A',            'aaaaaaaa-0000-0000-0000-000000000101', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'technicien', true),
  ('chef d''agence A',        'aaaaaaaa-0000-0000-0000-000000000102', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'chef_agence', true),
  ('technicien A désactivé',  'aaaaaaaa-0000-0000-0000-000000000103', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'technicien', false),
  ('technicien B',            'bbbbbbbb-0000-0000-0000-000000000101', 'e1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b0', 'technicien', true),
  ('gestionnaire',            'e1000000-0000-0000-0000-000000000201', 'e1000000-0000-0000-0000-000000000001', null, 'gestionnaire', true),
  ('administrateur',          'e1000000-0000-0000-0000-000000000202', 'e1000000-0000-0000-0000-000000000001', null, 'administrateur', true),
  ('technicien autre entreprise',   'cccccccc-0000-0000-0000-000000000101', 'cccccccc-0000-0000-0000-0000000000e2', 'cccccccc-0000-0000-0000-0000000000c0', 'technicien', true),
  ('gestionnaire autre entreprise', 'cccccccc-0000-0000-0000-000000000201', 'cccccccc-0000-0000-0000-0000000000e2', null, 'gestionnaire', true);

insert into auth.users (id, email)
  select id, 'compte' || row_number() over () || '@exemple.fr' from comptes;
-- Un compte de connexion sans fiche utilisateur.
insert into auth.users (id, email) values ('dddddddd-0000-0000-0000-000000000001', 'sans-fiche@exemple.fr');
insert into public.utilisateur (id, entreprise_id, agence_id, nom, email, role, actif)
  select c.id, c.entreprise, c.agence, c.qui, u.email, c.role, c.actif from comptes c join auth.users u using (id);

insert into public.article (entreprise_id, code, designation, prix_unitaire_ht_centimes) values
  ('e1000000-0000-0000-0000-000000000001', '1', 'Câble de capteur blindé 4 fils (le mètre)', 450),
  ('cccccccc-0000-0000-0000-0000000000e2', '1', 'Article de l''autre entreprise', 100);

select pg_temp.jeu('aaaaaaaa', 1, 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000101');
select pg_temp.jeu('bbbbbbbb', 2, 'e1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b0', 'bbbbbbbb-0000-0000-0000-000000000101');
select pg_temp.jeu('cccccccc', 3, 'cccccccc-0000-0000-0000-0000000000e2', 'cccccccc-0000-0000-0000-0000000000c0', 'cccccccc-0000-0000-0000-000000000101');

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

-- Se met à la place d'un utilisateur de l'appli (ou d'un visiteur si le compte est nul).
create function pg_temp.devenir(compte uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(compte::text, ''), false);
  if compte is null then set role anon; else set role authenticated; end if;
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
create function pg_temp.verifier_aucune_ecriture(qui text) returns void language plpgsql as $$
declare
  t record;
  ordre text;
begin
  for t in select * from tables_essai loop
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
    qui, (select count(*) from tables_essai);
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
-- Aucune écriture depuis l'appli, même pour les rôles les plus larges
-- ---------------------------------------------------------------------------
\echo '--- Aucune écriture ouverte depuis l''appli'
select pg_temp.devenir(null);
select pg_temp.verifier_aucune_ecriture('visiteur non connecté');
select pg_temp.devenir((select id from comptes where qui = 'technicien A'));
select pg_temp.verifier_aucune_ecriture('technicien A');
select pg_temp.devenir((select id from comptes where qui = 'chef d''agence A'));
select pg_temp.verifier_aucune_ecriture('chef d''agence A');
select pg_temp.devenir((select id from comptes where qui = 'gestionnaire'));
select pg_temp.verifier_aucune_ecriture('gestionnaire');
select pg_temp.devenir((select id from comptes where qui = 'administrateur'));
select pg_temp.verifier_aucune_ecriture('administrateur');

-- Même contrôle au niveau des droits accordés (sans compter sur la RLS pour refuser).
reset role;
do $$
declare ouvert text;
begin
  select string_agg(r || ' → ' || t.nom, ', ') into ouvert
  from tables_essai t, unnest(array['anon', 'authenticated']) r
  where has_table_privilege(r, 'public.' || t.nom, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or (r = 'anon' and has_table_privilege(r, 'public.' || t.nom, 'SELECT'));
  if ouvert is not null then raise exception 'KO : droit(s) en trop : %', ouvert; end if;
  raise notice 'OK : aucun droit d''écriture accordé à l''appli, aucun droit de lecture au visiteur';
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
  foreach f in array array['entreprise_courante', 'agences_visibles', 'agences_alertes_visibles'] loop
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
