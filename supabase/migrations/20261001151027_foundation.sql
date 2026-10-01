-- P0 foundation only. User tables, RLS and auth triggers belong to P1.
-- No service data, synthetic users or privileged callable RPCs are created.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;

-- Every future app table/function must receive explicit grants in its migration.
-- PUBLIC function EXECUTE is a global PostgreSQL default; a schema-scoped
-- REVOKE alone cannot remove that global grant.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

create type public.reading_status as enum ('reading', 'completed', 'dropped', 'planned');
create type public.visibility as enum ('public', 'private');
create type public.tier_visibility as enum ('public', 'unlisted', 'private');
create type public.canonical_tier as enum ('S', 'A', 'B', 'C', 'D', 'F');
create type public.serial_status as enum ('ongoing', 'completed', 'hiatus', 'unknown');
create type public.age_rating as enum ('all', '12', '15', '19', 'unknown');
create type public.catalogue_status as enum ('draft', 'published', 'hidden', 'merged');
create type public.publication_status as enum ('draft', 'published');
create type public.moderation_status as enum ('visible', 'hidden');
create type public.access_status as enum ('pending', 'active', 'suspended', 'deleting');
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed');
