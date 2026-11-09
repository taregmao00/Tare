-- Séance 6 : toutes les tables métier du §5 (clients → bons → alertes).
-- Règles générales :
--   * identifiants UUID, pouvant être générés par le téléphone (hors ligne) ;
--   * chaque table porte entreprise_id ; les liens entre tables vérifient que les deux lignes
--     sont de la même entreprise (clé « (id, entreprise_id) ») : aucun mélange possible ;
--   * montants en centimes, distances en km entiers, heures en UTC ;
--   * une échéance de vignette est un mois : stockée comme le 1er jour de ce mois ;
--   * RLS activée sans aucune règle de lecture : rien n'est lisible depuis l'appli tant que
--     le cloisonnement par agence n'est pas écrit (séance 7).

-- Les tables de la séance 5 servent de parents : on autorise les liens (id, entreprise_id).
alter table public.utilisateur add constraint utilisateur_id_entreprise_unique unique (id, entreprise_id);

-- ---------------------------------------------------------------------------
-- Clients et sites
-- ---------------------------------------------------------------------------
create table public.client (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  agence_id uuid not null,
  nom text not null check (length(btrim(nom)) > 0),
  critique boolean not null default false,
  note text,
  cree_le timestamptz not null default now(),

  constraint client_agence_meme_entreprise
    foreign key (agence_id, entreprise_id) references public.agence (id, entreprise_id) on delete restrict,
  constraint client_id_entreprise_unique unique (id, entreprise_id),
  constraint client_id_agence_unique unique (id, agence_id)
);
create index client_entreprise_idx on public.client (entreprise_id);
create index client_agence_idx on public.client (agence_id);

create table public.site (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  client_id uuid not null,
  nom text not null check (length(btrim(nom)) > 0),
  adresse text,
  contact_nom text,
  contact_fonction text,
  contact_telephone text,
  contact_email text check (contact_email is null or contact_email like '%_@_%'),
  distance_km integer not null check (distance_km >= 0),
  cree_le timestamptz not null default now(),

  constraint site_client_meme_entreprise
    foreign key (client_id, entreprise_id) references public.client (id, entreprise_id) on delete restrict,
  constraint site_id_entreprise_unique unique (id, entreprise_id),
  constraint site_id_client_unique unique (id, client_id)
);
create index site_client_idx on public.site (client_id);

-- ---------------------------------------------------------------------------
-- Instruments
-- ---------------------------------------------------------------------------
create table public.instrument (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  site_id uuid not null,
  numero text check (numero ~ '^INS-[0-9]{4,}$'),          -- attribué par le serveur
  reference_provisoire text,                                -- créé hors ligne, avant le numéro
  type text not null check (length(btrim(type)) > 0),
  marque text,
  modele text,
  numero_serie text,
  portee_max text,                                          -- ex. « 60 kg », « 3 t »
  echelon text,                                             -- ex. « 20 g »
  millesime integer check (millesime between 1900 and 2100),
  emplacement text,
  statut_metrologie text not null default 'a_verifier'
    check (statut_metrologie in ('verte', 'a_verifier', 'rouge')),
  echeance_verification date check (extract(day from echeance_verification) = 1),
  motif_statut text,
  cree_par_id uuid,
  cree_le timestamptz not null default now(),

  constraint instrument_site_meme_entreprise
    foreign key (site_id, entreprise_id) references public.site (id, entreprise_id) on delete restrict,
  constraint instrument_createur_meme_entreprise
    foreign key (cree_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint instrument_identifie check (numero is not null or reference_provisoire is not null),
  constraint instrument_verte_avec_echeance
    check (statut_metrologie <> 'verte' or echeance_verification is not null),
  constraint instrument_numero_unique unique (entreprise_id, numero),
  constraint instrument_reference_unique unique (entreprise_id, reference_provisoire),
  constraint instrument_id_entreprise_unique unique (id, entreprise_id),
  constraint instrument_id_site_unique unique (id, site_id)
);
create index instrument_site_idx on public.instrument (site_id);
-- Pas d'unicité sur le n° de série : un double crée une alerte, jamais un refus (§6.9).
create index instrument_numero_serie_idx on public.instrument (entreprise_id, numero_serie);
create index instrument_echeance_idx on public.instrument (entreprise_id, echeance_verification);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.article (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  code text not null check (length(btrim(code)) > 0),
  designation text not null check (length(btrim(designation)) > 0),
  prix_unitaire_ht_centimes integer not null check (prix_unitaire_ht_centimes >= 0),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),

  constraint article_code_unique unique (entreprise_id, code)
);

-- ---------------------------------------------------------------------------
-- Interventions
-- ---------------------------------------------------------------------------
create table public.intervention (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  agence_id uuid not null,
  numero text not null check (numero ~ '^INT-[0-9]{4,}$'),
  type text not null check (type in ('reparation', 'verification', 'installation')),
  client_id uuid not null,
  site_id uuid not null,
  priorite text not null default 'normale' check (priorite in ('normale', 'urgente')),
  statut text not null default 'a_faire'
    check (statut in ('a_faire', 'prise', 'en_cours', 'terminee', 'facturee')),
  titulaire_id uuid,
  recue_le timestamptz not null default now(),
  duree_estimee_minutes integer check (duree_estimee_minutes > 0),
  nombre_personnes_prevu integer not null default 1 check (nombre_personnes_prevu >= 1),
  description text,
  cree_par_id uuid,                     -- null : créée automatiquement par le serveur
  cree_depuis_bon_id uuid,              -- bon dont la signature a créé cette intervention (§6.8)
  facturee_le timestamptz,
  facturee_par_id uuid,
  cree_le timestamptz not null default now(),

  -- Le client est bien de cette agence, le site bien de ce client.
  constraint intervention_client_meme_agence
    foreign key (client_id, agence_id) references public.client (id, agence_id) on delete restrict,
  constraint intervention_agence_meme_entreprise
    foreign key (agence_id, entreprise_id) references public.agence (id, entreprise_id) on delete restrict,
  constraint intervention_site_du_client
    foreign key (site_id, client_id) references public.site (id, client_id) on delete restrict,
  constraint intervention_titulaire_meme_entreprise
    foreign key (titulaire_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint intervention_createur_meme_entreprise
    foreign key (cree_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint intervention_factureur_meme_entreprise
    foreign key (facturee_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  -- Hors « À faire », il y a toujours un titulaire ; « À faire » n'en a pas.
  constraint intervention_titulaire_selon_statut check ((statut = 'a_faire') = (titulaire_id is null)),
  constraint intervention_facturee_tracee
    check ((statut = 'facturee') = (facturee_le is not null and facturee_par_id is not null)),
  constraint intervention_numero_unique unique (entreprise_id, numero),
  constraint intervention_id_entreprise_unique unique (id, entreprise_id),
  constraint intervention_id_site_unique unique (id, site_id)
);
create index intervention_agence_statut_idx on public.intervention (agence_id, statut);
create index intervention_site_idx on public.intervention (site_id);
create index intervention_titulaire_idx on public.intervention (titulaire_id);

-- Une intervention concerne un ou plusieurs instruments du même site.
create table public.intervention_instrument (
  intervention_id uuid not null,
  instrument_id uuid not null,
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  site_id uuid not null,
  ajoute_par_id uuid,
  ajoute_le timestamptz not null default now(),

  primary key (intervention_id, instrument_id),
  constraint ii_intervention_du_site
    foreign key (intervention_id, site_id) references public.intervention (id, site_id) on delete restrict,
  constraint ii_instrument_du_site
    foreign key (instrument_id, site_id) references public.instrument (id, site_id) on delete restrict,
  constraint ii_intervention_meme_entreprise
    foreign key (intervention_id, entreprise_id) references public.intervention (id, entreprise_id) on delete restrict,
  constraint ii_auteur_meme_entreprise
    foreign key (ajoute_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict
);
create index ii_instrument_idx on public.intervention_instrument (instrument_id);

-- ---------------------------------------------------------------------------
-- Chrono : segments (le chrono appartient à l'intervention)
-- ---------------------------------------------------------------------------
create table public.segment_chrono (
  id uuid primary key,                  -- généré par le téléphone
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  intervention_id uuid not null,
  demarre_par_id uuid not null,
  appareil text not null check (length(btrim(appareil)) > 0),
  debut timestamptz not null,
  fin timestamptz,                      -- null : chrono en cours
  -- Heures annoncées par le téléphone, gardées seulement si le serveur les a ramenées (§6.9).
  debut_annonce timestamptz,
  fin_annonce timestamptz,
  recu_serveur_le timestamptz not null default now(),

  constraint segment_intervention_meme_entreprise
    foreign key (intervention_id, entreprise_id) references public.intervention (id, entreprise_id) on delete restrict,
  constraint segment_auteur_meme_entreprise
    foreign key (demarre_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint segment_fin_apres_debut check (fin is null or fin >= debut)
);
create index segment_intervention_idx on public.segment_chrono (intervention_id);
-- Retrouver vite « le chrono que j'ai démarré et qui tourne » (§6.2).
create index segment_en_cours_idx on public.segment_chrono (demarre_par_id) where fin is null;

-- ---------------------------------------------------------------------------
-- Journal d'intervention : ajout seul (règle absolue n° 4)
-- ---------------------------------------------------------------------------
create table public.journal (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  intervention_id uuid not null,
  horodatage timestamptz not null default now(),
  auteur_id uuid,                       -- null : écrit par le serveur (règle automatique)
  texte text not null check (length(btrim(texte)) > 0),

  constraint journal_intervention_meme_entreprise
    foreign key (intervention_id, entreprise_id) references public.intervention (id, entreprise_id) on delete restrict,
  constraint journal_auteur_meme_entreprise
    foreign key (auteur_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict
);
create index journal_intervention_idx on public.journal (intervention_id, horodatage);

-- ---------------------------------------------------------------------------
-- Bons d'intervention (une ligne n'existe qu'une fois le bon signé)
-- ---------------------------------------------------------------------------
create table public.bon (
  id uuid primary key,                  -- généré par le téléphone
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  intervention_id uuid not null,
  numero text check (numero ~ '^[A-Z0-9]{1,10}-[0-9]{4}-[0-9]{4,}$'),  -- BI-AAAA-NNNN, attribué par le serveur
  reference_provisoire text not null,   -- PROV-<appareil>-<date-heure>
  statut text not null default 'valide' check (statut in ('valide', 'annule_remplace', 'refuse')),
  bon_remplace_id uuid,
  motif_rectification text,
  signe_le timestamptz not null,
  titulaire_id uuid not null,
  travaux_realises text not null check (length(btrim(travaux_realises)) > 0),

  -- Main-d'œuvre
  minutes_chrono integer not null check (minutes_chrono >= 0),
  minutes_corrigees integer check (minutes_corrigees >= 0),
  motif_correction text,
  corrige_par_id uuid,
  nombre_personnes integer not null check (nombre_personnes >= 1),
  minutes_facturees_par_personne integer not null check (minutes_facturees_par_personne >= 30),
  taux_horaire_applique_centimes integer not null check (taux_horaire_applique_centimes >= 0),

  -- Déplacement
  distance_km integer not null check (distance_km >= 0),
  forfait_deplacement_applique_centimes integer not null check (forfait_deplacement_applique_centimes >= 0),
  libelle_zone text not null,
  nombre_passages integer not null check (nombre_passages >= 1),
  nombre_passages_corrige integer check (nombre_passages_corrige >= 1),
  motif_passages text,
  nombre_forfaits_factures integer not null check (nombre_forfaits_factures >= 1),

  -- Signature et envoi
  nom_signataire text not null check (length(btrim(nom_signataire)) > 0),
  signature text not null check (signature like 'data:image/png;base64,%'),
  email_envoi text check (email_envoi is null or email_envoi like '%_@_%'),
  envoye boolean not null default false,
  envoye_le timestamptz,
  total_ht_centimes integer not null check (total_ht_centimes >= 0),
  recu_serveur_le timestamptz not null default now(),
  ecart_horloge_minutes integer,

  constraint bon_intervention_meme_entreprise
    foreign key (intervention_id, entreprise_id) references public.intervention (id, entreprise_id) on delete restrict,
  constraint bon_titulaire_meme_entreprise
    foreign key (titulaire_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint bon_correcteur_meme_entreprise
    foreign key (corrige_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint bon_remplace_meme_entreprise
    foreign key (bon_remplace_id, entreprise_id) references public.bon (id, entreprise_id) on delete restrict,
  constraint bon_id_entreprise_unique unique (id, entreprise_id),
  constraint bon_numero_unique unique (entreprise_id, numero),
  constraint bon_reference_unique unique (entreprise_id, reference_provisoire),
  -- Correction de temps : motif et auteur obligatoires (§6.2).
  constraint bon_correction_temps_tracee check (
    (minutes_corrigees is null and motif_correction is null and corrige_par_id is null)
    or (minutes_corrigees is not null and coalesce(btrim(motif_correction), '') <> '' and corrige_par_id is not null)
  ),
  constraint bon_correction_passages_motivee check (
    (nombre_passages_corrige is null and motif_passages is null)
    or (nombre_passages_corrige is not null and coalesce(btrim(motif_passages), '') <> '')
  ),
  constraint bon_forfaits_max_passages
    check (nombre_forfaits_factures <= coalesce(nombre_passages_corrige, nombre_passages)),
  -- Un rectificatif a toujours un motif (§6.7).
  constraint bon_rectificatif_motive
    check (bon_remplace_id is null or coalesce(btrim(motif_rectification), '') <> ''),
  -- Un rectificatif refusé n'a jamais de numéro (la séquence reste sans trou).
  constraint bon_refuse_sans_numero check (statut <> 'refuse' or (numero is null and bon_remplace_id is not null)),
  constraint bon_envoi_date check (envoye = (envoye_le is not null))
);
create index bon_intervention_idx on public.bon (intervention_id);
create index bon_signe_le_idx on public.bon (entreprise_id, signe_le);
-- Un bon n'est remplacé qu'une fois (les tentatives refusées ne comptent pas).
create unique index bon_remplace_une_fois on public.bon (bon_remplace_id)
  where bon_remplace_id is not null and statut <> 'refuse';

alter table public.intervention add constraint intervention_bon_origine_meme_entreprise
  foreign key (cree_depuis_bon_id, entreprise_id) references public.bon (id, entreprise_id) on delete restrict;

-- Une section par instrument de l'intervention.
create table public.bon_instrument (
  bon_id uuid not null,
  instrument_id uuid not null,
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  chaine_mesure_touchee boolean,
  resultat_verification text check (resultat_verification in ('conforme', 'non_conforme')),
  nouvelle_echeance date check (extract(day from nouvelle_echeance) = 1),
  observations text,

  primary key (bon_id, instrument_id),
  constraint bi_bon_meme_entreprise
    foreign key (bon_id, entreprise_id) references public.bon (id, entreprise_id) on delete restrict,
  constraint bi_instrument_meme_entreprise
    foreign key (instrument_id, entreprise_id) references public.instrument (id, entreprise_id) on delete restrict,
  -- Conforme → nouvelle échéance ; non conforme → pas d'échéance.
  constraint bi_echeance_selon_resultat check (
    (resultat_verification is null and nouvelle_echeance is null)
    or (resultat_verification = 'conforme' and nouvelle_echeance is not null)
    or (resultat_verification = 'non_conforme' and nouvelle_echeance is null)
  )
);
create index bi_instrument_idx on public.bon_instrument (instrument_id);

-- Pièces catalogue et petit matériel (prix copié à la signature).
create table public.ligne_bon (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  bon_id uuid not null,
  ordre integer not null default 0,
  nature text not null check (nature in ('catalogue', 'petit_materiel')),
  code_article text,
  designation text not null check (length(btrim(designation)) > 0),
  quantite numeric(12, 3) not null check (quantite > 0),
  prix_unitaire_ht_centimes integer not null check (prix_unitaire_ht_centimes >= 0),

  constraint ligne_bon_meme_entreprise
    foreign key (bon_id, entreprise_id) references public.bon (id, entreprise_id) on delete restrict,
  constraint ligne_catalogue_avec_code check (nature <> 'catalogue' or code_article is not null)
);
create index ligne_bon_idx on public.ligne_bon (bon_id, ordre);

-- ---------------------------------------------------------------------------
-- Photos (fichiers dans Supabase Storage ; ici, seulement leur chemin)
-- ---------------------------------------------------------------------------
create table public.photo (
  id uuid primary key,                  -- généré par le téléphone
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  intervention_id uuid not null,
  bon_id uuid,
  chemin text not null unique,
  prise_par_id uuid,
  prise_le timestamptz not null,
  recu_serveur_le timestamptz not null default now(),

  constraint photo_intervention_meme_entreprise
    foreign key (intervention_id, entreprise_id) references public.intervention (id, entreprise_id) on delete restrict,
  constraint photo_bon_meme_entreprise
    foreign key (bon_id, entreprise_id) references public.bon (id, entreprise_id) on delete restrict,
  constraint photo_auteur_meme_entreprise
    foreign key (prise_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict
);
create index photo_intervention_idx on public.photo (intervention_id);

-- ---------------------------------------------------------------------------
-- Alertes (§6.10)
-- ---------------------------------------------------------------------------
create table public.alerte (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprise (id) on delete restrict,
  agence_id uuid not null,
  type text not null check (type in (
    'ecart_horloge', 'segment_ajuste', 'rectificatif_refuse', 'prise_en_double', 'instrument_double'
  )),
  intervention_id uuid,
  bon_id uuid,
  instrument_id uuid,
  detail text not null,
  cree_le timestamptz not null default now(),
  traitee_par_id uuid,
  traitee_le timestamptz,

  constraint alerte_agence_meme_entreprise
    foreign key (agence_id, entreprise_id) references public.agence (id, entreprise_id) on delete restrict,
  constraint alerte_intervention_meme_entreprise
    foreign key (intervention_id, entreprise_id) references public.intervention (id, entreprise_id) on delete restrict,
  constraint alerte_bon_meme_entreprise
    foreign key (bon_id, entreprise_id) references public.bon (id, entreprise_id) on delete restrict,
  constraint alerte_instrument_meme_entreprise
    foreign key (instrument_id, entreprise_id) references public.instrument (id, entreprise_id) on delete restrict,
  constraint alerte_traiteur_meme_entreprise
    foreign key (traitee_par_id, entreprise_id) references public.utilisateur (id, entreprise_id) on delete restrict,
  constraint alerte_liee check (num_nonnulls(intervention_id, bon_id, instrument_id) >= 1),
  constraint alerte_traitement_trace check ((traitee_par_id is null) = (traitee_le is null))
);
create index alerte_a_traiter_idx on public.alerte (entreprise_id, agence_id) where traitee_le is null;

-- ---------------------------------------------------------------------------
-- Verrous garantis par la base elle-même (valables même avec la clé de service)
-- ---------------------------------------------------------------------------

-- Refuse toute modification ou suppression (journal, contenu d'un bon signé).
create function public.refuser_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% interdit sur % : %', tg_op, tg_table_name, tg_argv[0]
    using errcode = 'restrict_violation';
end
$$;

create trigger journal_ajout_seul
  before update or delete on public.journal
  for each row execute function public.refuser_modification('le journal est en ajout seul');
create trigger journal_pas_de_vidage
  before truncate on public.journal
  for each statement execute function public.refuser_modification('le journal est en ajout seul');

create trigger bon_instrument_verrouille
  before update or delete on public.bon_instrument
  for each row execute function public.refuser_modification('un bon signé est verrouillé');
create trigger ligne_bon_verrouillee
  before update or delete on public.ligne_bon
  for each row execute function public.refuser_modification('un bon signé est verrouillé');
create trigger bon_pas_de_suppression
  before delete on public.bon
  for each row execute function public.refuser_modification('un bon signé est verrouillé');
create trigger bon_pas_de_vidage
  before truncate on public.bon
  for each statement execute function public.refuser_modification('un bon signé est verrouillé');
create trigger bon_instrument_pas_de_vidage
  before truncate on public.bon_instrument
  for each statement execute function public.refuser_modification('un bon signé est verrouillé');
create trigger ligne_bon_pas_de_vidage
  before truncate on public.ligne_bon
  for each statement execute function public.refuser_modification('un bon signé est verrouillé');

-- Un bon signé ne change plus, sauf ce que le serveur pose après coup :
-- son numéro définitif (une seule fois), « Annulé et remplacé », et l'envoi du PDF.
create function public.verrou_bon()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  modifiables constant text[] := array['numero', 'statut', 'envoye', 'envoye_le'];
begin
  if (to_jsonb(new) - modifiables) is distinct from (to_jsonb(old) - modifiables) then
    raise exception 'Un bon signé est verrouillé : seule la création d''un rectificatif permet une correction'
      using errcode = 'restrict_violation';
  end if;
  if old.numero is not null and new.numero is distinct from old.numero then
    raise exception 'Le numéro définitif d''un bon ne change jamais' using errcode = 'restrict_violation';
  end if;
  if new.statut is distinct from old.statut
     and not (old.statut = 'valide' and new.statut = 'annule_remplace') then
    raise exception 'Changement de statut de bon interdit : % → %', old.statut, new.statut
      using errcode = 'restrict_violation';
  end if;
  if old.envoye and not new.envoye then
    raise exception 'Un bon envoyé reste envoyé' using errcode = 'restrict_violation';
  end if;
  return new;
end
$$;

create trigger bon_verrouille
  before update on public.bon
  for each row execute function public.verrou_bon();

-- Retirer un instrument d'une intervention n'est possible qu'avant la signature du bon (§6.9).
create function public.verrou_retrait_instrument()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.bon b where b.intervention_id = old.intervention_id) then
    raise exception 'Instrument impossible à retirer : le bon de cette intervention est déjà signé'
      using errcode = 'restrict_violation';
  end if;
  return old;
end
$$;

create trigger intervention_instrument_retrait
  before delete on public.intervention_instrument
  for each row execute function public.verrou_retrait_instrument();

-- ---------------------------------------------------------------------------
-- Cloisonnement : RLS activée partout, aucune règle pour l'instant (séance 7).
-- ---------------------------------------------------------------------------
alter table public.client enable row level security;
alter table public.site enable row level security;
alter table public.instrument enable row level security;
alter table public.article enable row level security;
alter table public.intervention enable row level security;
alter table public.intervention_instrument enable row level security;
alter table public.segment_chrono enable row level security;
alter table public.journal enable row level security;
alter table public.bon enable row level security;
alter table public.bon_instrument enable row level security;
alter table public.ligne_bon enable row level security;
alter table public.photo enable row level security;
alter table public.alerte enable row level security;

revoke all on
  public.client, public.site, public.instrument, public.article, public.intervention,
  public.intervention_instrument, public.segment_chrono, public.journal, public.bon,
  public.bon_instrument, public.ligne_bon, public.photo, public.alerte
from anon, authenticated;

revoke execute on function public.refuser_modification(), public.verrou_bon(), public.verrou_retrait_instrument() from public, anon, authenticated;
