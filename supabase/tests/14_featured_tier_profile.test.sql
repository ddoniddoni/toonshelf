-- Rollback fixtures, written only. No DB/Auth/RLS/concurrency execution.
-- Separate-session select vs withdraw/hide/delete and two-tab ABA races still
-- require explicit execution approval; this file does not prove lock behavior.
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
 select ('3e000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'featured-' || n || '@example.test',now(),false,'{}' from generate_series(1,3) n;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('4e000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '3e000000-%';
update public.profiles set username = 'featured_' || right(id::text,1),display_name = '[테스트] 대표',onboarding_completed_at = now() where id::text like '3e000000-%';
update private.user_access set status = 'active',role = case when right(user_id::text,1) = '3' then 'admin'::public.user_role else 'user'::public.user_role end where user_id::text like '3e000000-%';
insert into private.consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '3e000000-%';
create function public.test_featured_payload(p_title text) returns jsonb language sql set search_path = '' as $$
 select jsonb_build_object('title',p_title,'description','body-secret','tags','["theme"]'::jsonb,
 'rows','[{"id":"6e000000-0000-4000-8000-000000000001","label":"S","colorToken":"S","canonicalTier":"S"},{"id":"6e000000-0000-4000-8000-000000000002","label":"F","colorToken":"F","canonicalTier":"F"}]'::jsonb,'placements','[]'::jsonb);
$$;
revoke all on function public.test_featured_payload(text) from public,anon,authenticated;
insert into public.tier_lists(id,user_id)
 select ('7e000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 case when n = 4 then '3e000000-0000-4000-8000-000000000002'::uuid else '3e000000-0000-4000-8000-000000000001'::uuid end from generate_series(1,4) n;
insert into public.tier_list_drafts(tier_list_id,title,rows,placements)
 select id,'draft-secret',public.test_featured_payload('draft-secret')->'rows','[]'::jsonb from public.tier_lists where id::text like '7e000000-%';
insert into public.tier_list_publications(tier_list_id,version,payload,is_spoiler)
 select id,1,public.test_featured_payload(case when right(id::text,1) = '2' then 'spoiler-secret' else 'published-old' end),right(id::text,1) = '2'
 from public.tier_lists where id::text like '7e000000-%';
update public.tier_lists set publication_counter = 1,version = 2,
 visibility = case when right(id::text,1) = '3' then 'private'::public.tier_visibility else 'public'::public.tier_visibility end,
 published_version = case when right(id::text,1) = '3' then null else 1 end where id::text like '7e000000-%';
select ok(not has_column_privilege('anon','public.profiles','featured_tier_list_id','SELECT'),'Anon cannot read raw featured pointer');
select ok(not has_column_privilege('authenticated','public.profiles','featured_tier_version','SELECT'),'Revision is owner RPC only');
select ok(has_column_privilege('anon','public.profiles','username','SELECT'),'Existing profile columns retain grants');
select ok(not has_function_privilege('anon','public.set_featured_tier(uuid,bigint,bigint)','EXECUTE'),'Anon cannot mutate');
select ok(not has_function_privilege('authenticated','private.featured_tier_state(uuid)','EXECUTE'),'No arbitrary-owner helper access');
select set_config('request.jwt.claims','{"sub":"3e000000-0000-4000-8000-000000000001","session_id":"4e000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_my_featured_tier_state(),' {"id":null,"version":1}'::jsonb,'Initial selection is unset');
select throws_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000004',2,1)$$,'P0001','NOT_FOUND','Other owner cannot be selected');
select throws_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000003',2,1)$$,'P0001','FEATURED_UNAVAILABLE','Private cannot be selected');
select throws_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000001',1,1)$$,'P0001','CONFLICT','Stale lifecycle rejected');
select throws_ok($$select public.set_featured_tier(null,2,1)$$,'P0001','VALIDATION_ERROR','Unset must have null tier version');
select is(public.set_featured_tier('7e000000-0000-4000-8000-000000000001',2,1)->>'version','2','Selection advances revision');
select is(public.set_featured_tier('7e000000-0000-4000-8000-000000000001',2,2)->>'version','2','Idempotent selection preserves revision');
select is(public.set_featured_tier('7e000000-0000-4000-8000-000000000002',2,2)->>'version','3','Replacement advances revision');
select throws_ok($$select public.set_featured_tier(null,null,2)$$,'P0001','CONFLICT','Old page cannot clear replacement');
select is(public.set_featured_tier('7e000000-0000-4000-8000-000000000001',2,3)->>'version','4','ABA selection has a new revision');
select throws_ok($$select public.set_featured_tier(null,null,2)$$,'P0001','CONFLICT','Matching old ID cannot bypass ABA revision');
reset role;
insert into public.tier_list_publications(tier_list_id,version,payload,is_spoiler)
 values('7e000000-0000-4000-8000-000000000001',2,public.test_featured_payload('published-current'),false);
update public.tier_lists set published_version = 2,publication_counter = 2,version = 3 where id = '7e000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.get_public_featured_tier('featured_1')->>'title','published-current','Current publication replaces old card without reselection');
select ok(public.get_public_featured_tier('featured_1')::text !~ 'draft-secret|published-old|body-secret|featuredVersion|featured_tier|token|placements','No draft/history/body/revision/capability in public card');
select is(public.get_public_featured_tier('missing_user'),null::jsonb,'No selection has no fabricated card');
select throws_ok($$select public.get_public_featured_tier('../bad')$$,'P0001','VALIDATION_ERROR','Username is validated in DB');
reset role;
select set_config('request.jwt.claims','{"sub":"3e000000-0000-4000-8000-000000000001","session_id":"4e000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.withdraw_tier_publication('7e000000-0000-4000-8000-000000000001',3,true)$$,'Actual withdrawal RPC clears featured pointer');
select is(public.get_my_featured_tier_state(),' {"id":null,"version":5}'::jsonb,'Cleanup advances revision atomically');
reset role;
update public.tier_lists set visibility = 'public',published_version = 2,version = 5 where id = '7e000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.get_public_featured_tier('featured_1'),null::jsonb,'Republishing does not reselect');
select lives_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000001',5,5)$$,'Owner explicitly reselects');
select set_config('featured.preview',public.preview_tier_publication('7e000000-0000-4000-8000-000000000001')::text,true);
select lives_ok($$select public.publish_tier_list('7e000000-0000-4000-8000-000000000001',1,5,current_setting('featured.preview')::jsonb->>'fingerprint','unlisted',true,
 jsonb_build_object('hash',repeat('a',64),'ciphertext',repeat('b',118),'nonce',repeat('c',24)),true)$$,'Actual unlisted publication clears representative');
select is(public.get_my_featured_tier_state(),' {"id":null,"version":7}'::jsonb,'Unlisted transition clears and advances revision');
select throws_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000001',6,7)$$,'P0001','FEATURED_UNAVAILABLE','Unlisted is never eligible');
select lives_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000002',2,7)$$,'Own public spoiler tier can be selected');
select is(public.get_public_featured_tier('featured_1')->'title','null'::jsonb,'Spoiler title is not public metadata');
select is(public.get_public_featured_tier('featured_1')->'tags','null'::jsonb,'Spoiler tags are not public metadata');
reset role;
select set_config('request.jwt.claims','{"sub":"3e000000-0000-4000-8000-000000000002","session_id":"4e000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_my_featured_tier_state()->'id','null'::jsonb,'Owner state cannot read another owner');
select lives_ok($$select public.set_user_block('3e000000-0000-4000-8000-000000000001',true)$$,'Viewer blocks author');
select is(public.get_public_featured_tier('featured_1'),null::jsonb,'Blocked profile has no representative card');
select lives_ok($$select public.set_user_block('3e000000-0000-4000-8000-000000000001',false)$$,'Viewer unblocks author');
reset role;
update private.user_access set status = 'suspended' where user_id = '3e000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.get_public_featured_tier('featured_1'),null::jsonb,'Inactive author is rechecked at read');
reset role;
update private.user_access set status = 'active' where user_id = '3e000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"3e000000-0000-4000-8000-000000000003","session_id":"4e000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.moderate_tier_publication('7e000000-0000-4000-8000-000000000002',2,'hide','운영 숨김',null,'')$$,'Actual moderation clears representative');
select is(public.get_public_featured_tier('featured_1'),null::jsonb,'Hidden target is absent');
select lives_ok($$select public.moderate_tier_publication('7e000000-0000-4000-8000-000000000002',3,'restore','운영 복구',null,'')$$,'Moderator restores tier');
select is(public.get_public_featured_tier('featured_1'),null::jsonb,'Restoration never restores selection');
reset role;
select set_config('request.jwt.claims','{"sub":"3e000000-0000-4000-8000-000000000001","session_id":"4e000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_my_featured_tier_state()->>'version','9','Moderation cleanup increments once');
select lives_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000002',4,9)$$,'Owner explicitly selects restored tier');
select lives_ok($$select public.delete_tier_draft('7e000000-0000-4000-8000-000000000002',1,true)$$,'Actual soft delete clears selection');
select is(public.get_my_featured_tier_state(),' {"id":null,"version":11}'::jsonb,'Soft delete advances profile revision');
select throws_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000004',2,11)$$,'P0001','NOT_FOUND','Foreign target remains forbidden');
reset role;
update public.tier_lists set visibility = 'public',published_version = 1,version = 3 where id = '7e000000-0000-4000-8000-000000000003';
set local role authenticated;
select lives_ok($$select public.set_featured_tier('7e000000-0000-4000-8000-000000000003',3,11)$$,'Owner selects a remaining public tier');
select throws_ok($$select featured_tier_list_id from public.profiles where username = 'featured_1'$$,'42501',null,'Raw pointer cannot bypass current-public RPC');
reset role;
delete from public.tier_lists where id = '7e000000-0000-4000-8000-000000000003';
set local role authenticated;
select is(public.get_my_featured_tier_state(),' {"id":null,"version":13}'::jsonb,'FK hard delete clears pointer and advances revision');
select is(public.set_featured_tier(null,null,13)->>'version','13','Repeated unset is idempotent');
reset role;
delete from auth.sessions where id = '4e000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.set_featured_tier(null,null,13)$$,'P0001','AUTH_REQUIRED','Revoked real session cannot write');
select throws_ok($$select public.get_my_featured_tier_state()$$,'P0001','AUTH_REQUIRED','Revoked real session cannot read owner revision');
reset role;
select * from finish();
rollback;
