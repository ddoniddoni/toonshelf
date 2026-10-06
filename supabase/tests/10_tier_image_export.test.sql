-- Rollback fixtures only. Written, not executed/applied.
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
 select ('3a000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-image-' || n || '@example.test',now(),false,'{"role":"admin"}' from generate_series(1,3) n;
-- Local transactional fixtures only: shared Auth identities do not auto-enroll.
insert into public.toon_profiles(id) select id from auth.users where id::text like '3a000000-0000-4000-8000-%' on conflict(id) do nothing;
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '3a000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id::text like '3a000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('4a000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '3a000000-%';
update public.toon_profiles set username = 'tier_image_' || right(id::text,1),display_name = '[테스트] 이미지',onboarding_completed_at = now() where id::text like '3a000000-%';
update toon_private.toon_user_access set status = 'active',role = case when right(user_id::text,1) = '1' then 'admin'::public.toon_user_role else 'user'::public.toon_user_role end where user_id::text like '3a000000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '3a000000-%';
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 select ('5a000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-image-' || n,'[테스트] 이미지 작품 ' || n,'all','published' from generate_series(1,2) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,'all',now() from public.toon_works w cross join public.toon_platforms p where w.id::text like '5a000000-%' and p.code = 'naver_webtoon';
create function public.toon_test_image_payload() returns jsonb language sql set search_path = '' as $$select '{"title":"image-draft-secret","description":"<span>literal text</span>","tags":[],"rows":[{"id":"6a000000-0000-4000-8000-000000000001","label":"S","colorToken":"S","canonicalTier":"S"},{"id":"6a000000-0000-4000-8000-000000000002","label":"F","colorToken":"F","canonicalTier":"F"}],"placements":[{"workId":"5a000000-0000-4000-8000-000000000001","rowId":"6a000000-0000-4000-8000-000000000001","position":0},{"workId":"5a000000-0000-4000-8000-000000000002","rowId":null,"position":0}]}'::jsonb;$$;
grant execute on function public.toon_test_image_payload() to authenticated;
select ok(not has_function_privilege('anon','public.toon_begin_tier_image_export(uuid,text,bigint,text,boolean)','EXECUTE'),'Anonymous cannot reserve image work');
select ok(not has_function_privilege('authenticated','toon_private.toon_tier_image_body(jsonb)','EXECUTE'),'Private helper cannot bypass ownership');
select set_config('request.jwt.claims','{"sub":"3a000000-0000-4000-8000-000000000002","session_id":"4a000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select set_config('tier_image.id',public.toon_create_tier_draft(public.toon_test_image_payload(),null)::text,true);
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',1,null,false)->'body'->>'title','image-draft-secret','Owner can export the saved draft');
select is(jsonb_array_length(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',1,null,false)->'unplaced'),1,'Only own draft includes unplaced work');
select ok(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',1,null,false)::text !~ '5a000000|coverAssetId|official_url|encrypted_token','Image source has text, not work IDs or asset/token data');
select throws_ok($$select public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',2,null,false)$$,'P0001','CONFLICT','Stale draft version rejected');
select throws_ok($$select public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',1,repeat('a',64),false)$$,'P0001','VALIDATION_ERROR','Token cannot unlock a private draft');
select set_config('tier_image.preview',public.toon_preview_tier_publication(current_setting('tier_image.id')::uuid)::text,true);
select lives_ok($$select public.toon_publish_tier_list(current_setting('tier_image.id')::uuid,1,1,current_setting('tier_image.preview')::jsonb->>'fingerprint','public',true,null,true)$$,'Publish spoiler snapshot');
select lives_ok($$select public.toon_save_tier_draft(current_setting('tier_image.id')::uuid,1,jsonb_set(public.toon_test_image_payload(),'{title}','"new-unpublished-secret"'))$$,'Change only private draft');
reset role;
select set_config('request.jwt.claims','{"sub":"3a000000-0000-4000-8000-000000000001","session_id":"4a000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',2,null,true),null::jsonb,'Administrator cannot export another private draft');
reset role;
select set_config('request.jwt.claims','{"sub":"3a000000-0000-4000-8000-000000000003","session_id":"4a000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'publication',2,null,false)$$,'P0001','CONFIRM_REQUIRED','Spoiler PNG requires explicit confirmation');
select is(public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'publication',2,null,true)->'body'->>'title','image-draft-secret','Reader gets publication, not later private edits');
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',2,null,true)->'unplaced','[]'::jsonb,'Publication export never includes unplaced works');
reset role;
update public.toon_works set catalogue_status = 'hidden' where id = '5a000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',2,null,true)->'body'->'rows'->0->'items'->0,'null'::jsonb,'Rights/current work checks replace hidden works');
reset role;
update public.toon_works set catalogue_status = 'published' where id = '5a000000-0000-4000-8000-000000000001';
insert into public.toon_blocks(blocker_id,blocked_id) values('3a000000-0000-4000-8000-000000000002','3a000000-0000-4000-8000-000000000003');
set local role authenticated;
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',2,null,true),null::jsonb,'Author block revokes reader image access');
reset role;
delete from public.toon_blocks where blocker_id = '3a000000-0000-4000-8000-000000000002';
update toon_private.toon_user_access set status = 'suspended' where user_id = '3a000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',2,null,true),null::jsonb,'Inactive author has no exportable publication');
reset role;
update toon_private.toon_user_access set status = 'active' where user_id = '3a000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"3a000000-0000-4000-8000-000000000002","session_id":"4a000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select set_config('tier_image.preview',public.toon_preview_tier_publication(current_setting('tier_image.id')::uuid)::text,true);
select lives_ok($$select public.toon_publish_tier_list(current_setting('tier_image.id')::uuid,2,2,current_setting('tier_image.preview')::jsonb->>'fingerprint','unlisted',false,jsonb_build_object('hash',repeat('a',64),'ciphertext',repeat('b',118),'nonce',repeat('c',24)),true)$$,'Switch to token-only publication');
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',3,null,true),null::jsonb,'Even owner cannot export unlisted publication by ID alone');
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',3,repeat('c',64),true),null::jsonb,'Wrong hash does not unlock publication');
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',3,repeat('a',64),false)->'body'->>'title','new-unpublished-secret','Current token grants current publication');
select lives_ok($$select public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'draft',2,null,false)$$,'Rate reservation 1');
select lives_ok($$select public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'publication',3,repeat('a',64),false)$$,'Rate reservation 2, same bucket');
select lives_ok($$select public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'draft',2,null,false)$$,'Rate reservation 3');
select lives_ok($$select public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'draft',2,null,false)$$,'Rate reservation 4');
select lives_ok($$select public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'draft',2,null,false)$$,'Rate reservation 5');
select throws_ok($$select public.toon_begin_tier_image_export(current_setting('tier_image.id')::uuid,'publication',3,repeat('a',64),false)$$,'P0001','RATE_LIMITED','Sixth export is rejected across draft/publication');
select lives_ok($$select public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',2,null,false)$$,'Final rights recheck does not consume another reservation');
reset role;
update toon_private.toon_tier_share_tokens set revoked_at = now() where tier_list_id = current_setting('tier_image.id')::uuid;
set local role authenticated;
select is(public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'publication',3,repeat('a',64),false),null::jsonb,'Revoked token cannot be rechecked or exported');
reset role;
delete from auth.sessions where user_id = '3a000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.toon_get_tier_image_source(current_setting('tier_image.id')::uuid,'draft',2,null,false)$$,'P0001','AUTH_REQUIRED','Removed session cannot export private draft');
reset role;
select * from finish();
rollback;
