-- Rollback fixtures only. Written, not applied/executed.
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
 select ('3b000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-evaluation-' || n || '@example.test',now(),false,'{"role":"admin"}' from generate_series(1,2) n;
-- Local transactional fixtures only: shared Auth identities do not auto-enroll.
insert into public.toon_profiles(id) select id from auth.users where id::text like '3b000000-0000-4000-8000-%' on conflict(id) do nothing;
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '3b000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id::text like '3b000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('4b000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '3b000000-%';
update public.toon_profiles set username = 'tier_eval_' || right(id::text,1),onboarding_completed_at = now() where id::text like '3b000000-%';
update toon_private.toon_user_access set status = 'active',role = case when right(user_id::text,1) = '2' then 'admin'::public.toon_user_role else 'user'::public.toon_user_role end where user_id::text like '3b000000-%';
update public.toon_user_settings set default_library_visibility = 'public',default_evaluation_visibility = 'public' where user_id = '3b000000-0000-4000-8000-000000000001';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '3b000000-%';
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 select ('5b000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-evaluation-' || n,'[테스트] 평가 작품 ' || n,'all','published' from generate_series(1,8) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,'all',now() from public.toon_works w cross join public.toon_platforms p where w.id::text like '5b000000-%' and p.code = 'naver_webtoon';
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select '3b000000-0000-4000-8000-000000000001',id,case when right(id::text,1) = '3' then 'planned'::public.toon_reading_status else 'completed'::public.toon_reading_status end,
  case when right(id::text,1) = '1' then 'public'::public.toon_visibility else 'private'::public.toon_visibility end from public.toon_works where id::text like '5b000000-%' and right(id::text,1) <> '2';
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility)
 select user_id,work_id,case when right(work_id::text,1) = '1' then 7 else null end,
  case when right(work_id::text,1) = '1' then 'B'::public.toon_canonical_tier when right(work_id::text,1) = '4' then 'C'::public.toon_canonical_tier else 'S'::public.toon_canonical_tier end,
  case when right(work_id::text,1) = '1' then 'public'::public.toon_visibility else 'private'::public.toon_visibility end
 from public.toon_library_entries where user_id = '3b000000-0000-4000-8000-000000000001' and status <> 'planned';
insert into public.toon_library_private_details(user_id,work_id,last_read_episode,private_note,tags)
 values('3b000000-0000-4000-8000-000000000001','5b000000-0000-4000-8000-000000000001',42,'canonical-private-note',array['개인태그']);
create function public.toon_test_evaluation_payload() returns jsonb language sql set search_path = '' as $$select '{"title":"canonical-draft","description":"","tags":[],"rows":[{"id":"6b000000-0000-4000-8000-000000000001","label":"최고","colorToken":"S","canonicalTier":"S"},{"id":"6b000000-0000-4000-8000-000000000002","label":"취향","colorToken":"B","canonicalTier":"B"},{"id":"6b000000-0000-4000-8000-000000000003","label":"A급","colorToken":"A","canonicalTier":null}],"placements":[{"workId":"5b000000-0000-4000-8000-000000000001","rowId":"6b000000-0000-4000-8000-000000000001","position":0},{"workId":"5b000000-0000-4000-8000-000000000002","rowId":"6b000000-0000-4000-8000-000000000002","position":0},{"workId":"5b000000-0000-4000-8000-000000000003","rowId":"6b000000-0000-4000-8000-000000000001","position":1},{"workId":"5b000000-0000-4000-8000-000000000004","rowId":"6b000000-0000-4000-8000-000000000003","position":0},{"workId":"5b000000-0000-4000-8000-000000000005","rowId":null,"position":0},{"workId":"5b000000-0000-4000-8000-000000000006","rowId":"6b000000-0000-4000-8000-000000000001","position":2},{"workId":"5b000000-0000-4000-8000-000000000007","rowId":"6b000000-0000-4000-8000-000000000001","position":3}]}'::jsonb;$$;
create function public.toon_test_evaluation_choices() returns jsonb language sql set search_path = '' as $$select '[{"workId":"5b000000-0000-4000-8000-000000000001","status":null},{"workId":"5b000000-0000-4000-8000-000000000002","status":"reading"},{"workId":"5b000000-0000-4000-8000-000000000003","status":"dropped"}]'::jsonb;$$;
create function public.toon_test_import_choices() returns jsonb language sql set search_path = '' as $$select '[{"workId":"5b000000-0000-4000-8000-000000000001","status":null},{"workId":"5b000000-0000-4000-8000-000000000005","status":null},{"workId":"5b000000-0000-4000-8000-000000000008","status":null}]'::jsonb;$$;
grant execute on function public.toon_test_evaluation_payload(),public.toon_test_evaluation_choices(),public.toon_test_import_choices() to authenticated;
select ok(not has_function_privilege('anon','public.toon_commit_tier_evaluations(uuid,text,bigint,jsonb,text,boolean)','EXECUTE'),'Anonymous has no canonical mutation RPC');
select ok(not has_function_privilege('authenticated','toon_private.toon_tier_evaluation_items(uuid,uuid,text,uuid[],integer)','EXECUTE'),'Private projection cannot be invoked with another owner ID');
select ok(not has_table_privilege('authenticated','public.toon_user_evaluations','UPDATE'),'No direct evaluation DML');
select set_config('request.jwt.claims','{"sub":"3b000000-0000-4000-8000-000000000001","session_id":"4b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('tier_eval.id',public.toon_create_tier_draft(public.toon_test_evaluation_payload(),null)::text,true);
select set_config('tier_eval.public_preview',public.toon_preview_tier_publication(current_setting('tier_eval.id')::uuid)::text,true);
select lives_ok($$select public.toon_publish_tier_list(current_setting('tier_eval.id')::uuid,1,1,current_setting('tier_eval.public_preview')::jsonb->>'fingerprint','public',false,null,true)$$,'Create separate public snapshot');
reset role;
update public.toon_works set age_rating = '19' where id = '5b000000-0000-4000-8000-000000000006';
update public.toon_works set catalogue_status = 'hidden' where id = '5b000000-0000-4000-8000-000000000007';
set local role authenticated;
select set_config('tier_eval.context',public.toon_get_my_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1)::text,true);
select is(current_setting('tier_eval.context')::jsonb->'items'->3->>'reason','custom','Label A급 does not infer A');
select is(current_setting('tier_eval.context')::jsonb->'items'->4->>'reason','unplaced','Unplaced work is skipped');
select is(current_setting('tier_eval.context')::jsonb->'items'->5->>'reason','unavailable','Adult gate applies');
select ok(current_setting('tier_eval.context') !~ 'canonical-private-note|last_read_episode|private_note|개인태그','Projection never sends private details');
select throws_ok($$select public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,'[{"workId":"5b000000-0000-4000-8000-000000000002","status":null}]')$$,'P0001','READING_STATUS_REQUIRED','New records require explicit status');
select throws_ok($$select public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,'[{"workId":"5b000000-0000-4000-8000-000000000003","status":null}]')$$,'P0001','READING_STATUS_REQUIRED','Planned records require explicit status');
select throws_ok($$select public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,'[{"workId":"5b000000-0000-4000-8000-000000000001","status":"reading"}]')$$,'P0001','VALIDATION_ERROR','Existing non-planned reading status cannot be rewritten');
select throws_ok($$select public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,'[{"workId":"5b000000-0000-4000-8000-000000000001","status":null},{"workId":"5b000000-0000-4000-8000-000000000001","status":null}]')$$,'P0001','VALIDATION_ERROR','Direct RPC rejects duplicate selection');
select throws_ok($$select public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,'[{"workId":"5b000000-0000-4000-8000-000000000002","status":"planned"}]')$$,'P0001','VALIDATION_ERROR','Direct RPC rejects planned evaluation');
select throws_ok($$select public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,'[{"workId":"5b000000-0000-4000-8000-000000000001","status":null},{"workId":"5b000000-0000-4000-8000-000000000006","status":null}]')$$,'P0001','CONFLICT','Unavailable selection rejects whole preview');
select set_config('tier_eval.preview',public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,public.toon_test_evaluation_choices())::text,true);
select throws_ok($$select public.toon_commit_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,public.toon_test_evaluation_choices(),current_setting('tier_eval.preview')::jsonb->>'fingerprint',false)$$,'P0001','CONFIRM_REQUIRED','Commit requires explicit consent');
select throws_ok($$select public.toon_commit_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,public.toon_test_evaluation_choices(),repeat('0',64),true)$$,'P0001','CONFLICT','Forged fingerprint cannot skip preview');
reset role;
select is((select count(*) from public.toon_library_entries where work_id = '5b000000-0000-4000-8000-000000000002'),0::bigint,'Failed commit creates nothing');
update public.toon_library_entries set version = version+1 where user_id = '3b000000-0000-4000-8000-000000000001' and work_id = '5b000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_commit_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,public.toon_test_evaluation_choices(),current_setting('tier_eval.preview')::jsonb->>'fingerprint',true)$$,'P0001','CONFLICT','Another private edit invalidates preview');
select set_config('tier_eval.preview',public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,public.toon_test_evaluation_choices())::text,true);
select is(public.toon_commit_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1,public.toon_test_evaluation_choices(),current_setting('tier_eval.preview')::jsonb->>'fingerprint',true)->>'changed','3','Explicit apply changes selected evaluations');
reset role;
select is((select canonical_tier::text from public.toon_user_evaluations where work_id = '5b000000-0000-4000-8000-000000000001'),'S','Canonical tier updated');
select is((select rating_steps::integer from public.toon_user_evaluations where work_id = '5b000000-0000-4000-8000-000000000001'),7,'Existing 3.5 stars preserved');
select is((select visibility::text from public.toon_user_evaluations where work_id = '5b000000-0000-4000-8000-000000000001'),'public','Existing evaluation visibility preserved');
select is((select status::text || ':' || visibility::text from public.toon_library_entries where work_id = '5b000000-0000-4000-8000-000000000001'),'completed:public','Existing status and library visibility preserved');
select is((select private_note || ':' || last_read_episode::text from public.toon_library_private_details where work_id = '5b000000-0000-4000-8000-000000000001'),'canonical-private-note:42','Private details preserved');
select is((select visibility::text from public.toon_user_evaluations where work_id = '5b000000-0000-4000-8000-000000000002'),'private','New evaluation defaults private');
select is((select status::text || ':' || visibility::text from public.toon_library_entries where work_id = '5b000000-0000-4000-8000-000000000002'),'reading:private','New library entry defaults private with chosen status');
select is((select status::text from public.toon_library_entries where work_id = '5b000000-0000-4000-8000-000000000003'),'dropped','Planned entry gets explicit status');
select is((select canonical_tier::text from public.toon_user_evaluations where work_id = '5b000000-0000-4000-8000-000000000004'),'C','Custom row evaluation untouched');
select is((select version from public.toon_tier_list_drafts where tier_list_id = current_setting('tier_eval.id')::uuid),1::bigint,'Apply does not edit draft');
-- A subsequent personal edit gives work 1 a different canonical value to import.
update public.toon_user_evaluations set canonical_tier = 'B' where work_id = '5b000000-0000-4000-8000-000000000001';
update public.toon_library_entries set version = version+1 where work_id = '5b000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.toon_get_my_tier_evaluations(current_setting('tier_eval.id')::uuid,'import',1)->'items'->3->>'reason','missing_row','Missing canonical row is explained, not guessed from labels');
select set_config('tier_eval.import',public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'import',1,public.toon_test_import_choices())::text,true);
select lives_ok($$select public.toon_save_tier_draft(current_setting('tier_eval.id')::uuid,1,jsonb_set(public.toon_test_evaluation_payload(),'{title}','"new draft title"'))$$,'Concurrent draft edit');
select throws_ok($$select public.toon_commit_tier_evaluations(current_setting('tier_eval.id')::uuid,'import',1,public.toon_test_import_choices(),current_setting('tier_eval.import')::jsonb->>'fingerprint',true)$$,'P0001','CONFLICT','Old draft preview cannot overwrite newer draft');
select set_config('tier_eval.import',public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'import',2,public.toon_test_import_choices())::text,true);
select is(public.toon_commit_tier_evaluations(current_setting('tier_eval.id')::uuid,'import',2,public.toon_test_import_choices(),current_setting('tier_eval.import')::jsonb->>'fingerprint',true)->>'version','3','Import saves a new draft version');
reset role;
select is((select value->>'rowId' from public.toon_tier_list_drafts d cross join lateral jsonb_array_elements(d.placements) where d.tier_list_id = current_setting('tier_eval.id')::uuid and value->>'workId' = '5b000000-0000-4000-8000-000000000001'),'6b000000-0000-4000-8000-000000000002','Import moves existing work into explicit canonical row');
select is((select value->>'rowId' from public.toon_tier_list_drafts d cross join lateral jsonb_array_elements(d.placements) where d.tier_list_id = current_setting('tier_eval.id')::uuid and value->>'workId' = '5b000000-0000-4000-8000-000000000005'),'6b000000-0000-4000-8000-000000000001','Import places unplaced work');
select is((select value->>'rowId' from public.toon_tier_list_drafts d cross join lateral jsonb_array_elements(d.placements) where d.tier_list_id = current_setting('tier_eval.id')::uuid and value->>'workId' = '5b000000-0000-4000-8000-000000000008'),'6b000000-0000-4000-8000-000000000001','Import adds a work absent from draft');
select is((select jsonb_array_length(placements) from public.toon_tier_list_drafts where tier_list_id = current_setting('tier_eval.id')::uuid),8,'Import preserves and deduplicates other works');
select is((select canonical_tier::text from public.toon_user_evaluations where work_id = '5b000000-0000-4000-8000-000000000001'),'B','Import does not change personal evaluation');
select is((select published_version from public.toon_tier_lists where id = current_setting('tier_eval.id')::uuid),1::bigint,'Both operations preserve published snapshot pointer');
select set_config('request.jwt.claims','{"sub":"3b000000-0000-4000-8000-000000000002","session_id":"4b000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_my_tier_evaluations(current_setting('tier_eval.id')::uuid,'import',1),null::jsonb,'Administrator cannot list another owner evaluations');
select throws_ok($$select public.toon_preview_tier_evaluations(current_setting('tier_eval.id')::uuid,'import',3,public.toon_test_import_choices())$$,'P0001','NOT_FOUND','Administrator cannot preview another owner draft');
reset role;
select set_config('request.jwt.claims','{"sub":"3b000000-0000-4000-8000-000000000001","session_id":"4b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update toon_private.toon_user_access set status = 'suspended' where user_id = '3b000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_get_my_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1)$$,'P0001','FORBIDDEN','Suspended account denied');
reset role;
update toon_private.toon_user_access set status = 'active' where user_id = '3b000000-0000-4000-8000-000000000001';
delete from auth.sessions where user_id = '3b000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_get_my_tier_evaluations(current_setting('tier_eval.id')::uuid,'apply',1)$$,'P0001','AUTH_REQUIRED','Revoked session denied');
reset role;
select * from finish();
rollback;
