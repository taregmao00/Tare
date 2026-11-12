-- Phase 2, bloc 1, séance 1 : écriture des clients, des sites et des instruments (CLAUDE.md §4).
--
-- Qui peut créer et modifier :
--   * chef d'agence : les clients, sites et instruments de SON agence ;
--   * administrateur : ceux de TOUTES les agences de son entreprise ;
--   * technicien et gestionnaire : rien ici (le technicien créera un instrument depuis une
--     intervention, dans un bloc ultérieur ; le gestionnaire ne gère ni clients ni instruments).
--
-- Ce qui reste fermé à tout le monde depuis l'appli :
--   * toute SUPPRESSION de client, de site ou d'instrument (l'historique doit rester) ;
--   * la modification du statut métrologique, de l'échéance et du numéro d'un instrument :
--     ils se saisissent à la création, puis ne changent que par un bon signé (§6.8),
--     pour qu'un instrument « À vérifier » ne puisse pas être remis en service à la main ;
--   * le déplacement d'un client vers une autre agence, d'un site vers un autre client,
--     d'un instrument vers un autre site.

-- ---------------------------------------------------------------------------
-- Fiche instrument : marque, modèle, n° de série, portée et échelon deviennent obligatoires
-- (décision du porteur du projet, 12/11/2026 ; question ouverte du §12).
-- ---------------------------------------------------------------------------
alter table public.instrument
  add constraint instrument_marque_obligatoire check (length(btrim(marque)) > 0),
  add constraint instrument_modele_obligatoire check (length(btrim(modele)) > 0),
  add constraint instrument_numero_serie_obligatoire check (length(btrim(numero_serie)) > 0),
  add constraint instrument_portee_obligatoire check (length(btrim(portee_max)) > 0),
  add constraint instrument_echelon_obligatoire check (length(btrim(echelon)) > 0),
  alter column marque set not null,
  alter column modele set not null,
  alter column numero_serie set not null,
  alter column portee_max set not null,
  alter column echelon set not null;

-- ---------------------------------------------------------------------------
-- Les agences dont l'utilisateur connecté peut gérer les clients, sites et instruments.
-- « security definer » : même raison que agences_visibles() (séance 7).
-- ---------------------------------------------------------------------------
create function public.agences_gerables()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
  from public.utilisateur u
  join public.agence a on a.entreprise_id = u.entreprise_id
  where u.id = auth.uid()
    and u.actif
    and (u.role = 'administrateur'
         or (u.role = 'chef_agence' and a.id = u.agence_id))
$$;

revoke execute on function public.agences_gerables() from public, anon;
grant execute on function public.agences_gerables() to authenticated;

-- ---------------------------------------------------------------------------
-- Numéro d'instrument (INS-0001…) attribué par le serveur, et auteur de la création.
-- « security definer » : le prochain numéro se calcule sur TOUS les instruments de
-- l'entreprise, y compris ceux des agences que la personne ne voit pas.
-- ---------------------------------------------------------------------------
create function public.instrument_avant_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  suivant integer;
begin
  -- Depuis l'appli, l'auteur est toujours la personne connectée (jamais un autre nom).
  if auth.uid() is not null then
    new.cree_par_id := auth.uid();
  end if;

  if new.numero is null then
    -- Un seul numéro à la fois par entreprise : deux créations simultanées attendent leur tour.
    perform pg_advisory_xact_lock(hashtextextended('instrument:' || new.entreprise_id::text, 0));
    select coalesce(max(substring(i.numero from 5)::integer), 0) + 1 into suivant
    from public.instrument i
    where i.entreprise_id = new.entreprise_id and i.numero is not null;
    new.numero := 'INS-' || lpad(suivant::text, 4, '0');
  end if;
  return new;
end
$$;

revoke execute on function public.instrument_avant_creation() from public, anon, authenticated;

create trigger instrument_numero_et_auteur
  before insert on public.instrument
  for each row execute function public.instrument_avant_creation();

-- ---------------------------------------------------------------------------
-- Droits accordés à l'appli, colonne par colonne. Aucun droit de suppression.
-- Le numéro d'instrument n'est pas dans la liste : seul le serveur l'attribue.
-- ---------------------------------------------------------------------------
grant insert (id, entreprise_id, agence_id, nom, critique, note) on public.client to authenticated;
grant update (nom, critique, note) on public.client to authenticated;

grant insert (id, entreprise_id, client_id, nom, adresse, contact_nom, contact_fonction,
              contact_telephone, contact_email, distance_km) on public.site to authenticated;
grant update (nom, adresse, contact_nom, contact_fonction, contact_telephone, contact_email,
              distance_km) on public.site to authenticated;

grant insert (id, entreprise_id, site_id, reference_provisoire, type, marque, modele, numero_serie,
              portee_max, echelon, millesime, emplacement, statut_metrologie,
              echeance_verification, motif_statut) on public.instrument to authenticated;
grant update (type, marque, modele, numero_serie, portee_max, echelon, millesime, emplacement)
  on public.instrument to authenticated;

-- ---------------------------------------------------------------------------
-- Règles ligne par ligne : la ligne créée ou modifiée doit appartenir à une agence gérable.
-- ---------------------------------------------------------------------------
create policy client_creation on public.client
  for insert to authenticated
  with check (
    entreprise_id = (select public.entreprise_courante())
    and agence_id in (select public.agences_gerables())
  );

create policy client_modification on public.client
  for update to authenticated
  using (agence_id in (select public.agences_gerables()))
  with check (agence_id in (select public.agences_gerables()));

create policy site_creation on public.site
  for insert to authenticated
  with check (
    client_id in (select c.id from public.client c where c.agence_id in (select public.agences_gerables()))
  );

create policy site_modification on public.site
  for update to authenticated
  using (
    client_id in (select c.id from public.client c where c.agence_id in (select public.agences_gerables()))
  )
  with check (
    client_id in (select c.id from public.client c where c.agence_id in (select public.agences_gerables()))
  );

create policy instrument_creation on public.instrument
  for insert to authenticated
  with check (
    site_id in (
      select s.id from public.site s
      join public.client c on c.id = s.client_id
      where c.agence_id in (select public.agences_gerables())
    )
  );

create policy instrument_modification on public.instrument
  for update to authenticated
  using (
    site_id in (
      select s.id from public.site s
      join public.client c on c.id = s.client_id
      where c.agence_id in (select public.agences_gerables())
    )
  )
  with check (
    site_id in (
      select s.id from public.site s
      join public.client c on c.id = s.client_id
      where c.agence_id in (select public.agences_gerables())
    )
  );
