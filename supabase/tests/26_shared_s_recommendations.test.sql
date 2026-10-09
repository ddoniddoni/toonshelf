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
 select ('39000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'shared-s-'||n||'@example.test',case when n=13 then null else now() end,false from generate_series(1,13) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at,discovery_opt_in)
 select id,'shared_s_'||right(id::text,12)::integer,'[test] reader',now(),false from auth.users where id::text like '39000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '39000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status)
 select id,case when right(id::text,12)::integer=11 then 'suspended'::public.toon_access_status else 'active'::public.toon_access_status end
 from public.toon_profiles where id::text like '39000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '39000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('49000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '39000000-0000-4000-8000-%';
insert into public.toon_platforms(id,code,name,approved_hosts) values('69000000-0000-4000-8000-000000000001','shared_s_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status,is_test)
 select ('59000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'shared-s-'||n,'[test] shared S '||n,
  case when n=9 then '19'::public.toon_age_rating else 'all'::public.toon_age_rating end,
  case when n=8 then 'hidden'::public.toon_catalogue_status else 'published'::public.toon_catalogue_status end,n=10
 from generate_series(1,11) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select id,'69000000-0000-4000-8000-000000000001','https://example.test/'||slug,'all',now()
 from public.toon_works where id::text like '59000000-0000-4000-8000-%' and right(id::text,12)::integer<>11;
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select p.id,w.id,'completed','private' from public.toon_profiles p cross join public.toon_works w
 where p.id::text like '39000000-0000-4000-8000-%' and w.id::text like '59000000-0000-4000-8000-%';
insert into public.toon_user_evaluations(user_id,work_id,canonical_tier,rating_steps,visibility)
 select user_id,work_id,
  case when w=7 then null when (w=2 and u between 4 and 10) or (w=3 and u between 6 and 10) or (w=5 and u between 3 and 10) then 'A'::public.toon_canonical_tier else 'S'::public.toon_canonical_tier end,
  10,case when w=6 or (w=1 and u=12) then 'private'::public.toon_visibility else 'public'::public.toon_visibility end
 from (select l.*,right(user_id::text,12)::integer u,right(work_id::text,12)::integer w from public.toon_library_entries l
  where user_id::text like '39000000-0000-4000-8000-%' and work_id::text like '59000000-0000-4000-8000-%') x
 where (w<>2 or u<=5 or u>=11) and (w<>4 or u<=4 or u>=11);

select ok(has_function_privilege('anon','public.toon_get_shared_s_recommendations(uuid)','EXECUTE'),'Public aggregate endpoint');
select ok(not has_function_privilege('service_role','public.toon_get_shared_s_recommendations(uuid)','EXECUTE'),'No privileged API entry point');
select set_config('request.jwt.claims','{}',true);
set local role anon;
select set_config('test.shared_s',public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')::text,true);
select is(jsonb_array_length(current_setting('test.shared_s')::jsonb->'items'),2,'Only candidates meeting n>=5 and s>=3, with public eligible works and evaluations');
select is(current_setting('test.shared_s')::jsonb#>>'{items,0,work,id}','59000000-0000-4000-8000-000000000003','5/20 outranks 3/15 despite lower raw S ratio');
select is((current_setting('test.shared_s')::jsonb#>>'{items,0,rankingScore}')::numeric,0.25::numeric,'Ranking score includes sample correction');
select is((current_setting('test.shared_s')::jsonb#>>'{items,1,sampleCount}')::int,5,'Suspended, unconfirmed and private source users do not inflate sample');
select is((current_setting('test.shared_s')::jsonb#>>'{items,1,sharedSCount}')::int,3,'Threshold includes exactly three public S readers');
select is((current_setting('test.shared_s')::jsonb#>>'{items,1,coSRatio}')::numeric,0.6::numeric,'Co-S ratio is 3/5');
select ok(not current_setting('test.shared_s')::jsonb ? 'cohortIds','No evaluator identities');
select is(public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000008'),null::jsonb,'Hidden source is inaccessible');
select throws_ok($$select public.toon_get_shared_s_recommendations(null)$$,'P0001','VALIDATION_ERROR','Null source rejected');
reset role;

-- Viewer-aware aggregates must be recomputed after either direction of blocking.
insert into public.toon_blocks(blocker_id,blocked_id) values('39000000-0000-4000-8000-000000000002','39000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000001","session_id":"49000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.shared_s',public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')::text,true);
select is(jsonb_array_length(current_setting('test.shared_s')::jsonb->'items'),1,'Reverse block removes the now sub-threshold candidate entirely');
select is((current_setting('test.shared_s')::jsonb#>>'{items,0,sampleCount}')::int,9,'Blocked reader also excluded from denominator');
select is((current_setting('test.shared_s')::jsonb#>>'{items,0,sharedSCount}')::int,4,'Blocked reader excluded from numerator');
reset role;
delete from public.toon_blocks where blocker_id='39000000-0000-4000-8000-000000000002' and blocked_id='39000000-0000-4000-8000-000000000001';
insert into public.toon_blocks(blocker_id,blocked_id) values('39000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(jsonb_array_length(public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')->'items'),1,'Forward block has the same boundary');
reset role;
delete from public.toon_blocks where blocker_id='39000000-0000-4000-8000-000000000001' and blocked_id='39000000-0000-4000-8000-000000000002';
update public.toon_user_evaluations set visibility='private' where work_id='59000000-0000-4000-8000-000000000002' and user_id='39000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(jsonb_array_length(public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')->'items'),1,'Even viewer-owned private evaluations are excluded');
reset role;
update public.toon_user_evaluations set visibility='private' where work_id='59000000-0000-4000-8000-000000000001' and user_id::text like '39000000-0000-4000-8000-%';
set local role authenticated;
select is(public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')->'items','[]'::jsonb,'Source disclosure withdrawal leaves a real empty result, no genre-based substitution');
reset role;
update public.toon_user_evaluations set visibility='public' where work_id='59000000-0000-4000-8000-000000000001'
 and user_id::text like '39000000-0000-4000-8000-%' and right(user_id::text,12)::integer<=10;
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 select ('59000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'shared-s-'||n,'[test] shared S '||n,'all','published' from generate_series(12,19) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select id,'69000000-0000-4000-8000-000000000001','https://example.test/'||slug,'all',now()
 from public.toon_works where id::text like '59000000-0000-4000-8000-%' and right(id::text,12)::integer>=12;
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select p.id,w.id,'completed','private' from public.toon_profiles p cross join public.toon_works w
 where p.id::text like '39000000-0000-4000-8000-%' and right(p.id::text,12)::integer<=5
 and w.id::text like '59000000-0000-4000-8000-%' and right(w.id::text,12)::integer>=12;
insert into public.toon_user_evaluations(user_id,work_id,canonical_tier,visibility)
 select user_id,work_id,case when right(user_id::text,12)::integer<=3 then 'S'::public.toon_canonical_tier else 'A'::public.toon_canonical_tier end,'public'
 from public.toon_library_entries where user_id::text like '39000000-0000-4000-8000-%'
 and work_id::text like '59000000-0000-4000-8000-%' and right(work_id::text,12)::integer>=12;
set local role authenticated;
select set_config('test.shared_s',public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')::text,true);
select is(jsonb_array_length(current_setting('test.shared_s')::jsonb->'items'),6,'At most six cards');
select is(current_setting('test.shared_s')::jsonb#>>'{items,1,work,id}','59000000-0000-4000-8000-000000000012','Equal scores and samples use stable work ID order');
select is(current_setting('test.shared_s')::jsonb#>>'{items,5,work,id}','59000000-0000-4000-8000-000000000016','Top six boundary is deterministic');
reset role;
update toon_private.toon_user_access set status='suspended' where user_id='39000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')$$,'P0001','FORBIDDEN','Restricted viewer cannot fall back to anonymous');
reset role;
delete from auth.sessions where id='49000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_get_shared_s_recommendations('59000000-0000-4000-8000-000000000001')$$,'P0001','AUTH_REQUIRED','Stale session denied');
reset role;
select * from finish();
rollback;
