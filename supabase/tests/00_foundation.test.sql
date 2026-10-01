begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_schema('private', 'Internal schema exists');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'Anonymous role cannot access private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'Authenticated role cannot access private schema');
select ok(not has_schema_privilege('anon', 'public', 'create'), 'Anonymous role cannot create API objects');
select ok(not has_schema_privilege('authenticated', 'public', 'create'), 'Authenticated role cannot create API objects');
select enum_has_labels('public', 'canonical_tier', array['S','A','B','C','D','F'], 'Canonical tiers match domain contract');
select enum_has_labels('public', 'reading_status', array['reading','completed','dropped','planned'], 'Reading states match domain contract');
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0::bigint,
  'Every public app table has RLS enabled (future phase regression guard)'
);

select * from finish();
rollback;
