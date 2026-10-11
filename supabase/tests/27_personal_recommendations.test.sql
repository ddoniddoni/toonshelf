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
 select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'personal-rec-'||n||'@example.test',now(),false from generate_series(1,4) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at,discovery_opt_in)
 select id,'personal_rec_'||right(id::text,12)::integer,'[test] reader',now(),true from auth.users where id::text like '40000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '40000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status) select id,'active' from public.toon_profiles where id::text like '40000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '40000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('41000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '40000000-0000-4000-8000-%';
insert into public.toon_platforms(id,code,name,approved_hosts) values('42000000-0000-4000-8000-000000000001','personal_rec_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status,is_test)
 select ('43000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'personal-rec-'||n,'[test] personal rec '||n,
  case when n=10 then '19'::public.toon_age_rating else 'all'::public.toon_age_rating end,
  case when n=11 then 'hidden'::public.toon_catalogue_status else 'published'::public.toon_catalogue_status end,n=12
 from generate_series(1,13) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select id,'42000000-0000-4000-8000-000000000001','https://example.test/'||slug,'all',now()
 from public.toon_works where id::text like '43000000-0000-4000-8000-%' and right(id::text,12)::integer<>13;
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select p.id,w.id,'completed','private' from public.toon_profiles p cross join public.toon_works w
 where p.id::text like '40000000-0000-4000-8000-%' and w.id::text like '43000000-0000-4000-8000-%'
 and (right(p.id::text,12)::integer>1 or right(w.id::text,12)::integer<=5);
insert into public.toon_user_evaluations(user_id,work_id,canonical_tier,rating_steps,visibility)
 select user_id,work_id,case when w=7 then 'F'::public.toon_canonical_tier when w=6 and u=3 then 'A'::public.toon_canonical_tier when w=6 and u=4 then 'B'::public.toon_canonical_tier else 'S'::public.toon_canonical_tier end,
  1,case when u=1 or w=9 then 'private'::public.toon_visibility else 'public'::public.toon_visibility end
 from (select l.*,right(user_id::text,12)::integer u,right(work_id::text,12)::integer w from public.toon_library_entries l
 where user_id::text like '40000000-0000-4000-8000-%') x where w<>8 or u<>4;
insert into public.toon_genres(id,slug,name,sort_order) values('44000000-0000-4000-8000-000000000001','personal-rec-genre','[test] genre',1000);
insert into public.toon_work_genres(work_id,genre_id) values('43000000-0000-4000-8000-000000000006','44000000-0000-4000-8000-000000000001');
update public.toon_user_settings set preferred_genre_ids=array['44000000-0000-4000-8000-000000000001'::uuid] where user_id='40000000-0000-4000-8000-000000000001';
select ok(not has_function_privilege('anon','public.toon_get_personal_recommendations()','EXECUTE'),'Anonymous RPC denied');
select ok(not has_function_privilege('service_role','public.toon_get_personal_recommendations()','EXECUTE'),'No privileged API entry');
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","session_id":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.personal_rec',public.toon_get_personal_recommendations()::text,true);
select is(current_setting('test.personal_rec')::jsonb->>'mode','collaborative','Own private evaluations can power own result');
select is(jsonb_array_length(current_setting('test.personal_rec')::jsonb->'items'),1,'Only available, unstored, public candidates with 3 neighbors and score >= .6');
select is((current_setting('test.personal_rec')::jsonb#>>'{items,0,score}')::numeric,0.8::numeric,'Tier takes precedence over conflicting rating');
select is((current_setting('test.personal_rec')::jsonb#>>'{items,0,sampleCount}')::int,3,'Exactly three neighbors');
select is((current_setting('test.personal_rec')::jsonb#>>'{items,0,minCommonCount}')::int,5,'Exactly five common works');
select ok(not (current_setting('test.personal_rec')::jsonb->'items'->0) ? 'userIds','No neighbor identities');
reset role;
-- Disclosure withdrawal must drop the sample, not keep cached evidence.
update public.toon_user_evaluations set visibility='private' where user_id='40000000-0000-4000-8000-000000000004' and work_id='43000000-0000-4000-8000-000000000006';
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'mode','genre','Subthreshold sample uses labeled genre fallback');
select ok(not (public.toon_get_personal_recommendations()->'items'->0) ? 'score','Genre fallback has no collaborative score');
reset role;
update public.toon_user_evaluations set visibility='public' where user_id='40000000-0000-4000-8000-000000000004' and work_id='43000000-0000-4000-8000-000000000006';
-- Cross-signal pairs without common tier or rating are excluded; with only 4 common works neighbor is excluded.
update public.toon_user_evaluations set canonical_tier=null,rating_steps=10 where user_id='40000000-0000-4000-8000-000000000004' and work_id='43000000-0000-4000-8000-000000000005';
update public.toon_user_evaluations set rating_steps=null where user_id='40000000-0000-4000-8000-000000000001' and work_id='43000000-0000-4000-8000-000000000005';
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'mode','genre','Four comparable works cannot qualify a neighbor');
reset role;
update public.toon_user_evaluations set canonical_tier='S' where user_id='40000000-0000-4000-8000-000000000004' and work_id='43000000-0000-4000-8000-000000000005';
update public.toon_profiles set discovery_opt_in=false where id='40000000-0000-4000-8000-000000000004';
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'mode','genre','Opt-out removes a neighbor');
reset role;
update public.toon_profiles set discovery_opt_in=true where id='40000000-0000-4000-8000-000000000004';
insert into public.toon_blocks(blocker_id,blocked_id) values('40000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'mode','genre','Reverse block removes a neighbor');
reset role;
delete from public.toon_blocks where blocker_id='40000000-0000-4000-8000-000000000004' and blocked_id='40000000-0000-4000-8000-000000000001';
insert into public.toon_blocks(blocker_id,blocked_id) values('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004');
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'mode','genre','Forward block removes a neighbor');
reset role;
delete from public.toon_blocks where blocker_id='40000000-0000-4000-8000-000000000001' and blocked_id='40000000-0000-4000-8000-000000000004';
update toon_private.toon_user_access set status='suspended' where user_id='40000000-0000-4000-8000-000000000004';
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'mode','genre','Suspended neighbor excluded');
reset role;
insert into public.toon_library_entries(user_id,work_id,status) values('40000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000006','planned');
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'mode','empty','Planned own work excluded from genre fallback too');
reset role;
delete from public.toon_user_evaluations where user_id='40000000-0000-4000-8000-000000000001' and work_id='43000000-0000-4000-8000-000000000005';
set local role authenticated;
select is(public.toon_get_personal_recommendations()->>'reason','insufficient_evaluations','Four own evaluations reported as insufficient');
reset role;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","session_id":"41000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_get_personal_recommendations()$$,'P0001','AUTH_REQUIRED','Expired/unknown session cannot fall back to anon');
reset role;
select * from finish();
rollback;
