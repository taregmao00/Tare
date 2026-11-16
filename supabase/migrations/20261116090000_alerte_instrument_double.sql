-- Phase 2, bloc 1, séance 4 : alerte « instrument en double possible » (CLAUDE.md §6.9 et §6.10).
--
-- Quand un instrument est créé (à la main, par import CSV, plus tard depuis une intervention)
-- avec un n° de série déjà porté par un autre instrument de la même entreprise, la base :
--   * crée quand même l'instrument (jamais de refus, jamais de fusion automatique) ;
--   * crée une alerte pour le chef d'agence, visible plus tard dans « À traiter ».
-- Même chose si le n° de série d'une fiche est corrigé et tombe sur un numéro déjà porté.
--
-- C'est la base qui le fait, pas l'appli : l'alerte existe quel que soit le chemin de création,
-- et elle voit aussi les instruments des agences que la personne connectée ne voit pas.
-- Les majuscules et les espaces autour ne comptent pas (« bx-40118 » = « BX-40118 »).

create index instrument_numero_serie_compare_idx
  on public.instrument (entreprise_id, lower(btrim(numero_serie)));

create function public.instrument_signaler_double()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  agence uuid;
  meme_agence text;
  autres_agences integer;
  detail text;
begin
  -- Une modification de fiche qui ne change pas le n° de série ne signale rien de nouveau.
  if tg_op = 'UPDATE' and lower(btrim(new.numero_serie)) = lower(btrim(old.numero_serie)) then
    return null;
  end if;

  select c.agence_id into agence
  from public.site s
  join public.client c on c.id = s.client_id
  where s.id = new.site_id;

  -- Les numéros des instruments d'une AUTRE agence ne sont pas écrits dans l'alerte :
  -- le chef d'agence ne voit que son agence (§8). Il saura seulement qu'il en existe.
  select
    string_agg(coalesce(i.numero, i.reference_provisoire), ', ' order by coalesce(i.numero, i.reference_provisoire))
      filter (where c.agence_id = agence),
    count(*) filter (where c.agence_id <> agence)
  into meme_agence, autres_agences
  from public.instrument i
  join public.site s on s.id = i.site_id
  join public.client c on c.id = s.client_id
  where i.entreprise_id = new.entreprise_id
    and i.id <> new.id
    -- À la création, on ne regarde que les instruments plus anciens (numéro plus petit) : deux
    -- instruments créés dans le même envoi avec le même n° de série ne donnent qu'UNE alerte.
    and (tg_op = 'UPDATE'
         or substring(i.numero from 5)::integer < substring(new.numero from 5)::integer)
    and lower(btrim(i.numero_serie)) = lower(btrim(new.numero_serie));

  if meme_agence is null and autres_agences = 0 then
    return null;
  end if;

  detail := 'Le n° de série « ' || btrim(new.numero_serie) || ' » de '
    || coalesce(new.numero, new.reference_provisoire) || ' est déjà porté par ';
  if meme_agence is not null then
    detail := detail || meme_agence;
    if autres_agences > 0 then
      detail := detail || ' et par ' || autres_agences || ' instrument(s) d''une autre agence';
    end if;
  else
    detail := detail || autres_agences || ' instrument(s) d''une autre agence';
  end if;
  detail := detail || '. Vérifiez s''il s''agit du même instrument.';

  insert into public.alerte (entreprise_id, agence_id, type, instrument_id, detail)
  values (new.entreprise_id, agence, 'instrument_double', new.id, detail);
  return null;
end
$$;

revoke execute on function public.instrument_signaler_double() from public, anon, authenticated;

create trigger instrument_double_possible
  after insert or update of numero_serie on public.instrument
  for each row execute function public.instrument_signaler_double();
