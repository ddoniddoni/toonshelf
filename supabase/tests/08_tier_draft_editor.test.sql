-- Rollback-only synthetic fixtures. Written only; not executed or published.
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
 select ('38000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-fixture-' || n || '@example.test',now(),false,'{"role":"admin"}' from generate_series(1,3) n;
-- Local transactional fixtures only: shared Auth identities do not auto-enroll.
insert into public.toon_profiles(id) select id from auth.users where id::text like '38000000-0000-4000-8000-%' on conflict(id) do nothing;
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '38000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id::text like '38000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('48000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '38000000-%';
update public.toon_profiles set username = 'tier_fixture_' || right(id::text,1),display_name = '[테스트] 티어',onboarding_completed_at = now() where id::text like '38000000-%';
update toon_private.toon_user_access set status = 'active',role = case when right(user_id::text,1) = '1' then 'admin'::public.toon_user_role else 'user'::public.toon_user_role end where user_id::text like '38000000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '38000000-%';
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 select ('58000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-fixture-' || n,'[테스트] 티어 작품 ' || n,'all','published' from generate_series(1,4) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,'all',now() from public.toon_works w cross join public.toon_platforms p where w.id::text like '58000000-%' and p.code = 'naver_webtoon';
-- Helpers have no definer/owner elevation. All mutations below use real RPCs.
create function public.toon_test_tier_payload() returns jsonb language sql set search_path = '' as $$select '{"title":"tier-private-secret","description":"private-description","tags":["private-tag"],"rows":[{"id":"68000000-0000-4000-8000-000000000001","label":"S級","colorToken":"S","canonicalTier":null},{"id":"68000000-0000-4000-8000-000000000002","label":"추천","colorToken":"A","canonicalTier":"A"}],"placements":[{"workId":"58000000-0000-4000-8000-000000000001","rowId":"68000000-0000-4000-8000-000000000001","position":0},{"workId":"58000000-0000-4000-8000-000000000002","rowId":"68000000-0000-4000-8000-000000000002","position":0},{"workId":"58000000-0000-4000-8000-000000000003","rowId":null,"position":0}]}'::jsonb;$$;
grant execute on function public.toon_test_tier_payload() to authenticated;
select ok(not has_table_privilege('authenticated','public.toon_tier_lists','SELECT'),'No direct metadata reads');
select ok(not has_table_privilege('authenticated','public.toon_tier_list_drafts','UPDATE'),'No direct draft writes');
select ok(not has_table_privilege('authenticated','toon_private.toon_tier_merge_history','SELECT'),'No direct archives for owners/admin');
select ok(not has_function_privilege('anon','public.toon_get_my_tier_editor(uuid)','EXECUTE'),'Anonymous cannot read owner drafts');
select ok(not has_function_privilege('authenticated','toon_private.toon_admin_merge_personal_base(uuid,uuid,bigint,bigint,text,boolean,uuid,text)','EXECUTE'),'Old merge path is not callable directly');
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000002","session_id":"48000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select set_config('tier_test.id',public.toon_create_tier_draft(public.toon_test_tier_payload(),null)::text,true);
select is(public.toon_get_my_tier_editor(current_setting('tier_test.id')::uuid)->'draft'->'rows'->0->>'canonicalTier',null::text,'Custom S label never becomes a canonical evaluation');
select is(public.toon_save_tier_draft(current_setting('tier_test.id')::uuid,1,public.toon_test_tier_payload())->>'version','2','Save increments version');
select is(public.toon_save_tier_draft(current_setting('tier_test.id')::uuid,1,public.toon_test_tier_payload())->'conflict'->>'version','2','Stale version returns current metadata');
select ok(not (public.toon_save_tier_draft(current_setting('tier_test.id')::uuid,1,public.toon_test_tier_payload()) ? 'draft'),'Conflict never returns another edit payload');
select throws_ok($$select public.toon_save_tier_draft(current_setting('tier_test.id')::uuid,2,jsonb_set(public.toon_test_tier_payload(),'{placements,0,rowId}','"68000000-0000-4000-8000-000000000099"'))$$,'P0001','VALIDATION_ERROR','Invalid row ID rejected');
select throws_ok($$select public.toon_create_tier_draft(jsonb_set(public.toon_test_tier_payload(),'{placements}',(public.toon_test_tier_payload()->'placements') || (public.toon_test_tier_payload()->'placements')),null)$$,'P0001','VALIDATION_ERROR','Duplicate works rejected in SQL');
reset role;
update public.toon_works set catalogue_status = 'hidden' where id in ('58000000-0000-4000-8000-000000000003','58000000-0000-4000-8000-000000000004');
set local role authenticated;
select is(public.toon_save_tier_draft(current_setting('tier_test.id')::uuid,2,public.toon_test_tier_payload())->>'version','3','An existing hidden placement is preserved');
select is((select value->'work' from jsonb_array_elements(public.toon_get_my_tier_editor(current_setting('tier_test.id')::uuid)->'works') where value->>'workId' = '58000000-0000-4000-8000-000000000003'),'null'::jsonb,'Hidden work rendered as placeholder');
select throws_ok($$select public.toon_create_tier_draft(public.toon_test_tier_payload(),null)$$,'P0001','WORK_UNAVAILABLE','Hidden work cannot be newly injected');
select lives_ok($$select public.toon_copy_tier_draft(current_setting('tier_test.id')::uuid,3)$$,'Owned copy retains existing unavailable placements');
reset role;
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000003","session_id":"48000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_my_tier_editor(current_setting('tier_test.id')::uuid),null::jsonb,'Other owner cannot read draft');
select is(public.toon_get_my_tier_merge_history(current_setting('tier_test.id')::uuid,1),null::jsonb,'Other owner cannot read archive');
select throws_ok($$select public.toon_save_tier_draft(current_setting('tier_test.id')::uuid,3,public.toon_test_tier_payload())$$,'P0001','NOT_FOUND','Other owner cannot overwrite draft');
select throws_ok($$select public.toon_create_tier_draft(public.toon_test_tier_payload(),current_setting('tier_test.id')::uuid)$$,'P0001','NOT_FOUND','Owned-origin exception cannot copy another private list');
reset role;
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000001","session_id":"48000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('tier_test.preview',public.toon_admin_merge_preview('58000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000002')::text,true);
select ok((current_setting('tier_test.preview')::jsonb->>'canMerge')::boolean,'Implemented draft domain no longer blocks merge');
select ok(current_setting('tier_test.preview') !~ 'tier-private-secret|private-description|private-tag','Administrator sees counts without private draft content');
select is(public.toon_get_my_tier_editor(current_setting('tier_test.id')::uuid),null::jsonb,'Administrator has no owner draft access');
reset role;
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000002","session_id":"48000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_save_tier_draft(current_setting('tier_test.id')::uuid,3,jsonb_set(public.toon_test_tier_payload(),'{title}','"new-private-title"'))->>'version','4','Owner edits after preview');
reset role;
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000001","session_id":"48000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_admin_merge_works('58000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000002',1,1,'[테스트] 동일 작품',true,(current_setting('tier_test.preview')::jsonb->>'previewToken')::uuid,'latest_private')$$,'P0001','MERGE_PREVIEW_EXPIRED','Tier edit invalidates merge preview');
select set_config('tier_test.preview',public.toon_admin_merge_preview('58000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000002')::text,true);
select lives_ok($$select public.toon_admin_merge_works('58000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000002',1,1,'[테스트] 동일 작품',true,(current_setting('tier_test.preview')::jsonb->>'previewToken')::uuid,'latest_private')$$,'Merge updates private drafts atomically');
reset role;
select is((select count(*)::integer from public.toon_user_evaluations where user_id = '38000000-0000-4000-8000-000000000002'),0,'Tier placement never adds canonical evaluation rows');
select is((select jsonb_array_length(placements) from public.toon_tier_list_drafts where tier_list_id = current_setting('tier_test.id')::uuid),2,'Source/target deduplicated');
select is((select value->>'rowId' from public.toon_tier_list_drafts d,lateral jsonb_array_elements(d.placements) where d.tier_list_id = current_setting('tier_test.id')::uuid and value->>'workId' = '58000000-0000-4000-8000-000000000002'),'68000000-0000-4000-8000-000000000002','Existing target row retained');
select is((select version::text from public.toon_tier_list_drafts where tier_list_id = current_setting('tier_test.id')::uuid),'5','Merge bumps optimistic version');
select is((select jsonb_array_length(draft_before->'placements') from toon_private.toon_tier_merge_history where tier_list_id = current_setting('tier_test.id')::uuid),3,'Original placement snapshot preserved privately');
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000002","session_id":"48000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_my_tier_merge_history(current_setting('tier_test.id')::uuid,1)->'items'->0->>'duplicatesRemoved','1','Owner can review lossless archive');
select lives_ok($$select public.toon_create_tier_draft(public.toon_test_tier_payload(),current_setting('tier_test.id')::uuid)$$,'Conflict save-as-new resolves previously owned merged IDs');
select throws_ok($$select public.toon_delete_tier_draft(current_setting('tier_test.id')::uuid,5,false)$$,'P0001','CONFIRM_REQUIRED','Deletion requires acknowledgement');
select lives_ok($$select public.toon_delete_tier_draft(current_setting('tier_test.id')::uuid,5,true)$$,'Owner deletes private draft');
select is(public.toon_get_my_tier_editor(current_setting('tier_test.id')::uuid),null::jsonb,'Deleted draft unavailable');
reset role;
select is((select count(*)::integer from toon_private.toon_tier_merge_history where tier_list_id = current_setting('tier_test.id')::uuid),0,'Deleting draft purges its private archive');
-- Seed the quota as the test database owner, then exercise the real user RPC.
with lists as (insert into public.toon_tier_lists(user_id) select '38000000-0000-4000-8000-000000000003' from generate_series(1,50) returning id)
 insert into public.toon_tier_list_drafts(tier_list_id,title,description,tags,rows,placements)
 select id,'[테스트] 상한','',array[]::text[],public.toon_test_tier_payload()->'rows','[]'::jsonb from lists;
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000003","session_id":"48000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_create_tier_draft(jsonb_set(public.toon_test_tier_payload(),'{placements}','[]'),null)$$,'P0001','TIER_LIMIT','User quota is checked at the database boundary');
select throws_ok($$select public.toon_search_tier_draft_works('library','',0)$$,'P0001','VALIDATION_ERROR','Picker page bound enforced');
reset role;
select set_config('request.jwt.claims','{"sub":"38000000-0000-4000-8000-000000000002","session_id":"48000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
update toon_private.toon_user_access set status = 'suspended' where user_id = '38000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.toon_list_my_tier_drafts(1)$$,'P0001','FORBIDDEN','Suspended active JWT cannot access drafts');
reset role;
select * from finish();
rollback;
