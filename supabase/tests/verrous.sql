-- Essais des verrous de la base (séance 6). Sur un Postgres local, après simulation-supabase.sql
-- et les migrations : chaque ligne doit afficher « OK », jamais « KO ».
\set ON_ERROR_STOP on
create function pg_temp.doit_echouer(nom text, requete text) returns void language plpgsql as $$
begin
  begin execute requete; exception when others then raise notice 'OK (refusé) : % → %', nom, sqlerrm; return; end;
  raise exception 'KO : % aurait dû être refusé', nom;
end $$;
create function pg_temp.doit_passer(nom text, requete text) returns void language plpgsql as $$
begin execute requete; raise notice 'OK (accepté) : %', nom; end $$;

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1','karim@exemple.fr'),('00000000-0000-0000-0000-0000000000b1','autre@exemple.fr');
insert into entreprise (id, nom) values ('e0000000-0000-0000-0000-000000000001','Pesage Démo'),('e0000000-0000-0000-0000-000000000002','Autre');
insert into agence (id, entreprise_id, nom) values
 ('a0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','Sud'),
 ('a0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001','Nord'),
 ('a0000000-0000-0000-0000-000000000009','e0000000-0000-0000-0000-000000000002','Ailleurs');
insert into utilisateur (id, entreprise_id, agence_id, nom, email, role) values
 ('00000000-0000-0000-0000-0000000000a1','e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Karim B.','karim@exemple.fr','technicien'),
 ('00000000-0000-0000-0000-0000000000b1','e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000009','Autre','autre@exemple.fr','technicien');
insert into client (id, entreprise_id, agence_id, nom, critique) values
 ('c0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Primeurs Dubois', false);
insert into site (id, entreprise_id, client_id, nom, distance_km, contact_email) values
 ('50000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Magasin',3,'contact@exemple.fr'),
 ('50000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Entrepôt',5,null);
insert into instrument (id, entreprise_id, site_id, numero, type, marque, numero_serie, statut_metrologie, echeance_verification) values
 ('10000000-0000-0000-0000-000000000802','e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','INS-0802','Balance poids-prix','Tarvex','TX-1','verte','2026-11'),
 ('10000000-0000-0000-0000-000000000803','e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','INS-0803','Balance poids-prix','Balix','BX-1','verte','2026-12'),
 ('10000000-0000-0000-0000-000000000900','e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','INS-0900','Plateforme','Balix','BX-9','a_verifier',null);
insert into intervention (id, entreprise_id, agence_id, numero, type, client_id, site_id, statut, titulaire_id) values
 ('d0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','INT-0001','verification','c0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','en_cours','00000000-0000-0000-0000-0000000000a1');
insert into intervention_instrument (intervention_id, instrument_id, entreprise_id, site_id) values
 ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000802','e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001'),
 ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000803','e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001');

select pg_temp.doit_echouer('client rattaché à une agence d''une autre entreprise',
 $q$insert into client (entreprise_id, agence_id, nom) values ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000009','X')$q$);
select pg_temp.doit_echouer('intervention dont l''agence n''est pas celle du client',
 $q$insert into intervention (entreprise_id, agence_id, numero, type, client_id, site_id) values ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','INT-0002','reparation','c0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001')$q$);
select pg_temp.doit_echouer('intervention prise sans titulaire',
 $q$insert into intervention (entreprise_id, agence_id, numero, type, client_id, site_id, statut) values ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','INT-0003','reparation','c0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','prise')$q$);
select pg_temp.doit_echouer('titulaire d''une autre entreprise',
 $q$update intervention set titulaire_id='00000000-0000-0000-0000-0000000000b1' where numero='INT-0001'$q$);
select pg_temp.doit_echouer('instrument d''un autre site dans l''intervention',
 $q$insert into intervention_instrument (intervention_id, instrument_id, entreprise_id, site_id) values ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000900','e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001')$q$);
select pg_temp.doit_echouer('vignette verte sans échéance',
 $q$update instrument set echeance_verification=null where numero='INS-0802'$q$);
select pg_temp.doit_echouer('échéance avec un jour (2027-11-15)',
 $q$update instrument set echeance_verification='2027-11-15' where numero='INS-0802'$q$);
select pg_temp.doit_echouer('échéance au mois 13',
 $q$update instrument set echeance_verification='2027-13' where numero='INS-0802'$q$);
select pg_temp.doit_echouer('échéance au format 11/2027',
 $q$update instrument set echeance_verification='11/2027' where numero='INS-0802'$q$);
select pg_temp.doit_passer('échéance 2027-11',
 $q$update instrument set echeance_verification='2027-11' where numero='INS-0802'$q$);
select pg_temp.doit_passer('instrument créé hors ligne (référence provisoire) avec n° de série en double',
 $q$insert into instrument (entreprise_id, site_id, reference_provisoire, type, numero_serie) values ('e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','PROV-tel1-20261109T1000','Balance','TX-1')$q$);
select pg_temp.doit_echouer('instrument sans numéro ni référence',
 $q$insert into instrument (entreprise_id, site_id, type) values ('e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Balance')$q$);
select pg_temp.doit_passer('retrait d''un instrument avant signature',
 $q$delete from intervention_instrument where instrument_id='10000000-0000-0000-0000-000000000803'; insert into intervention_instrument (intervention_id, instrument_id, entreprise_id, site_id) values ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000803','e0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001')$q$);

-- Segments, journal
insert into segment_chrono (id, entreprise_id, intervention_id, demarre_par_id, appareil, debut, fin) values
 (gen_random_uuid(),'e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','tel1','2026-11-09 09:00Z','2026-11-09 09:50Z');
select pg_temp.doit_echouer('segment qui finit avant de commencer',
 $q$insert into segment_chrono (id, entreprise_id, intervention_id, demarre_par_id, appareil, debut, fin) values (gen_random_uuid(),'e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','tel1','2026-11-09 10:00Z','2026-11-09 09:00Z')$q$);
insert into journal (entreprise_id, intervention_id, auteur_id, texte) values ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Chrono démarré');
select pg_temp.doit_echouer('modifier le journal', $q$update journal set texte='autre'$q$);
select pg_temp.doit_echouer('supprimer le journal', $q$delete from journal$q$);
select pg_temp.doit_echouer('vider le journal', $q$truncate journal$q$);

-- Bon signé
insert into bon (id, entreprise_id, intervention_id, reference_provisoire, signe_le, titulaire_id, travaux_realises, minutes_chrono, nombre_personnes, minutes_facturees_par_personne, taux_horaire_applique_centimes, distance_km, forfait_deplacement_applique_centimes, libelle_zone, nombre_passages, nombre_forfaits_factures, nom_signataire, signature, total_ht_centimes)
values ('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','PROV-tel1-20261109T0955','2026-11-09 09:55Z','00000000-0000-0000-0000-0000000000a1','Vérification des 2 balances',50,1,60,6500,3,5000,'Zone 1 (≤ 20 km)',1,1,'M. Dubois','data:image/png;base64,AAAA',11500);
insert into bon_instrument values
 ('b0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000802','e0000000-0000-0000-0000-000000000001',null,'conforme','2027-11',null),
 ('b0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000803','e0000000-0000-0000-0000-000000000001',null,'non_conforme',null,'Écart en charge');
insert into ligne_bon (entreprise_id, bon_id, nature, code_article, designation, quantite, prix_unitaire_ht_centimes) values
 ('e0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','catalogue','1','Câble de capteur blindé 4 fils (le mètre)',2.5,450);

select pg_temp.doit_echouer('conforme sans nouvelle échéance',
 $q$insert into bon_instrument values ('b0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000900','e0000000-0000-0000-0000-000000000001',null,'conforme',null,null)$q$);
select pg_temp.doit_echouer('modifier les travaux d''un bon signé', $q$update bon set travaux_realises='autre'$q$);
select pg_temp.doit_echouer('modifier le total d''un bon signé', $q$update bon set total_ht_centimes=1$q$);
select pg_temp.doit_echouer('supprimer un bon signé', $q$delete from bon$q$);
select pg_temp.doit_echouer('modifier un résultat de vérification', $q$update bon_instrument set resultat_verification='conforme', nouvelle_echeance='2027-12' where instrument_id='10000000-0000-0000-0000-000000000803'$q$);
select pg_temp.doit_echouer('modifier une ligne de pièce', $q$update ligne_bon set prix_unitaire_ht_centimes=1$q$);
select pg_temp.doit_echouer('retirer un instrument après signature', $q$delete from intervention_instrument where instrument_id='10000000-0000-0000-0000-000000000803'$q$);
select pg_temp.doit_passer('attribuer le numéro définitif', $q$update bon set numero='BI-2026-0001'$q$);
select pg_temp.doit_echouer('changer le numéro définitif', $q$update bon set numero='BI-2026-0002'$q$);
select pg_temp.doit_passer('marquer le bon envoyé', $q$update bon set envoye=true, envoye_le=now()$q$);
select pg_temp.doit_echouer('repasser le bon en « valide » après annulation', $q$update bon set statut='annule_remplace'; update bon set statut='valide'$q$);
select pg_temp.doit_echouer('correction de temps sans motif',
 $q$insert into bon (id, entreprise_id, intervention_id, reference_provisoire, signe_le, titulaire_id, travaux_realises, minutes_chrono, minutes_corrigees, corrige_par_id, nombre_personnes, minutes_facturees_par_personne, taux_horaire_applique_centimes, distance_km, forfait_deplacement_applique_centimes, libelle_zone, nombre_passages, nombre_forfaits_factures, nom_signataire, signature, total_ht_centimes) values (gen_random_uuid(),'e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','PROV-x','2026-11-09Z','00000000-0000-0000-0000-0000000000a1','x',50,40,'00000000-0000-0000-0000-0000000000a1',1,30,6500,3,5000,'z',1,1,'M','data:image/png;base64,A',1)$q$);
select pg_temp.doit_echouer('2 forfaits pour 1 seul passage',
 $q$insert into bon (id, entreprise_id, intervention_id, reference_provisoire, signe_le, titulaire_id, travaux_realises, minutes_chrono, nombre_personnes, minutes_facturees_par_personne, taux_horaire_applique_centimes, distance_km, forfait_deplacement_applique_centimes, libelle_zone, nombre_passages, nombre_forfaits_factures, nom_signataire, signature, total_ht_centimes) values (gen_random_uuid(),'e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','PROV-y','2026-11-09Z','00000000-0000-0000-0000-0000000000a1','x',50,1,60,6500,3,5000,'z',1,2,'M','data:image/png;base64,A',1)$q$);
select pg_temp.doit_echouer('rectificatif refusé avec un numéro',
 $q$insert into bon (id, entreprise_id, intervention_id, numero, statut, bon_remplace_id, motif_rectification, reference_provisoire, signe_le, titulaire_id, travaux_realises, minutes_chrono, nombre_personnes, minutes_facturees_par_personne, taux_horaire_applique_centimes, distance_km, forfait_deplacement_applique_centimes, libelle_zone, nombre_passages, nombre_forfaits_factures, nom_signataire, signature, total_ht_centimes) values (gen_random_uuid(),'e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','BI-2026-0009','refuse','b0000000-0000-0000-0000-000000000001','erreur','PROV-z','2026-11-09Z','00000000-0000-0000-0000-0000000000a1','x',50,1,60,6500,3,5000,'z',1,1,'M','data:image/png;base64,A',1)$q$);
select pg_temp.doit_echouer('rectificatif sans motif',
 $q$insert into bon (id, entreprise_id, intervention_id, bon_remplace_id, reference_provisoire, signe_le, titulaire_id, travaux_realises, minutes_chrono, nombre_personnes, minutes_facturees_par_personne, taux_horaire_applique_centimes, distance_km, forfait_deplacement_applique_centimes, libelle_zone, nombre_passages, nombre_forfaits_factures, nom_signataire, signature, total_ht_centimes) values (gen_random_uuid(),'e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','PROV-r','2026-11-09Z','00000000-0000-0000-0000-0000000000a1','x',50,1,60,6500,3,5000,'z',1,1,'M','data:image/png;base64,A',1)$q$);
select pg_temp.doit_echouer('passages corrigés sans motif',
 $q$insert into bon (id, entreprise_id, intervention_id, reference_provisoire, signe_le, titulaire_id, travaux_realises, minutes_chrono, nombre_personnes, minutes_facturees_par_personne, taux_horaire_applique_centimes, distance_km, forfait_deplacement_applique_centimes, libelle_zone, nombre_passages, nombre_passages_corrige, nombre_forfaits_factures, nom_signataire, signature, total_ht_centimes) values (gen_random_uuid(),'e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','PROV-p','2026-11-09Z','00000000-0000-0000-0000-0000000000a1','x',50,1,60,6500,3,5000,'z',1,2,1,'M','data:image/png;base64,A',1)$q$);
select pg_temp.doit_echouer('alerte liée à rien',
 $q$insert into alerte (entreprise_id, agence_id, type, detail) values ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','ecart_horloge','x')$q$);
select pg_temp.doit_echouer('intervention facturée sans auteur',
 $q$update intervention set statut='facturee', facturee_le=now() where numero='INT-0001'$q$);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.doit_echouer('lecture des interventions depuis l''appli (pas encore de règle RLS)', $q$select * from intervention$q$);
reset role;
\echo FIN DES ESSAIS
