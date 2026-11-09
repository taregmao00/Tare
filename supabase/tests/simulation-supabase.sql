-- Imite ce que Supabase fournit (schéma auth, rôles anon/authenticated) pour essayer les
-- migrations sur un Postgres local. Ne jamais exécuter sur un vrai projet Supabase.
drop database if exists tare_test;
create database tare_test;
\c tare_test
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
