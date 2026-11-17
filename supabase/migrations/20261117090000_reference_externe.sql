-- Référence externe des interventions (décision du porteur du projet, 17/11/2026).
--
-- Chaque société de pesage rattache ses interventions à un numéro qui lui est propre
-- (« N° de message », « N° d'OS », « N° de dossier »…) pour les rapprocher de ses commandes et
-- de ses factures. Tare stocke ce numéro et le ressort partout ; il ne le remplace pas.
--
--   * la référence est facultative, modifiable après la création de l'intervention ;
--   * elle n'est PAS unique : plusieurs interventions peuvent partager la même ;
--   * en V1, une intervention a au plus UNE référence. La structure (une table de liens)
--     permettra plus tard d'en accepter plusieurs en retirant une seule contrainte ;
--   * le nom affiché du champ est un réglage de l'entreprise (« Référence externe » par défaut) ;
--   * pour comparer et chercher, les espaces en trop et les majuscules ne comptent pas ;
--   * qui la saisit : technicien, chef d'agence (leur agence), administrateur (toutes).
--     Le gestionnaire la lit sans la modifier (§4 : il ne gère pas les interventions) ;
--   * modifiable jusqu'à ce que l'intervention soit « Facturée », ensuite figée ;
--   * chaque ajout, modification ou retrait est écrit au journal de l'intervention, par la base.

-- ---------------------------------------------------------------------------
-- Libellé du champ : un réglage de l'entreprise.
-- ---------------------------------------------------------------------------
alter table public.entreprise
  add column libelle_reference_externe text not null default 'Référence externe',
  add constraint entreprise_libelle_reference_valide check (
    libelle_reference_externe = regexp_replace(btrim(libelle_reference_externe), '\s+', ' ', 'g')
    and length(libelle_reference_externe) between 1 and 40
  );

comment on column public.entreprise.libelle_reference_externe is
  'Nom affiché du champ « référence externe » des interventions (ex. N° de message, N° d''OS).';

-- ---------------------------------------------------------------------------
-- Forme de comparaison d'une référence : espaces en trop retirés, en majuscules.
-- Même règle que normaliserReference() dans lib/regles/reference.ts (essais des deux côtés).
-- « und-x-icu » : majuscules selon Unicode, comme le téléphone (é → É), quel que soit le réglage
-- de langue de la base.
-- ---------------------------------------------------------------------------
create function public.normaliser_reference(texte text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select upper(regexp_replace(btrim(texte), '\s+', ' ', 'g') collate "und-x-icu")
$$;

-- ---------------------------------------------------------------------------
-- Lien entre une intervention et sa référence externe.
-- ---------------------------------------------------------------------------
create table public.intervention_reference (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  intervention_id uuid not null,
  -- Telle que saisie, espaces en trop déjà retirés (c'est ce qu'on affiche).
  reference text not null check (
    reference = regexp_replace(btrim(reference), '\s+', ' ', 'g')
    and length(reference) between 1 and 60
  ),
  -- Calculée par la base, jamais saisie : sert à comparer et à chercher.
  reference_normalisee text generated always as (public.normaliser_reference(reference)) stored,
  ajoutee_par_id uuid,
  ajoutee_le timestamptz not null default now(),
  modifiee_par_id uuid,
  modifiee_le timestamptz not null default now(),

  constraint ir_intervention_meme_entreprise
    foreign key (intervention_id, entreprise_id) references public.intervention (id, entreprise_id) on delete restrict,
  constraint ir_auteur_meme_entreprise
    foreign key (ajoutee_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint ir_modificateur_meme_entreprise
    foreign key (modifiee_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  -- V1 : une seule référence par intervention. Retirer cette contrainte suffira pour en accepter plusieurs.
  constraint ir_une_reference_par_intervention unique (intervention_id)
);

comment on table public.intervention_reference is
  'Référence externe d''une intervention (N° de message, N° d''OS…). Non unique : plusieurs interventions peuvent la partager.';

-- Recherche par référence (égalité et « commence par ») dans une entreprise.
create index ir_reference_idx on public.intervention_reference (entreprise_id, reference_normalisee text_pattern_ops);

-- ---------------------------------------------------------------------------
-- Avant écriture : auteur et date posés par la base, référence figée une fois « Facturée ».
-- « security definer » : le contrôle voit l'intervention quels que soient les droits de lecture.
-- ---------------------------------------------------------------------------
create function public.reference_avant_ecriture()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne public.intervention_reference;
begin
  ligne := case when tg_op = 'DELETE' then old else new end;

  if exists (
    select 1 from public.intervention i
    where i.id = ligne.intervention_id and i.statut = 'facturee'
  ) then
    raise exception 'La référence d''une intervention « Facturée » ne se modifie plus'
      using errcode = 'restrict_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.intervention_id is distinct from old.intervention_id or new.entreprise_id is distinct from old.entreprise_id then
      raise exception 'Une référence ne change pas d''intervention : la retirer, puis l''ajouter sur l''autre'
        using errcode = 'restrict_violation';
    end if;
    new.ajoutee_par_id := old.ajoutee_par_id;
    new.ajoutee_le := old.ajoutee_le;
  else
    new.ajoutee_par_id := coalesce(auth.uid(), new.ajoutee_par_id);
    new.ajoutee_le := now();
  end if;
  new.modifiee_par_id := coalesce(auth.uid(), new.modifiee_par_id);
  new.modifiee_le := now();
  return new;
end
$$;

create trigger intervention_reference_avant_ecriture
  before insert or update or delete on public.intervention_reference
  for each row execute function public.reference_avant_ecriture();

-- ---------------------------------------------------------------------------
-- Après écriture : une ligne au journal de l'intervention (ajout seul, règle absolue n° 4).
-- ---------------------------------------------------------------------------
create function public.reference_au_journal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne public.intervention_reference;
  libelle text;
  texte text;
begin
  ligne := case when tg_op = 'DELETE' then old else new end;
  select e.libelle_reference_externe into libelle from public.entreprise e where e.id = ligne.entreprise_id;

  if tg_op = 'INSERT' then
    texte := libelle || ' ajoutée : « ' || new.reference || ' »';
  elsif tg_op = 'DELETE' then
    texte := libelle || ' retirée (était « ' || old.reference || ' »)';
  elsif new.reference is distinct from old.reference then
    texte := libelle || ' modifiée : « ' || old.reference || ' » → « ' || new.reference || ' »';
  else
    return null;
  end if;

  insert into public.journal (entreprise_id, intervention_id, auteur_id, texte)
  values (ligne.entreprise_id, ligne.intervention_id, auth.uid(), texte);
  return null;
end
$$;

create trigger intervention_reference_journal
  after insert or update or delete on public.intervention_reference
  for each row execute function public.reference_au_journal();

revoke execute on function public.reference_avant_ecriture(), public.reference_au_journal() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Qui écrit quoi.
-- ---------------------------------------------------------------------------

-- Rôle de l'utilisateur connecté (null si pas connecté, sans fiche ou désactivé).
create function public.role_courant()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.utilisateur u where u.id = auth.uid() and u.actif
$$;

-- Les agences où l'utilisateur connecté travaille sur les interventions :
-- technicien et chef d'agence, la leur ; administrateur, toutes. Gestionnaire : aucune.
create function public.agences_terrain()
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
         or (u.role in ('technicien', 'chef_agence') and a.id = u.agence_id))
$$;

revoke execute on function public.role_courant(), public.agences_terrain() from public, anon;
grant execute on function public.role_courant(), public.agences_terrain() to authenticated;

alter table public.intervention_reference enable row level security;
revoke all on public.intervention_reference from anon, authenticated;
grant select on public.intervention_reference to authenticated;
grant insert (id, entreprise_id, intervention_id, reference) on public.intervention_reference to authenticated;
grant update (reference) on public.intervention_reference to authenticated;
grant delete on public.intervention_reference to authenticated;

-- Lecture : comme l'intervention (son agence, ou toutes pour gestionnaire et administrateur).
create policy intervention_reference_lecture on public.intervention_reference
  for select to authenticated
  using (intervention_id in (select i.id from public.intervention i));

create policy intervention_reference_ajout on public.intervention_reference
  for insert to authenticated
  with check (
    intervention_id in (select i.id from public.intervention i where i.agence_id in (select public.agences_terrain()))
  );

create policy intervention_reference_modification on public.intervention_reference
  for update to authenticated
  using (intervention_id in (select i.id from public.intervention i where i.agence_id in (select public.agences_terrain())))
  with check (intervention_id in (select i.id from public.intervention i where i.agence_id in (select public.agences_terrain())));

create policy intervention_reference_retrait on public.intervention_reference
  for delete to authenticated
  using (intervention_id in (select i.id from public.intervention i where i.agence_id in (select public.agences_terrain())));

-- Le libellé : seul l'administrateur le change, et seulement pour son entreprise.
grant update (libelle_reference_externe) on public.entreprise to authenticated;

create policy entreprise_libelle_reference on public.entreprise
  for update to authenticated
  using (id = (select public.entreprise_courante()) and (select public.role_courant()) = 'administrateur')
  with check (id = (select public.entreprise_courante()) and (select public.role_courant()) = 'administrateur');
