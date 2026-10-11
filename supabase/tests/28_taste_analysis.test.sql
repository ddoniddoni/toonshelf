-- Local rollback fixtures WRITTEN ONLY. Never execute on the shared project.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
grant usage on schema extensions to anon,authenticated;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'
 join pg_extension e on e.oid=d.refobjid where e.extname='pgtap'
 loop execute format('grant execute on function %s to anon,authenticated',f);end loop;
end;$$;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
 select ('45000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'taste-analysis-'||n||'@example.test',now(),false from generate_series(1,2) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'taste_analysis_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '45000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '45000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status) select id,'active' from public.toon_profiles where id::text like '45000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '45000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('46000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '45000000-0000-4000-8000-%';
insert into public.toon_platforms(id,code,name,approved_hosts,active)
 select ('47000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'taste_analysis_'||n,'[test] platform '||n,array['example.test'],n<>3 from generate_series(1,4) n;
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 select ('48000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'taste-analysis-'||n,'[test] work '||n,
 case when n=6 then '19'::public.toon_age_rating else 'all'::public.toon_age_rating end,
 case when n=5 then 'hidden'::public.toon_catalogue_status else 'published'::public.toon_catalogue_status end from generate_series(1,6) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select id,'47000000-0000-4000-8000-000000000001','https://example.test/'||slug,'all',now() from public.toon_works where id::text like '48000000-0000-4000-8000-%';
-- Duplicate links on one platform must count once; inactive/future links do not contribute.
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select '48000000-0000-4000-8000-000000000001',id,'https://example.test/extra-'||code,'all',case when code='taste_analysis_4' then now()+interval '1 day' else now() end
 from public.toon_platforms where id::text like '47000000-0000-4000-8000-%';
insert into public.toon_genres(id,slug,name)
 select ('49000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'taste-analysis-'||n,'[test] genre '||n from generate_series(1,2) n;
insert into public.toon_work_genres(work_id,genre_id) values
 ('48000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001'),
 ('48000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000002'),
 ('48000000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000001');
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select '45000000-0000-4000-8000-000000000001',id,
 (case right(id::text,12)::integer when 2 then 'reading' when 3 then 'dropped' when 4 then 'planned' else 'completed' end)::public.toon_reading_status,'private'
 from public.toon_works where id::text like '48000000-0000-4000-8000-%';
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility)
 select user_id,work_id,case when right(work_id::text,12)::integer=2 then 6 else 10 end,'S','private'
 from public.toon_library_entries where user_id='45000000-0000-4000-8000-000000000001' and status<>'planned';
select ok(not has_function_privilege('anon','public.toon_get_my_taste_analysis()','EXECUTE'),'Anonymous access denied');
select ok(not has_function_privilege('service_role','public.toon_get_my_taste_analysis()','EXECUTE'),'Service role entry denied');
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000001","session_id":"46000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.taste_analysis',public.toon_get_my_taste_analysis()::text,true);
select is((current_setting('test.taste_analysis')::jsonb->>'totalCount')::int,4,'Own private entries included, hidden/adult works excluded');
select is((current_setting('test.taste_analysis')::jsonb->>'readCount')::int,3,'Planned excluded, reading and dropped included');
select is(current_setting('test.taste_analysis')::jsonb->'ratings','{"6":1,"10":2}'::jsonb,'Ratings from eligible own nonplanned works only');
select is(current_setting('test.taste_analysis')::jsonb->'tiers','{"S":3}'::jsonb,'One canonical tier per work');
select is((select sum((x->>'weight')::numeric) from jsonb_array_elements(current_setting('test.taste_analysis')::jsonb->'genres') x),3::numeric,'Genre weights conserve read count');
select is((select (x->>'weight')::numeric from jsonb_array_elements(current_setting('test.taste_analysis')::jsonb->'genres') x where x->>'id'='49000000-0000-4000-8000-000000000001'),1.5::numeric,'Multi-genre split');
select is((select (x->>'weight')::numeric from jsonb_array_elements(current_setting('test.taste_analysis')::jsonb->'genres') x where x->>'id' is null),1::numeric,'No genre maps to unclassified');
select is(jsonb_array_length(current_setting('test.taste_analysis')::jsonb->'platforms'),2,'Inactive/future platforms excluded');
select is((select (x->>'weight')::numeric from jsonb_array_elements(current_setting('test.taste_analysis')::jsonb->'platforms') x where x->>'id'='47000000-0000-4000-8000-000000000001'),2.5::numeric,'Platform dedupe precedes fractional weights');
reset role;
update public.toon_genres set active=false where id='49000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select (x->>'weight')::numeric from jsonb_array_elements(public.toon_get_my_taste_analysis()->'genres') x where x->>'id'='49000000-0000-4000-8000-000000000001'),2::numeric,'Current category visibility recomputes allocation');
reset role;
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000002","session_id":"46000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((public.toon_get_my_taste_analysis()->>'totalCount')::int,0,'Another member never inherits private counts');
select is(public.toon_get_my_taste_analysis()->'genres','[]'::jsonb,'Empty library has no fabricated categories');
reset role;
update toon_private.toon_user_access set status='suspended' where user_id='45000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.toon_get_my_taste_analysis()$$,'P0001','FORBIDDEN','Suspended viewer denied');
reset role;
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000001","session_id":"46000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_get_my_taste_analysis()$$,'P0001','AUTH_REQUIRED','Invalid session denied');
reset role;
select * from finish();
rollback;
