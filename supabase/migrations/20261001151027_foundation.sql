-- Unapplied ToonShelf baseline. Inspect shared-project history before installation.
-- No global public-schema/default-privilege changes: other apps share this DB.
create schema toon_private;
revoke all on schema toon_private from public, anon, authenticated;

create type public.toon_reading_status as enum ('reading', 'completed', 'dropped', 'planned');
create type public.toon_visibility as enum ('public', 'private');
create type public.toon_tier_visibility as enum ('public', 'unlisted', 'private');
create type public.toon_canonical_tier as enum ('S', 'A', 'B', 'C', 'D', 'F');
create type public.toon_serial_status as enum ('ongoing', 'completed', 'hiatus', 'unknown');
create type public.toon_age_rating as enum ('all', '12', '15', '19', 'unknown');
create type public.toon_catalogue_status as enum ('draft', 'published', 'hidden', 'merged');
create type public.toon_publication_status as enum ('draft', 'published');
create type public.toon_moderation_status as enum ('visible', 'hidden');
create type public.toon_access_status as enum ('pending', 'active', 'suspended', 'deleting');
create type public.toon_user_role as enum ('user', 'moderator', 'admin');
create type public.toon_job_status as enum ('queued', 'running', 'succeeded', 'failed');
