-- Séance 7 : cloisonnement par agence (CLAUDE.md §4 et §8), en LECTURE seulement.
--
-- Qui voit quoi :
--   * visiteur non connecté, compte désactivé, compte sans fiche : rien ;
--   * tout utilisateur actif : son entreprise, ses agences, les utilisateurs de son entreprise
--     (règles de la séance 5, inchangées) et le catalogue ;
--   * technicien, chef d'agence : les données de LEUR agence (clients, sites, instruments,
--     interventions et tout ce qui en dépend) ;
--   * gestionnaire, administrateur : les mêmes données pour TOUTES les agences de l'entreprise ;
--   * alertes : chef d'agence (son agence), gestionnaire et administrateur (toutes) ;
--     jamais le technicien (§6.10).
--
-- Aucune écriture n'est ouverte ici : elles viendront bloc par bloc en phase 2.
-- Les verrous de la séance 6 (journal, bon signé, retrait d'instrument) ne sont pas touchés.

-- ---------------------------------------------------------------------------
-- Les agences dont l'utilisateur connecté peut lire les données.
-- Liste vide si personne n'est connecté, si le compte n'a pas de fiche ou s'il est désactivé.
-- « security definer » : la fonction lit utilisateur et agence sans repasser par la RLS
-- (même raison que entreprise_courante(), séance 5).
-- ---------------------------------------------------------------------------
create function public.agences_visibles()
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
    and (u.role in ('gestionnaire', 'administrateur') or a.id = u.agence_id)
$$;

-- Les agences dont l'utilisateur connecté peut lire les alertes : comme ci-dessus,
-- sauf pour le technicien, qui n'en voit aucune.
create function public.agences_alertes_visibles()
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
    and (u.role in ('gestionnaire', 'administrateur')
         or (u.role = 'chef_agence' and a.id = u.agence_id))
$$;

revoke execute on function public.agences_visibles(), public.agences_alertes_visibles() from public, anon;
grant execute on function public.agences_visibles(), public.agences_alertes_visibles() to authenticated;

-- ---------------------------------------------------------------------------
-- Droit de lecture pour les utilisateurs connectés. La RLS (activée à la séance 6) filtre
-- ensuite ligne par ligne. Les visiteurs non connectés (anon) n'ont toujours aucun droit.
-- ---------------------------------------------------------------------------
grant select on
  public.client, public.site, public.instrument, public.article, public.intervention,
  public.intervention_instrument, public.segment_chrono, public.journal, public.bon,
  public.bon_instrument, public.ligne_bon, public.photo, public.alerte
to authenticated;

-- Catalogue : toute l'entreprise.
create policy article_lecture on public.article
  for select to authenticated
  using (entreprise_id = (select public.entreprise_courante()));

-- Tables qui portent directement l'agence.
create policy client_lecture on public.client
  for select to authenticated
  using (agence_id in (select public.agences_visibles()));

create policy intervention_lecture on public.intervention
  for select to authenticated
  using (agence_id in (select public.agences_visibles()));

create policy alerte_lecture on public.alerte
  for select to authenticated
  using (agence_id in (select public.agences_alertes_visibles()));

-- Tables rattachées à un client : on voit la ligne si on voit son parent.
-- (La sous-requête passe elle-même par la règle du parent : une seule définition du cloisonnement.)
create policy site_lecture on public.site
  for select to authenticated
  using (client_id in (select c.id from public.client c));

create policy instrument_lecture on public.instrument
  for select to authenticated
  using (site_id in (select s.id from public.site s));

-- Tables rattachées à une intervention.
create policy intervention_instrument_lecture on public.intervention_instrument
  for select to authenticated
  using (intervention_id in (select i.id from public.intervention i));

create policy segment_chrono_lecture on public.segment_chrono
  for select to authenticated
  using (intervention_id in (select i.id from public.intervention i));

create policy journal_lecture on public.journal
  for select to authenticated
  using (intervention_id in (select i.id from public.intervention i));

create policy bon_lecture on public.bon
  for select to authenticated
  using (intervention_id in (select i.id from public.intervention i));

create policy photo_lecture on public.photo
  for select to authenticated
  using (intervention_id in (select i.id from public.intervention i));

-- Tables rattachées à un bon.
create policy bon_instrument_lecture on public.bon_instrument
  for select to authenticated
  using (bon_id in (select b.id from public.bon b));

create policy ligne_bon_lecture on public.ligne_bon
  for select to authenticated
  using (bon_id in (select b.id from public.bon b));
