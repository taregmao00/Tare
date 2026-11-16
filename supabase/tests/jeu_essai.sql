-- Jeu d'essai commun aux essais de la base (inclus par « \ir jeu_essai.sql »).
-- Deux entreprises. La première a deux agences (A et B), la seconde une seule (Z).
-- Chaque agence reçoit exactement UNE ligne dans chaque table métier.
-- Les identifiants commencent par aaaaaaaa (agence A), bbbbbbbb (agence B) ou cccccccc
-- (autre entreprise) : on peut ainsi vérifier à qui appartient une ligne lue.

create function pg_temp.id(prefixe text, n int) returns uuid language sql immutable as $$
  select (prefixe || '-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- Une ligne dans chaque table métier, pour une agence.
create function pg_temp.jeu(p text, n int, entreprise uuid, agence uuid, technicien uuid) returns void
language plpgsql as $$
begin
  insert into public.client (id, entreprise_id, agence_id, nom) values (pg_temp.id(p, 1), entreprise, agence, 'Client ' || p);
  insert into public.site (id, entreprise_id, client_id, nom, distance_km) values (pg_temp.id(p, 2), entreprise, pg_temp.id(p, 1), 'Site', 10);
  insert into public.instrument (id, entreprise_id, site_id, numero, type, marque, modele, numero_serie, portee_max, echelon)
    values (pg_temp.id(p, 3), entreprise, pg_temp.id(p, 2), 'INS-000' || n, 'Balance', 'Tarvex', 'T1', 'TX-' || n, '15 kg', '5 g');
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

-- Se met à la place d'un utilisateur de l'appli (ou d'un visiteur si le compte est nul).
create function pg_temp.devenir(compte uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(compte::text, ''), false);
  if compte is null then set role anon; else set role authenticated; end if;
end $$;

