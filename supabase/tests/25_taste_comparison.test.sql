-- Local rollback fixtures WRITTEN ONLY. Never run against the shared project.
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
 select ('38000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'compare-'||n||'@example.test',now(),false from generate_series(1,3) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at,discovery_opt_in)
 select id,'compare_'||right(id::text,12)::integer,'[test] reader',now(),false from auth.users where id::text like '38000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '38000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status)
 select id,'active' from public.toon_profiles where id::text like '38000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '38000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('48000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '38000000-0000-4000-8000-%';
insert into public.toon_platforms(id,code,name,approved_hosts) values('68000000-0000-4000-8000-000000000001','compare_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status,is_test)
 select ('58000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'compare-'||n,'[test] comparison '||lpad(n::text,2,'0'),
  case when n=10 then '19'::public.toon_age_rating else 'all'::public.toon_age_rating end,
  case when n=9 then 'hidden'::public.toon_catalogue_status else 'published'::public.toon_catalogue_status end,n=11
 from generate_series(1,12) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select id,'68000000-0000-4000-8000-000000000001','https://example.test/'||slug,'all',now()
 from public.toon_works where id::text like '58000000-0000-4000-8000-%' and right(id::text,12)::integer<>12;
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select p.id,w.id,'completed','private' from public.toon_profiles p cross join public.toon_works w
 where p.id in ('38000000-0000-4000-8000-000000000001','38000000-0000-4000-8000-000000000002') and w.id::text like '58000000-0000-4000-8000-%';
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility)
 select l.user_id,l.work_id,
  case when right(l.work_id::text,12)::integer=7 then null when l.user_id='38000000-0000-4000-8000-000000000001' then 1 else 10 end,
  case when right(l.work_id::text,12)::integer=6 then null
   when l.user_id='38000000-0000-4000-8000-000000000001' then 'S'::public.toon_canonical_tier
   when right(l.work_id::text,12)::integer in (2,3,5) then 'A'::public.toon_canonical_tier
   when right(l.work_id::text,12)::integer=4 then 'B'::public.toon_canonical_tier
   when right(l.work_id::text,12)::integer=7 then null else 'S'::public.toon_canonical_tier end,
  case when l.user_id='38000000-0000-4000-8000-000000000001' or right(l.work_id::text,12)::integer in (6,8) then 'private'::public.toon_visibility else 'public'::public.toon_visibility end
 from public.toon_library_entries l where l.user_id in ('38000000-0000-4000-8000-000000000001','38000000-0000-4000-8000-000000000002')
  and l.work_id::text like '58000000-0000-4000-8000-%'
  -- A tier-only/rating-only pair, never an empty evaluation.
  and not (l.user_id='38000000-0000-4000-8000-000000000002' and right(l.work_id::text,12)::integer=7);
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,visibility)
 values('38000000-0000-4000-8000-000000000002','58000000-0000-4000-8000-000000000007',10,'public');

select ok(not has_function_privilege('anon','public.toon_compare_taste(text,text,integer)','EXECUTE'),'Anonymous comparisons denied');
select ok(not has_function_privilege('service_role','public.toon_compare_taste(text,text,integer)','EXECUTE'),'No service role entry point');
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000001","session_id":"48000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.comparison',public.toon_compare_taste('compare_2','all',1)::text,true);
select is((current_setting('test.comparison')::jsonb->>'commonCount')::int,5,'Private own + public peer, excluding mixed-only/hidden/adult/test/unlinked/private peer');
select is((current_setting('test.comparison')::jsonb->>'similarity')::int,80,'0,.2,.2,.4,.2 differences produce 80; tiers take precedence over opposed stars');
select is((current_setting('test.comparison')::jsonb->>'tierCount')::int,5,'One canonical signal per work');
select is((public.toon_compare_taste('compare_2','common_s',1)->>'commonSCount')::int,1,'Common S despite discovery opt-out');
select is(jsonb_array_length(public.toon_compare_taste('compare_2','different',1)->'items'),1,'0.4 boundary included');
select is(jsonb_array_length(public.toon_compare_taste('compare_2','all',2)->'items'),0,'Stable bounded empty page');
select ok(not current_setting('test.comparison')::jsonb ? 'peerTotal','No peer raw total');
select throws_ok($$select public.toon_compare_taste('compare_1','all',1)$$,'P0001','SELF_COMPARE','Self comparison refused');
select throws_ok($$select public.toon_compare_taste('compare_2','all',1001)$$,'P0001','VALIDATION_ERROR','Bounded page');
select throws_ok($$select public.toon_compare_taste('compare_2','private',1)$$,'P0001','VALIDATION_ERROR','No arbitrary section');
select is(public.toon_compare_taste('missing_user','all',1),null::jsonb,'Missing profile is unavailable');
reset role;
update public.toon_user_evaluations set visibility='private' where user_id='38000000-0000-4000-8000-000000000002' and work_id='58000000-0000-4000-8000-000000000005';
set local role authenticated;
select is(public.toon_compare_taste('compare_2','all',1)->'similarity','null'::jsonb,'Four comparable works have no score');
reset role;
update public.toon_user_evaluations set visibility='public' where user_id='38000000-0000-4000-8000-000000000002' and work_id in ('58000000-0000-4000-8000-000000000005','58000000-0000-4000-8000-000000000006');
set local role authenticated;
select set_config('test.comparison',public.toon_compare_taste('compare_2','all',1)::text,true);
select is((current_setting('test.comparison')::jsonb->>'commonCount')::int,6,'Publication takes effect on next request');
select is((current_setting('test.comparison')::jsonb->>'ratingCount')::int,1,'Star-only pair falls back to stars');
select is((current_setting('test.comparison')::jsonb->>'similarity')::int,67,'0.5 vs 5 star endpoints differ by 1, total mean yields rounded 67');
reset role;
update public.toon_user_evaluations set canonical_tier=case when user_id='38000000-0000-4000-8000-000000000001' then 'F'::public.toon_canonical_tier else 'S'::public.toon_canonical_tier end
 where user_id in ('38000000-0000-4000-8000-000000000001','38000000-0000-4000-8000-000000000002') and work_id::text like '58000000-0000-4000-8000-%' and right(work_id::text,12)::integer<=5;
update public.toon_user_evaluations set visibility='private' where user_id='38000000-0000-4000-8000-000000000002' and work_id='58000000-0000-4000-8000-000000000006';
set local role authenticated;
select is((public.toon_compare_taste('compare_2','all',1)->>'similarity')::int,0,'Five opposed tier endpoints produce real zero, not insufficient data');
reset role;
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 select ('58000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'compare-'||n,'[test] comparison '||lpad(n::text,2,'0'),'all','published' from generate_series(13,37) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select id,'68000000-0000-4000-8000-000000000001','https://example.test/'||slug,'all',now()
 from public.toon_works where id::text like '58000000-0000-4000-8000-%' and right(id::text,12)::integer>=13;
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select p.id,w.id,'completed','private' from public.toon_profiles p cross join public.toon_works w
 where p.id in ('38000000-0000-4000-8000-000000000001','38000000-0000-4000-8000-000000000002') and w.id::text like '58000000-0000-4000-8000-%' and right(w.id::text,12)::integer>=13;
insert into public.toon_user_evaluations(user_id,work_id,canonical_tier,visibility)
 select user_id,work_id,'S','public' from public.toon_library_entries where user_id in ('38000000-0000-4000-8000-000000000001','38000000-0000-4000-8000-000000000002')
 and work_id::text like '58000000-0000-4000-8000-%' and right(work_id::text,12)::integer>=13;
set local role authenticated;
select set_config('test.comparison_first',public.toon_compare_taste('compare_2','all',1)::text,true);
select set_config('test.comparison_next',public.toon_compare_taste('compare_2','all',2)::text,true);
select is(jsonb_array_length(current_setting('test.comparison_first')::jsonb->'items'),20,'First page is bounded to 20');
select is(jsonb_array_length(current_setting('test.comparison_next')::jsonb->'items'),10,'Second page contains remaining 10');
select ok((current_setting('test.comparison_first')::jsonb->>'hasNext')::boolean and not (current_setting('test.comparison_next')::jsonb->>'hasNext')::boolean,'Lookahead reflects selected count');
select is((select count(*)::int from jsonb_array_elements(current_setting('test.comparison_first')::jsonb->'items') a join jsonb_array_elements(current_setting('test.comparison_next')::jsonb->'items') b on a->'work'->>'id'=b->'work'->>'id'),0,'Stable pages do not overlap');
reset role;
insert into public.toon_blocks(blocker_id,blocked_id) values('38000000-0000-4000-8000-000000000002','38000000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.toon_compare_taste('compare_2','all',1),null::jsonb,'Reverse block hides summary and items');
reset role;
delete from public.toon_blocks where blocker_id='38000000-0000-4000-8000-000000000002' and blocked_id='38000000-0000-4000-8000-000000000001';
update toon_private.toon_user_access set status='suspended' where user_id='38000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.toon_compare_taste('compare_2','all',1),null::jsonb,'Suspended peer unavailable');
reset role;
update toon_private.toon_user_access set status='active' where user_id='38000000-0000-4000-8000-000000000002';
delete from toon_private.toon_consent_records where user_id='38000000-0000-4000-8000-000000000002' and policy_kind='terms';
set local role authenticated;
select is(public.toon_compare_taste('compare_2','all',1),null::jsonb,'Peer missing current consent unavailable');
reset role;
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000003","session_id":"48000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((public.toon_compare_taste('compare_1','all',1)->>'commonCount')::int,0,'A third viewer cannot reuse another viewer private comparisons');
reset role;
update toon_private.toon_user_access set status='suspended' where user_id='38000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.toon_compare_taste('compare_1','all',1)$$,'P0001','FORBIDDEN','Suspended viewer denied');
reset role;
delete from auth.sessions where id='48000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.toon_compare_taste('compare_1','all',1)$$,'P0001','AUTH_REQUIRED','Revoked session denied');
reset role;
select * from finish();
rollback;
