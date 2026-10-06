-- Rollback-only synthetic fixtures. Written, never executed or published.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
grant usage on schema extensions to anon,authenticated;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap'
 loop execute format('grant execute on function %s to anon,authenticated',f);end loop;
end;$$;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data)
 select ('35000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'safe-merge-' || n || '@example.test',now(),false,'{"role":"admin"}' from generate_series(1,4) n;
-- Local transactional fixtures only: shared Auth identities do not auto-enroll.
insert into public.toon_profiles(id) select id from auth.users where id::text like '35000000-0000-4000-8000-%' on conflict(id) do nothing;
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '35000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id::text like '35000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('45000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '35000000-%';
update public.toon_profiles set username = 'merge_reader_' || right(id::text,1),display_name = '[테스트] 병합',onboarding_completed_at = now() where id::text like '35000000-%';
update toon_private.toon_user_access set status = 'active',role = case when right(user_id::text,1) = '1' then 'admin'::public.toon_user_role else 'user'::public.toon_user_role end where user_id::text like '35000000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '35000000-%';
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 select ('55000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'safe-merge-fixture-' || n,'[테스트] 병합 작품 ' || n,'all','published' from generate_series(1,4) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,'all',now() from public.toon_works w cross join public.toon_platforms p where w.id::text like '55000000-%' and p.code = 'naver_webtoon';
insert into public.toon_library_entries(user_id,work_id,status,visibility,version,updated_at) values
 ('35000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000001','completed','private',5,'2025-01-01'),
 ('35000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000002','reading','public',8,'2024-01-01'),
 ('35000000-0000-4000-8000-000000000003','55000000-0000-4000-8000-000000000001','reading','public',9,'2025-01-01'),
 ('35000000-0000-4000-8000-000000000004','55000000-0000-4000-8000-000000000002','reading','public',3,'2025-01-01');
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility,updated_at) values
 ('35000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000001',8,'A','private','2025-01-01'),
 ('35000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000002',2,'D','public','2024-01-01'),
 ('35000000-0000-4000-8000-000000000003','55000000-0000-4000-8000-000000000001',6,null,'public','2025-01-01'),
 ('35000000-0000-4000-8000-000000000004','55000000-0000-4000-8000-000000000002',10,null,'public','2025-01-01');
insert into public.toon_library_private_details(user_id,work_id,private_note,tags,last_read_episode,preferred_work_platform_id,updated_at)
 select l.user_id,l.work_id,case when right(l.work_id::text,1) = '1' then 'merge-source-secret' else 'merge-target-secret' end,
 case when right(l.work_id::text,1) = '1' then array['common','source'] else array['common','target'] end,
 case when right(l.work_id::text,1) = '1' then 100 else 50 end,wp.id,l.updated_at
 from public.toon_library_entries l join public.toon_work_platforms wp on wp.work_id = l.work_id where l.user_id = '35000000-0000-4000-8000-000000000002';
insert into public.toon_reviews(id,user_id,work_id,body,is_spoiler,publication_status,published_at,version)
 values('65000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000003','55000000-0000-4000-8000-000000000001','[테스트] 공개 스포일러 리뷰 원문을 유지하는 내용입니다.',true,'published','2025-01-01',5);
insert into public.toon_content_edit_drafts(user_id,review_id,payload,version)
 values('35000000-0000-4000-8000-000000000003','65000000-0000-4000-8000-000000000001','{"body":"merge-unpublished-secret","isSpoiler":false,"episode":12}',7);
insert into public.toon_reports(id,reporter_id,review_id,reason,detail)
 values('75000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000004','65000000-0000-4000-8000-000000000001','spoiler','[테스트] 스포일러 신고 참조 보존');
insert into toon_private.toon_review_moderation_events(actor_id,review_id,report_id,action,reason)
 values('35000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','review_fixture','[테스트] 운영 참조 보존');
-- Invoker-only helpers make the test use the real RPC permission boundary.
create function public.toon_test_safe_merge_preview() returns jsonb language sql set search_path = '' as $$
 select public.toon_admin_merge_preview('55000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000002');$$;
create function public.toon_test_safe_merge_apply() returns void language sql set search_path = '' as $$
 select public.toon_admin_merge_works('55000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000002',
  (current_setting('test.merge_preview')::jsonb->'source'->>'version')::bigint,(current_setting('test.merge_preview')::jsonb->'target'->>'version')::bigint,
  '[테스트] 동일 웹툰 확인',true,(current_setting('test.merge_preview')::jsonb->>'previewToken')::uuid,'latest_private');$$;
grant execute on function public.toon_test_safe_merge_preview(),public.toon_test_safe_merge_apply() to anon,authenticated;
set local role anon;
select throws_ok($$select public.toon_get_my_work_merge_history(1)$$,'42501',null,'Anonymous cannot read original records');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_test_safe_merge_preview()$$,'P0001','FORBIDDEN','User metadata cannot authorize merge');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.merge_preview',public.toon_test_safe_merge_preview()::text,true);
select ok((current_setting('test.merge_preview')::jsonb->>'canMerge')::boolean,'Personal tables alone no longer block merge');
select ok(current_setting('test.merge_preview') !~ 'merge-source-secret|merge-target-secret|merge-unpublished-secret|fingerprint|userId','Administrator sees counts only, no notes/draft/digest/owner');
select is((current_setting('test.merge_preview')::jsonb->'records'->>'overlappingLibrary')::integer,1,'Overlapping records counted');
select throws_ok($$select * from toon_private.toon_work_merge_history$$,'42501',null,'Administrator cannot read private history table');
reset role;
update public.toon_library_private_details set private_note = 'changed-after-preview' where work_id = '55000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_test_safe_merge_apply()$$,'P0001','MERGE_PREVIEW_EXPIRED','Private detail edit invalidates preview');
reset role;
update public.toon_library_private_details set private_note = repeat('가',2600) where user_id = '35000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((public.toon_test_safe_merge_preview()->'conflicts'->>'notes')::integer,1,'Length includes both notes and provenance');
reset role;
update public.toon_library_private_details set private_note = case when right(work_id::text,1) = '1' then 'merge-source-secret' else 'merge-target-secret' end,
 tags = array(select right(work_id::text,1) || n from generate_series(1,11) n) where user_id = '35000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((public.toon_test_safe_merge_preview()->'conflicts'->>'tags')::integer,1,'No silent truncation of tag union');
reset role;
update public.toon_library_private_details set tags = case when right(work_id::text,1) = '1' then array['common','source'] else array['common','target'] end,
 started_on = case when right(work_id::text,1) = '1' then '2030-01-01'::date else null end,
 finished_on = case when right(work_id::text,1) = '2' then '2020-01-01'::date else null end where user_id = '35000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((public.toon_test_safe_merge_preview()->'conflicts'->>'dates')::integer,1,'Individually valid dates cannot combine into invalid range');
reset role;
update public.toon_library_private_details set started_on = null,finished_on = null where user_id = '35000000-0000-4000-8000-000000000002';
delete from public.toon_user_evaluations where user_id = '35000000-0000-4000-8000-000000000002' and work_id = '55000000-0000-4000-8000-000000000001';
update public.toon_library_entries set status = 'planned',updated_at = '2040-01-01' where user_id = '35000000-0000-4000-8000-000000000002' and work_id = '55000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((public.toon_test_safe_merge_preview()->'conflicts'->>'plannedEvaluations')::integer,1,'Planned conflict does not silently delete existing target evaluation');
reset role;
update public.toon_library_entries set status = 'completed',updated_at = '2025-01-01' where user_id = '35000000-0000-4000-8000-000000000002' and work_id = '55000000-0000-4000-8000-000000000001';
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility,updated_at)
 values('35000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000001',8,'A','private','2025-01-01');
insert into public.toon_reviews(id,user_id,work_id)
 select ('65000000-0000-4000-8000-' || lpad((n+1)::text,12,'0'))::uuid,'35000000-0000-4000-8000-000000000002',('55000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,2) n;
set local role authenticated;
select set_config('test.merge_preview',public.toon_test_safe_merge_preview()::text,true);
select is((current_setting('test.merge_preview')::jsonb->'conflicts'->>'reviews')::integer,1,'Two current reviews are a hard conflict');
select throws_ok($$select public.toon_test_safe_merge_apply()$$,'P0001','MERGE_RECORD_CONFLICT','No automatic current-review deletion');
reset role;
select is((select count(*) from public.toon_reviews where user_id = '35000000-0000-4000-8000-000000000002' and deleted_at is null),2::bigint,'Conflict transaction preserves both reviews');
update public.toon_reviews set deleted_at = now() where id = '65000000-0000-4000-8000-000000000002';
update public.toon_works set catalogue_status = 'hidden' where id = '55000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((public.toon_test_safe_merge_preview()->'conflicts'->>'unavailable')::integer,2,'Hidden source cannot broaden publication of existing records');
reset role;
update public.toon_works set catalogue_status = 'published' where id = '55000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('test.merge_preview',public.toon_test_safe_merge_preview()::text,true);
reset role;
update toon_private.toon_work_merge_previews set expires_at = now() - interval '1 second';
set local role authenticated;
select throws_ok($$select public.toon_test_safe_merge_apply()$$,'P0001','MERGE_PREVIEW_EXPIRED','Expired confirmation is rejected');
select set_config('test.merge_preview',public.toon_test_safe_merge_preview()::text,true);
select lives_ok($$select public.toon_test_safe_merge_apply()$$,'Administrator can merge handled domains atomically');
select throws_ok($$select public.toon_test_safe_merge_apply()$$,'P0001','VALIDATION_ERROR','A completed source cannot merge twice');
select is(public.toon_get_my_work_merge_history(1)->>'total','0','Administrator history contains only their own original records');
reset role;
select is((select count(*) from public.toon_library_entries where work_id = '55000000-0000-4000-8000-000000000001'),0::bigint,'Source records moved');
select is((select count(*) from public.toon_user_evaluations where work_id = '55000000-0000-4000-8000-000000000002'),3::bigint,'One canonical evaluation per owner after merge');
select is((select status::text from public.toon_library_entries where user_id = '35000000-0000-4000-8000-000000000002' and work_id = '55000000-0000-4000-8000-000000000002'),'completed','Latest library status wins');
select is((select rating_steps::integer from public.toon_user_evaluations where user_id = '35000000-0000-4000-8000-000000000002' and work_id = '55000000-0000-4000-8000-000000000002'),8,'Latest whole evaluation wins');
select is((select visibility::text from public.toon_library_entries where user_id = '35000000-0000-4000-8000-000000000002' and work_id = '55000000-0000-4000-8000-000000000002'),'private','Library visibility cannot expand');
select is((select visibility::text from public.toon_user_evaluations where user_id = '35000000-0000-4000-8000-000000000002' and work_id = '55000000-0000-4000-8000-000000000002'),'private','Evaluation visibility independently cannot expand');
select ok((select private_note like '%merge-source-secret%' and private_note like '%merge-target-secret%' and private_note like '%병합 전 기록%' from public.toon_library_private_details where user_id = '35000000-0000-4000-8000-000000000002'),'Both notes retain provenance');
select is((select tags from public.toon_library_private_details where user_id = '35000000-0000-4000-8000-000000000002'),array['common','source','target'],'Tags deduplicate without dropping values');
select ok((select wp.work_id = d.work_id from public.toon_library_private_details d join public.toon_work_platforms wp on wp.id = d.preferred_work_platform_id where d.user_id = '35000000-0000-4000-8000-000000000002'),'Preferred platform identity remains valid');
select is((select version from public.toon_library_entries where user_id = '35000000-0000-4000-8000-000000000003'),10::bigint,'Source-only version also advances');
select is((select version from public.toon_reviews where id = '65000000-0000-4000-8000-000000000001'),6::bigint,'Old publication versions invalidated');
select is((select version from public.toon_content_edit_drafts where review_id = '65000000-0000-4000-8000-000000000001'),8::bigint,'Old draft versions invalidated');
select is((select payload->>'body' from public.toon_content_edit_drafts where review_id = '65000000-0000-4000-8000-000000000001'),'merge-unpublished-secret','Unpublished draft preserved separately');
select is((select review_id::text from public.toon_reports where id = '75000000-0000-4000-8000-000000000001'),'65000000-0000-4000-8000-000000000001','Reports retain stable review identity');
select is((select count(*) from toon_private.toon_review_moderation_events where review_id = '65000000-0000-4000-8000-000000000001'),1::bigint,'Moderation references retained');
select ok((select bool_and(position('merge-source-secret' in coalesce(before_summary::text,'') || coalesce(after_summary::text,'')) = 0) from toon_private.toon_admin_audit_logs),'Private notes do not enter audit snapshots');
select is((select publication_status::text from public.toon_reviews where id = '65000000-0000-4000-8000-000000000001'),'published','Publication state retained');
select ok((select is_spoiler and moderation_status = 'visible' from public.toon_reviews where id = '65000000-0000-4000-8000-000000000001'),'Spoiler and moderation state retained');
select set_config('test.other_history',(select id::text from toon_private.toon_work_merge_history where user_id = '35000000-0000-4000-8000-000000000003'),true);
set local role anon;
select is((public.toon_get_work_evaluation_stats('55000000-0000-4000-8000-000000000002')->>'ratingCount')::integer,2,'Public statistics count only surviving public evaluations');
select is((public.toon_get_work_evaluation_stats('55000000-0000-4000-8000-000000000002')->>'average')::numeric,4::numeric,'Public mean does not double-count merged evaluations');
select is(public.toon_get_catalogue_detail('safe-merge-fixture-1')->>'slug','safe-merge-fixture-2','Old public slug resolves to target');
select is(public.toon_get_review('65000000-0000-4000-8000-000000000001',false,null)->>'body',null::text,'Spoiler body still absent on initial response');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_my_work_merge_history(1)->>'total','1','Owner can find their merge notice');
select is(public.toon_get_my_work_merge_history(1)->'items'->0->'sourceRecord'->>'note','merge-source-secret','Owner can read source original');
select is(public.toon_get_my_work_merge_history(1)->'items'->0->'targetRecord'->>'note','merge-target-secret','Owner can read overwritten target original');
select is(public.toon_get_my_work_merge_target('55000000-0000-4000-8000-000000000001')::text,'55000000-0000-4000-8000-000000000002','Owner stale record URL can resolve');
select throws_ok($$select public.toon_delete_my_work_merge_history(current_setting('test.other_history')::uuid,true)$$,'P0001','NOT_FOUND','Owner cannot delete another archive');
select throws_ok($$select public.toon_delete_my_work_merge_history((public.toon_get_my_work_merge_history(1)->'items'->0->>'id')::uuid,false)$$,'P0001','CONFIRM_REQUIRED','Original deletion requires confirmation');
select lives_ok($$select public.toon_delete_my_work_merge_history((public.toon_get_my_work_merge_history(1)->'items'->0->>'id')::uuid,true)$$,'Owner can remove archived notes');
select is(public.toon_get_my_work_merge_history(1)->>'total','0','Deleted archive is no longer exposed');
select is(public.toon_get_my_reading_record('55000000-0000-4000-8000-000000000002')->>'status','completed','Archive deletion leaves current record intact');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_save_review_draft('65000000-0000-4000-8000-000000000001',7,'{"body":"old editor must not overwrite preserved draft","isSpoiler":false,"episode":null}')$$,'P0001','CONFLICT','Old review editor cannot overwrite moved draft');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000004","session_id":"45000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_my_work_merge_history(1)->>'total','0','Target-only unrelated owner cannot read another archive');
select is(public.toon_get_my_work_merge_target('55000000-0000-4000-8000-000000000001'),null::uuid,'Unrelated owner cannot resolve another original URL');
reset role;
-- Keep the future-domain guard even when those tables are empty.
create table public.toon_posts(id uuid);
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select ok((public.toon_admin_merge_preview('55000000-0000-4000-8000-000000000003','55000000-0000-4000-8000-000000000004')->>'blockedByPersonalDomains')::boolean,'Future unhandled post domain still blocks merge');
reset role;
select * from finish();
rollback;
