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
 select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'rankings-'||n||'@example.test',now(),false from generate_series(1,11) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'rankings_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '50000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '50000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status) select id,'active' from public.toon_profiles where id::text like '50000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '50000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('51000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '50000000-0000-4000-8000-%';
insert into public.toon_platforms(id,code,name,approved_hosts) values('52000000-0000-4000-8000-000000000001','ranking_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status,is_test)
 select ('53000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ranking-'||n,'[test] work '||n,
 case when n=37 then '19'::public.toon_age_rating else 'all'::public.toon_age_rating end,
 case when n=36 then 'hidden'::public.toon_catalogue_status else 'published'::public.toon_catalogue_status end,n=38 from generate_series(1,39) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select id,'52000000-0000-4000-8000-000000000001','https://example.test/'||slug,'all',now() from public.toon_works where id::text like '53000000-0000-4000-8000-%' and right(id::text,12)::integer<>39;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at) values
 ('53000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000001','https://example.test/ranking-duplicate','all',now());
insert into public.toon_genres(id,slug,name) values('54000000-0000-4000-8000-000000000001','ranking-fixture','[test] genre');
insert into public.toon_work_genres(work_id,genre_id) values
 ('53000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001'),
 ('53000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000001');
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select p.id,w.id,case when right(p.id::text,12)::integer=10 and right(w.id::text,12)::integer=2 then 'reading'::public.toon_reading_status else 'completed'::public.toon_reading_status end,
 case when right(p.id::text,12)::integer>5 and right(w.id::text,12)::integer=30 then 'private'::public.toon_visibility else 'public'::public.toon_visibility end
 from public.toon_profiles p cross join public.toon_works w where p.id::text like '50000000-0000-4000-8000-%' and right(p.id::text,12)::integer<=10
 and w.id::text like '53000000-0000-4000-8000-%' and (right(w.id::text,12)::integer<=30 or right(w.id::text,12)::integer>=36);
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,visibility)
 select user_id,work_id,case when w=1 then 10 when w in (2,4) then 9 else 2 end,'public'
 from (select l.*,right(user_id::text,12)::integer u,right(work_id::text,12)::integer w from public.toon_library_entries l where user_id::text like '50000000-0000-4000-8000-%') x
 where (w=1 and u<=5) or w in (2,3,4) or (w=5 and u<=4) or w>=36;
-- Nonpublic/unavailable works must not qualify someone for 30 public reads.
select ok(not has_function_privilege('service_role','public.toon_get_work_rankings(text,text,text,text,integer)','EXECUTE'),'No service-role entry');
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select set_config('test.rankings',public.toon_get_work_rankings('all','ranking_fixture')::text,true);
select is((current_setting('test.rankings')::jsonb->>'total')::int,4,'Only public works with >=5 evaluations rank');
select is(current_setting('test.rankings')::jsonb#>>'{items,0,work,id}','53000000-0000-4000-8000-000000000002','More-supported 4.5 outranks five perfect ratings');
select is(current_setting('test.rankings')::jsonb#>>'{items,1,work,id}','53000000-0000-4000-8000-000000000004','Equal score and count break by UUID');
select is((current_setting('test.rankings')::jsonb#>>'{items,0,sampleCount}')::int,10,'Platform links do not duplicate evaluations');
select is((current_setting('test.rankings')::jsonb#>>'{items,0,average}')::numeric,4.5::numeric,'Display raw average, not corrected score');
select is(public.toon_get_work_rankings('all','ranking_fixture','ranking-fixture')#>>'{items,0,work,id}','53000000-0000-4000-8000-000000000002','Genre filter does not recompute baseline C');
select is((public.toon_get_work_rankings('completed','ranking_fixture')#>>'{items,0,sampleCount}')::int,10,'Completed cohort has its own ordering');
select is((select (x->>'sampleCount')::int from jsonb_array_elements(public.toon_get_work_rankings('completed','ranking_fixture')->'items') x where x#>>'{work,id}'='53000000-0000-4000-8000-000000000002'),9,'Reading status cannot enter completed sample');
select is((public.toon_get_work_rankings('experienced','ranking_fixture')#>>'{items,0,sampleCount}')::int,5,'Thirty public reads qualifies; 29 plus private does not');
select is((public.toon_get_work_rankings('completed_experienced','ranking_fixture')->>'total')::int,4,'Combined public status and experience conditions');
select set_config('test.rankings_small',public.toon_get_work_rankings('all','ranking_fixture',null,'insufficient')::text,true);
select is(current_setting('test.rankings_small')::jsonb#>>'{items,0,work,id}','53000000-0000-4000-8000-000000000005','Subthreshold list sorts by count then UUID');
select is((current_setting('test.rankings_small')::jsonb#>>'{items,0,sampleCount}')::int,4,'Four public votes are disclosed only as count');
select ok(current_setting('test.rankings_small')::jsonb#>'{items,0,average}'='null'::jsonb,'Subthreshold average hidden');
select ok(current_setting('test.rankings_small')::jsonb#>'{items,0,rank}'='null'::jsonb,'Subthreshold work has no rank');
select is(jsonb_array_length(current_setting('test.rankings_small')::jsonb->'items'),20,'Page size is 20');
select is(jsonb_array_length(public.toon_get_work_rankings('all','ranking_fixture',null,'insufficient',2)->'items'),11,'Second page retains remaining unranked works');
select throws_ok($$select public.toon_get_work_rankings('private')$$,'P0001','VALIDATION_ERROR','Direct RPC audience validation');
select throws_ok($$select public.toon_get_work_rankings(p_page=>0)$$,'P0001','VALIDATION_ERROR','Direct RPC page validation');
reset role;
update public.toon_library_entries set visibility='private' where user_id='50000000-0000-4000-8000-000000000005' and work_id='53000000-0000-4000-8000-000000000030';
set local role anon;
select is((public.toon_get_work_rankings('experienced','ranking_fixture')->>'total')::int,0,'Withdrawing the 30th public record drops sample below five');
reset role;
-- Viewer-specific block boundaries also affect the pre-filter site baseline.
insert into public.toon_blocks(blocker_id,blocked_id) values('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000011');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000011","session_id":"51000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
set local role authenticated;
select is((public.toon_get_work_rankings('all','ranking_fixture')->>'total')::int,3,'Reverse block excludes a voter and subthreshold work');
reset role;
update public.toon_user_evaluations set visibility='private' where user_id='50000000-0000-4000-8000-000000000005' and work_id='53000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select is((public.toon_get_work_rankings('all','ranking_fixture')->>'total')::int,3,'Private evaluations removed immediately');
reset role;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000011","session_id":"51000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_get_work_rankings()$$,'P0001','AUTH_REQUIRED','Stale session cannot fall back to public anon');
reset role;
select * from finish();
rollback;
