-- Rollback-only synthetic fixtures. Written, not executed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
grant usage on schema extensions to anon,authenticated;
do $$ declare v_function regprocedure; begin
 for v_function in select p.oid::regprocedure from pg_proc p
  join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap'
 loop execute format('grant execute on function %s to anon,authenticated',v_function); end loop;
end; $$;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values
 ('31000000-0000-4000-8000-000000000001','library-a@example.test',now(),false,'{}'),
 ('31000000-0000-4000-8000-000000000002','library-b@example.test',now(),false,'{}');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('41000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now(),now()),
 ('41000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002',now(),now());
update public.profiles set username = case id when '31000000-0000-4000-8000-000000000001' then 'library_a' else 'library_b' end,
 display_name = '[테스트] 독자',onboarding_completed_at = now() where id::text like '31000000-%';
update private.user_access set status = 'active' where user_id::text like '31000000-%';
insert into private.consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '31000000-%';
insert into public.works(id,slug,title,age_rating,catalogue_status) values
 ('51000000-0000-4000-8000-000000000001','p3-fixture-alpha','[테스트] 서재 알파','all','published'),
 ('51000000-0000-4000-8000-000000000002','p3-fixture-beta','[테스트] 서재 베타','15','published');
insert into public.work_platforms(work_id,platform_id,official_url,weekdays,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,array[1]::smallint[],'all',now()
 from public.works w cross join public.platforms p where w.id::text like '51000000-%' and p.code = 'naver_webtoon';
create function public.test_reading_payload(p_status text,p_rating integer,p_tier text default null) returns jsonb
language sql set search_path = '' as $$
 select jsonb_build_object('status',p_status,'libraryVisibility','private','evaluationVisibility','public','ratingSteps',p_rating,'canonicalTier',p_tier,
  'episode',37,'startedOn','2026-10-01','finishedOn',null,'note','fixture-private-note','tags',jsonb_build_array('private-tag'),'preferredLink',null);
$$;
grant execute on function public.test_reading_payload(text,integer,text) to authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","session_id":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.save_reading_record('51000000-0000-4000-8000-000000000001',null,public.test_reading_payload('reading',9,'A'),false)$$,'Owner records independent private library and public evaluation');
select throws_ok($$select public.save_reading_record('51000000-0000-4000-8000-000000000001',null,public.test_reading_payload('reading',10),false)$$,'P0001','CONFLICT','Create never silently overwrites an existing record');
select throws_ok($$select public.save_reading_record('51000000-0000-4000-8000-000000000001',1,public.test_reading_payload('planned',10),false)$$,'P0001','PLANNED_EVALUATION','Planned rating rejected in DB');
select throws_ok($$select public.save_reading_record('51000000-0000-4000-8000-000000000001',1,public.test_reading_payload('planned',null),false)$$,'P0001','CLEAR_EVALUATION_REQUIRED','Dropping evaluations requires explicit consent');
select is(public.get_my_reading_record('51000000-0000-4000-8000-000000000001')->>'note','fixture-private-note','Owner can retrieve private note');
select lives_ok($$select public.copy_work_to_library('51000000-0000-4000-8000-000000000001')$$,'Copy is idempotent');
select is(public.get_my_reading_record('51000000-0000-4000-8000-000000000001')->>'ratingSteps','9','Copy preserves original personal evaluation');
select throws_ok($$insert into public.library_entries(user_id,work_id) values('31000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002')$$,'42501',null,'Direct writes cannot forge owner');
select throws_ok($$update public.user_evaluations set visibility = 'public'$$,'42501',null,'Generic evaluation mutation denied');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is((select count(work_id)::integer from public.library_entries),0,'Anon cannot infer private reading status');
select is((select count(work_id)::integer from public.user_evaluations),1,'Public evaluation independent from private status');
select throws_ok($$select private_note from public.library_private_details$$,'42501',null,'Anon cannot read notes');
select throws_ok($$select updated_at from public.library_entries$$,'42501',null,'Record update timestamps are not publicly readable');
select is(public.get_public_library('library_a',1)->'items'->0->>'status',null::text,'Public DTO never copies private status');
select ok(not ((public.get_public_library('library_a',1)->'items'->0) ?| array['note','episode','tags','startedOn','finishedOn','updatedAt']),'Public DTO excludes progress and private activity timestamps');
select is(public.get_work_evaluation_stats('51000000-0000-4000-8000-000000000001')->>'ratingCount','1','One evaluator counted once');
select is(public.get_reading_stats('library_a')->>'readCount','0','Public statistics cannot count private reading');
select throws_ok($$select public.get_reading_stats(null)$$,'P0001','AUTH_REQUIRED','Anonymous callers cannot obtain personal statistics');
reset role;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","session_id":"41000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::integer from public.library_private_details),0,'User B cannot read A private details directly');
select is(public.get_my_reading_record('51000000-0000-4000-8000-000000000001'),null::jsonb,'B cannot retrieve A owner DTO');
select lives_ok($$select public.copy_work_to_library('51000000-0000-4000-8000-000000000001')$$,'B can save a visible work');
select is(public.get_my_reading_record('51000000-0000-4000-8000-000000000001')->>'status','planned','Copy starts as planned');
select is(public.get_my_reading_record('51000000-0000-4000-8000-000000000001')->>'ratingSteps',null::text,'A rating never copied to B');
reset role;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","session_id":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.copy_work_to_library('51000000-0000-4000-8000-000000000002')$$,'Second work stored');
select throws_ok($$select public.bulk_library_change('[{"id":"51000000-0000-4000-8000-000000000001","version":1},{"id":"51000000-0000-4000-8000-000000000002","version":99}]','libraryVisibility','public',false)$$,'P0001','CONFLICT','Stale record aborts whole bulk request');
select is(public.get_my_reading_record('51000000-0000-4000-8000-000000000001')->>'libraryVisibility','private','Bulk failure rolls back earlier modifications');
select throws_ok($$select public.make_all_library_private(false)$$,'P0001','CONFIRM_REQUIRED','All-private requires confirmation');
select lives_ok($$select public.make_all_library_private(true)$$,'All-private is atomic');
select is((select default_evaluation_visibility::text from public.user_settings where user_id = auth.uid()),'private','New evaluation defaults also private');
select is(public.get_work_evaluation_stats('51000000-0000-4000-8000-000000000001')->>'ratingCount','0','Privacy change immediately removes aggregate contribution');
select throws_ok($$select public.save_reading_record('51000000-0000-4000-8000-000000000001',1,public.test_reading_payload('completed',10),false)$$,'P0001','CONFLICT','All-private invalidates open editors');
select lives_ok($$select public.bulk_library_change(jsonb_build_array(jsonb_build_object('id','51000000-0000-4000-8000-000000000001','version',(public.get_my_reading_record('51000000-0000-4000-8000-000000000001')->>'version')::bigint)),'delete','',true)$$,'Owner can delete selected record with consent');
select is(public.get_my_reading_record('51000000-0000-4000-8000-000000000001'),null::jsonb,'Library deletion removes owner record');
select is((select count(*)::integer from public.library_private_details where work_id = '51000000-0000-4000-8000-000000000001'),0,'Private details cascade, without touching B');
select is((select count(work_id)::integer from public.user_evaluations where user_id = auth.uid()),0,'Evaluations cascade with library deletion');
reset role;
update private.user_access set status = 'suspended' where user_id = '31000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.copy_work_to_library('51000000-0000-4000-8000-000000000001')$$,'P0001','FORBIDDEN','Suspended session cannot mutate records');
reset role;
select * from finish();
rollback;
