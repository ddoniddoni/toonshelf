-- Rollback fixtures, WRITTEN ONLY: no SQL/migration/Auth/RLS execution.
-- Pair-lock vs block, root-delete vs reply, privacy vs edit/reveal, and
-- moderator/user races need separate-session execution after approval.
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
 select ('3f000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'comment-' || n || '@example.test',now(),false,'{}' from generate_series(1,4) n;
-- Local transactional fixtures only: shared Auth identities do not auto-enroll.
insert into public.toon_profiles(id) select id from auth.users where id::text like '3f000000-0000-4000-8000-%' on conflict(id) do nothing;
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '3f000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id::text like '3f000000-0000-4000-8000-%' on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('4f000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '3f000000-%';
update public.toon_profiles set username = 'comment_' || right(id::text,1),display_name = '[테스트] 댓글',onboarding_completed_at = now() where id::text like '3f000000-%';
update toon_private.toon_user_access set status = 'active',role = case when right(user_id::text,1) = '4' then 'admin'::public.toon_user_role else 'user'::public.toon_user_role end where user_id::text like '3f000000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '3f000000-%';
insert into public.toon_tier_lists(id,user_id)
 select ('7f000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'3f000000-0000-4000-8000-000000000001' from generate_series(1,4) n;
insert into public.toon_tier_list_publications(tier_list_id,version,payload,is_spoiler)
 select id,1,jsonb_build_object('title','[테스트] 댓글 표','description','tier-body-secret','tags','[]'::jsonb,
 'rows','[{"id":"6f000000-0000-4000-8000-000000000001","label":"S","colorToken":"S","canonicalTier":"S"},{"id":"6f000000-0000-4000-8000-000000000002","label":"F","colorToken":"F","canonicalTier":"F"}]'::jsonb,'placements','[]'::jsonb),right(id::text,1) = '2'
 from public.toon_tier_lists where id::text like '7f000000-%';
update public.toon_tier_lists set version = 2,publication_counter = 1,published_version = case when right(id::text,1) = '4' then null else 1 end,
 visibility = case when right(id::text,1) = '3' then 'unlisted'::public.toon_tier_visibility when right(id::text,1) = '4' then 'private'::public.toon_tier_visibility else 'public'::public.toon_tier_visibility end
 where id::text like '7f000000-%';
select ok(not has_table_privilege('anon','public.toon_comments','SELECT'),'No raw anonymous comment read');
select ok(not has_table_privilege('authenticated','public.toon_comments','INSERT'),'No raw authenticated comment writes');
select ok(not has_table_privilege('authenticated','toon_private.toon_comment_reports','SELECT'),'Report detail is private RPC only');
select ok(not has_function_privilege('authenticated','toon_private.toon_tier_comment_dto(uuid,boolean)','EXECUTE'),'No arbitrary spoiler helper');
select ok(not has_function_privilege('anon','public.toon_create_tier_comment(uuid,uuid,bigint,uuid,text,boolean,boolean)','EXECUTE'),'Anonymous cannot create');
select set_config('request.jwt.claims','{"sub":"3f000000-0000-4000-8000-000000000002","session_id":"4f000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_create_tier_comment('8f000000-0000-4000-8000-000000000001','7f000000-0000-4000-8000-000000000001',2,null,'root-secret',true,true),'8f000000-0000-4000-8000-000000000001'::uuid,'Caller request ID creates root');
select lives_ok($$select public.toon_create_tier_comment('8f000000-0000-4000-8000-000000000001','7f000000-0000-4000-8000-000000000001',2,null,'root-secret',true,true)$$,'Identical lost-reply retry is idempotent');
select is(jsonb_array_length(public.toon_list_tier_comments('7f000000-0000-4000-8000-000000000001',2)->'items'),1,'Retry never duplicates a comment');
select throws_ok($$select public.toon_create_tier_comment('8f000000-0000-4000-8000-000000000001','7f000000-0000-4000-8000-000000000001',2,null,'changed',true,true)$$,'P0001','CONFLICT','Changed retry cannot overwrite existing row');
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000003',2,null,'unlisted',false,true)$$,'P0001','NOT_FOUND','Unlisted has no discussion');
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000004',2,null,'private',false,true)$$,'P0001','NOT_FOUND','Private has no discussion');
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000001',1,null,'stale',false,true)$$,'P0001','CONFLICT','Lifecycle expectation is required');
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000001',2,null,repeat('가',1001),false,true)$$,'P0001','VALIDATION_ERROR','Unicode limit is enforced in DB');
select throws_ok($$select public.toon_report_tier_comment('8f000000-0000-4000-8000-000000000001',2,1,'spam','본인 댓글 신고는 거절해야 합니다.')$$,'P0001','FORBIDDEN','Self report denied');
select set_config('request.jwt.claims','{"sub":"3f000000-0000-4000-8000-000000000003","session_id":"4f000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.toon_create_tier_comment('8f000000-0000-4000-8000-000000000002','7f000000-0000-4000-8000-000000000001',2,'8f000000-0000-4000-8000-000000000001','reply-secret',false,true)$$,'One-level reply succeeds');
select lives_ok($$select public.toon_create_tier_comment('8f000000-0000-4000-8000-000000000003','7f000000-0000-4000-8000-000000000002',2,null,'tier-spoiler-secret',false,true)$$,'Public spoiler tier accepts comments');
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000001',2,'8f000000-0000-4000-8000-000000000002','nested',false,true)$$,'P0001','NOT_FOUND','Replies cannot have replies');
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000002',2,'8f000000-0000-4000-8000-000000000001','cross-target',false,true)$$,'P0001','NOT_FOUND','Parent belongs to the same tier');
select is(public.toon_get_my_tier_comment('8f000000-0000-4000-8000-000000000001',2,1),null::jsonb,'Other owner editor is unavailable');
select lives_ok($$select public.toon_report_tier_comment('8f000000-0000-4000-8000-000000000001',2,1,'spam','테스트 신고를 접수하는 충분한 설명입니다.')$$,'Visible nonself comment can be reported');
select lives_ok($$select public.toon_report_tier_comment('8f000000-0000-4000-8000-000000000001',2,1,'spam','동일한 대기 신고는 중복 접수하지 않습니다.')$$,'Pending report retry is idempotent');
select is(jsonb_array_length(public.toon_list_tier_comment_reports(1,true)->'items'),1,'Reporter sees only own pending report');
select throws_ok($$select public.toon_list_tier_comment_reports(1,false)$$,'P0001','FORBIDDEN','Normal user cannot read moderation queue');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000001',2)->'body','null'::jsonb,'Root spoiler absent from initial DTO');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2)->'body','null'::jsonb,'Root spoiler is inherited by nonspoiler reply');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000003',2)->'body','null'::jsonb,'Tier spoiler is inherited');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2,1,true)->>'body','reply-secret','Explicit current reveal can show public reply');
select throws_ok($$select public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2,null,true)$$,'P0001','VALIDATION_ERROR','Reveal requires revision');
select throws_ok($$select public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2,2,true)$$,'P0001','CONFLICT','Stale reply revision is denied');
select throws_ok($$select public.toon_list_tier_comments('7f000000-0000-4000-8000-000000000001',2,null,0)$$,'P0001','VALIDATION_ERROR','Bounded page validation');
reset role;
select throws_ok($$update public.toon_comments set parent_id = '8f000000-0000-4000-8000-000000000003' where id = '8f000000-0000-4000-8000-000000000002'$$,'P0001','VALIDATION_ERROR','Even privileged reparenting is rejected');
select set_config('request.jwt.claims','{"sub":"3f000000-0000-4000-8000-000000000004","session_id":"4f000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_moderation_tier_comment_snapshot('8f000000-0000-4000-8000-000000000001')->'body','null'::jsonb,'Moderator initial DTO is masked too');
select is(public.toon_moderation_tier_comment_snapshot('8f000000-0000-4000-8000-000000000001',1,true)->>'body','root-secret','Role-gated explicit review');
select set_config('comment.report',(public.toon_list_tier_comment_reports(1,false)->'items'->0->>'id'),true);
select lives_ok($$select public.toon_moderate_tier_comment('8f000000-0000-4000-8000-000000000001',1,'hide','운영 숨김',current_setting('comment.report')::uuid,'신고 내용을 확인하고 숨겼어요.')$$,'Hide, report result, and audit are atomic');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2),null::jsonb,'Hidden root hides replies');
select lives_ok($$select public.toon_moderate_tier_comment('8f000000-0000-4000-8000-000000000001',2,'restore','운영 복구',null,'')$$,'Moderator restores root');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2)->'body','null'::jsonb,'Restored reply remains spoiler masked');
select throws_ok($$select public.toon_moderate_tier_comment('8f000000-0000-4000-8000-000000000001',1,'hide','오래된 조치',null,'')$$,'P0001','CONFLICT','Stale moderation cannot overwrite');
reset role;
select set_config('request.jwt.claims','{"sub":"3f000000-0000-4000-8000-000000000002","session_id":"4f000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_update_tier_comment('8f000000-0000-4000-8000-000000000001',2,3,'root-edited',false,true)$$,'Owner edits with current revision');
select throws_ok($$select public.toon_update_tier_comment('8f000000-0000-4000-8000-000000000001',2,3,'lost update',false,true)$$,'P0001','CONFLICT','Stale owner edit is rejected');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2)->>'body','reply-secret','Removing root spoiler allows current nonspoiler reply');
select lives_ok($$select public.toon_delete_tier_comment('8f000000-0000-4000-8000-000000000001',4,true)$$,'Delete scrubs root body');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000001',2)->'author','null'::jsonb,'Deleted root has no author DTO');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000001',2)->>'replyCount','1','Tombstone retains existing reply context');
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000001',2,'8f000000-0000-4000-8000-000000000001','new reply',false,true)$$,'P0001','NOT_FOUND','Deleted root rejects new replies');
reset role;
select is((select body from public.toon_comments where id = '8f000000-0000-4000-8000-000000000001'),null::text,'Stored deleted text is scrubbed');
select set_config('request.jwt.claims','{"sub":"3f000000-0000-4000-8000-000000000003","session_id":"4f000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_set_user_block('3f000000-0000-4000-8000-000000000002',true)$$,'Block root author');
select is(public.toon_get_tier_comment('8f000000-0000-4000-8000-000000000002',2),null::jsonb,'Blocked root hides whole thread for viewer');
select lives_ok($$select public.toon_set_user_block('3f000000-0000-4000-8000-000000000002',false)$$,'Unblock preserves existing reply');
reset role;
update public.toon_tier_lists set visibility = 'private',published_version = null,version = 3 where id = '7f000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.toon_list_tier_comments('7f000000-0000-4000-8000-000000000001',3),null::jsonb,'Withdrawal revokes all public discussion');
select throws_ok($$select public.toon_update_tier_comment('8f000000-0000-4000-8000-000000000002',3,1,'private edit',false,true)$$,'P0001','NOT_FOUND','Owner cannot edit discussion on private tier');
select lives_ok($$select public.toon_delete_tier_comment('8f000000-0000-4000-8000-000000000002',1,true)$$,'Own body removal still works after withdrawal');
select is(public.toon_list_tier_comment_reports(1,true)->'items'->0->>'status','resolved','Reporter retains private result after withdrawal');
select set_config('request.jwt.claims','{"sub":"3f000000-0000-4000-8000-000000000004","session_id":"4f000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is(public.toon_moderation_tier_comment_snapshot('8f000000-0000-4000-8000-000000000001',5,true)->'body','null'::jsonb,'Withdrawn/deleted text never returned to moderator');
reset role;
delete from public.toon_profiles where id = '3f000000-0000-4000-8000-000000000003';
select is((select user_id from public.toon_comments where id = '8f000000-0000-4000-8000-000000000003'),null::uuid,'Profile hard deletion anonymizes comment');
select is((select body from public.toon_comments where id = '8f000000-0000-4000-8000-000000000003'),null::text,'Profile hard deletion also scrubs text');
delete from auth.sessions where id = '4f000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"3f000000-0000-4000-8000-000000000002","session_id":"4f000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_create_tier_comment(gen_random_uuid(),'7f000000-0000-4000-8000-000000000002',2,null,'revoked',false,true)$$,'P0001','AUTH_REQUIRED','Revoked real session cannot create');
select throws_ok($$select public.toon_delete_tier_comment('8f000000-0000-4000-8000-000000000001',5,true)$$,'P0001','AUTH_REQUIRED','Revoked session cannot delete');
reset role;
select * from finish();
rollback;
