begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

select has_schema('toon_private', 'Internal schema exists');
select ok(not has_schema_privilege('anon', 'toon_private', 'usage'), 'Anonymous role cannot access private schema');
select ok(not has_schema_privilege('authenticated', 'toon_private', 'usage'), 'Authenticated role cannot access private schema');
select enum_has_labels('public', 'toon_canonical_tier', array['S','A','B','C','D','F'], 'Canonical tiers match domain contract');
select enum_has_labels('public', 'toon_reading_status', array['reading','completed','dropped','planned'], 'Reading states match domain contract');
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and left(c.relname,5) = 'toon_' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0::bigint,
  'Every public app table has RLS enabled (future phase regression guard)'
);

select * from finish();
rollback;
