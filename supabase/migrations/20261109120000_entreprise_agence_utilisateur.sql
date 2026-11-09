-- Séance 5 : tables entreprise, agence, utilisateur (CLAUDE.md §5) et premier cloisonnement.
-- Montants en centimes (entiers), distances en km entiers, heures en UTC (timestamptz).
-- Le cloisonnement par agence (technicien, chef d'agence) viendra à la séance 7.

-- ---------------------------------------------------------------------------
-- entreprise : une ligne par société cliente de Tare, avec ses réglages.
-- ---------------------------------------------------------------------------
create table public.entreprise (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(btrim(nom)) > 0),

  -- Réglages (valeurs par défaut = exemples du cahier des charges, modifiables)
  taux_horaire_centimes integer not null default 6500 check (taux_horaire_centimes >= 0),
  limite_zone1_km integer not null default 20 check (limite_zone1_km >= 0),
  limite_zone2_km integer not null default 50,
  montant_zone1_centimes integer not null default 5000 check (montant_zone1_centimes >= 0),
  montant_zone2_centimes integer not null default 8000 check (montant_zone2_centimes >= 0),
  montant_zone3_centimes integer not null default 12000 check (montant_zone3_centimes >= 0),
  forfait_consommables_centimes integer not null default 1500 check (forfait_consommables_centimes >= 0),
  prefixe_numerotation text not null default 'BI' check (prefixe_numerotation ~ '^[A-Z0-9]{1,10}$'),

  cree_le timestamptz not null default now(),

  constraint entreprise_zones_croissantes check (limite_zone1_km < limite_zone2_km)
);

comment on table public.entreprise is 'Société de pesage cliente de Tare, avec ses réglages (§5).';
comment on column public.entreprise.prefixe_numerotation is 'Préfixe des numéros de bon (BI → BI-AAAA-NNNN).';

-- ---------------------------------------------------------------------------
-- agence : une entreprise a une ou plusieurs agences.
-- ---------------------------------------------------------------------------
create table public.agence (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  nom text not null check (length(btrim(nom)) > 0),
  adresse text,
  cree_le timestamptz not null default now(),

  constraint agence_nom_unique unique (entreprise_id, nom),
  -- Permet aux autres tables de vérifier que l'agence est bien de la même entreprise.
  constraint agence_id_entreprise_unique unique (id, entreprise_id)
);

create index agence_entreprise_idx on public.agence (entreprise_id);

-- ---------------------------------------------------------------------------
-- utilisateur : fiche d'un compte de connexion (même identifiant que le compte Supabase Auth).
-- ---------------------------------------------------------------------------
create table public.utilisateur (
  id uuid primary key references auth.users (id) on delete restrict,
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  agence_id uuid,
  nom text not null check (length(btrim(nom)) > 0),
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role text not null check (role in ('technicien', 'chef_agence', 'gestionnaire', 'administrateur')),
  habilite_verifications boolean not null default false,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),

  constraint utilisateur_email_unique unique (email),
  -- L'agence doit appartenir à la même entreprise que l'utilisateur.
  constraint utilisateur_agence_meme_entreprise
    foreign key (agence_id, entreprise_id) references public.agence (id, entreprise_id) on delete restrict,
  -- Technicien et chef d'agence ont toujours une agence ; gestionnaire et administrateur peuvent ne pas en avoir.
  constraint utilisateur_agence_obligatoire
    check (agence_id is not null or role in ('gestionnaire', 'administrateur'))
);

create index utilisateur_entreprise_idx on public.utilisateur (entreprise_id);
create index utilisateur_agence_idx on public.utilisateur (agence_id);

-- ---------------------------------------------------------------------------
-- Cloisonnement (Row Level Security) : chacun ne lit que son entreprise.
-- Aucune écriture depuis l'appli pour l'instant (les comptes sont créés par le script
-- d'administration, séance 8, qui utilise la clé de service côté serveur uniquement).
-- ---------------------------------------------------------------------------

-- Entreprise de l'utilisateur connecté (null si pas connecté, sans fiche ou désactivé).
-- « security definer » : la fonction lit la table utilisateur sans repasser par la RLS,
-- sinon la règle de lecture d'utilisateur s'appellerait elle-même.
create function public.entreprise_courante()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.entreprise_id
  from public.utilisateur u
  where u.id = auth.uid() and u.actif
$$;

revoke execute on function public.entreprise_courante() from public, anon;
grant execute on function public.entreprise_courante() to authenticated;

alter table public.entreprise enable row level security;
alter table public.agence enable row level security;
alter table public.utilisateur enable row level security;

-- Les visiteurs non connectés (anon) n'ont aucun droit sur ces tables.
revoke all on public.entreprise, public.agence, public.utilisateur from anon;
revoke all on public.entreprise, public.agence, public.utilisateur from authenticated;
grant select on public.entreprise, public.agence, public.utilisateur to authenticated;

create policy entreprise_lecture on public.entreprise
  for select to authenticated
  using (id = public.entreprise_courante());

create policy agence_lecture on public.agence
  for select to authenticated
  using (entreprise_id = public.entreprise_courante());

create policy utilisateur_lecture on public.utilisateur
  for select to authenticated
  using (entreprise_id = public.entreprise_courante());
