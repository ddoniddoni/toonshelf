-- Local rollback fixtures only. Written, not executed/applied. No query-plan,
-- multi-session, real Auth, browser, or large-data performance verification.
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
 select ('3d000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-discovery-' || n || '@example.test',now(),false,'{"role":"admin"}' from generate_series(1,6) n;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('4d000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '3d000000-%';
update public.profiles set username = 'tier_discovery_' || right(id::text,1),display_name = '[테스트] 탐색',onboarding_completed_at = now() where id::text like '3d000000-%';
update private.user_access set status = 'active',role = 'user' where user_id::text like '3d000000-%';
insert into private.consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '3d000000-%';
create function public.test_discovery_payload(p_n integer) returns jsonb language sql set search_path = '' as $$
 select jsonb_build_object('title',case p_n when 4 then 'spoiler-title-secret' when 5 then 'unlisted-title-secret' when 6 then 'private-title-secret'
  when 7 then 'hidden-title-secret' when 8 then 'inactive-title-secret' else '[테스트] 탐색 표 ' || p_n end,
  'description','published-description','tags',case when p_n = 1 then '["판타지","100%_&?","Fantasy"]'::jsonb when p_n = 4 then '["spoiler-tag-secret"]'::jsonb
   when p_n >= 11 then '["page-set"]'::jsonb else '["판타지"]'::jsonb end,
  'rows','[{"id":"6d000000-0000-4000-8000-000000000001","label":"S","colorToken":"S","canonicalTier":"S"},{"id":"6d000000-0000-4000-8000-000000000002","label":"F","colorToken":"F","canonicalTier":"F"}]'::jsonb,'placements','[]'::jsonb);
$$;
create function public.test_discovery_item(p_result jsonb,p_id uuid) returns jsonb language sql set search_path = '' as $$
 select value from jsonb_array_elements(p_result->'items') where value->>'id' = p_id::text;
$$;
revoke all on function public.test_discovery_payload(integer),public.test_discovery_item(jsonb,uuid) from public;
grant execute on function public.test_discovery_item(jsonb,uuid) to anon,authenticated;
-- Direct fixture setup is rollback-only; production writes use their RPCs.
insert into public.tier_lists(id,user_id)
 select ('7d000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  case when n = 8 then '3d000000-0000-4000-8000-000000000004'::uuid else '3d000000-0000-4000-8000-000000000001'::uuid end
 from (select generate_series(1,8) n union all select generate_series(11,23)) fixtures;
insert into public.tier_list_drafts(tier_list_id,title,description,tags,rows,placements)
 select id,'draft-title-secret','draft-description-secret',array['draft-tag-secret'],public.test_discovery_payload(1)->'rows','[]'::jsonb from public.tier_lists where id::text like '7d000000-%';
insert into public.tier_list_publications(tier_list_id,version,payload,is_spoiler,published_at)
 select id,1,public.test_discovery_payload(right(id::text,12)::integer),right(id::text,12)::integer = 4,
  case when right(id::text,12)::integer >= 11 then now()-interval '20 days' when right(id::text,12)::integer = 1 then now()-interval '1 hour'
   when right(id::text,12)::integer in (2,4) then now()-interval '2 hours' else now()-interval '3 hours' end
 from public.tier_lists where id::text like '7d000000-%';
update public.tier_list_publications set payload = jsonb_set(jsonb_set(payload,'{tags}','["old-tag-secret"]'),'{title}','"old-title-secret"') where tier_list_id = '7d000000-0000-4000-8000-000000000002';
insert into public.tier_list_publications(tier_list_id,version,payload,is_spoiler,published_at)
 values('7d000000-0000-4000-8000-000000000002',2,public.test_discovery_payload(2),false,now()-interval '2 hours');
update public.tier_lists set version = 2,publication_counter = case when id = '7d000000-0000-4000-8000-000000000002' then 2 else 1 end,
 published_version = case when id = '7d000000-0000-4000-8000-000000000006' then null when id = '7d000000-0000-4000-8000-000000000002' then 2 else 1 end,
 visibility = case when id = '7d000000-0000-4000-8000-000000000005' then 'unlisted'::public.tier_visibility when id = '7d000000-0000-4000-8000-000000000006' then 'private'::public.tier_visibility else 'public'::public.tier_visibility end,
 moderation_status = case when id = '7d000000-0000-4000-8000-000000000007' then 'hidden' else 'visible' end where id::text like '7d000000-%';
update private.user_access set status = 'suspended' where user_id in ('3d000000-0000-4000-8000-000000000004','3d000000-0000-4000-8000-000000000005');
insert into public.reactions(user_id,tier_list_id,created_at) values
 ('3d000000-0000-4000-8000-000000000002','7d000000-0000-4000-8000-000000000001',now()-interval '8 days'),
 ('3d000000-0000-4000-8000-000000000003','7d000000-0000-4000-8000-000000000001',now()-interval '9 days'),
 ('3d000000-0000-4000-8000-000000000006','7d000000-0000-4000-8000-000000000001',now()-interval '10 days'),
 ('3d000000-0000-4000-8000-000000000002','7d000000-0000-4000-8000-000000000002',now()-interval '1 day'),
 ('3d000000-0000-4000-8000-000000000003','7d000000-0000-4000-8000-000000000002',now()-interval '168 hours'),
 ('3d000000-0000-4000-8000-000000000002','7d000000-0000-4000-8000-000000000003',now()+interval '1 minute'),
 ('3d000000-0000-4000-8000-000000000001','7d000000-0000-4000-8000-000000000003',now()),
 ('3d000000-0000-4000-8000-000000000005','7d000000-0000-4000-8000-000000000003',now()),
 ('3d000000-0000-4000-8000-000000000002','7d000000-0000-4000-8000-000000000004',now()),
 ('3d000000-0000-4000-8000-000000000003','7d000000-0000-4000-8000-000000000004',now());
select ok(has_function_privilege('anon','public.search_public_tiers(text,text,integer)','EXECUTE'),'Anonymous limited discovery is allowed');
select ok(not has_function_privilege('authenticated','private.tier_like_metrics(uuid)','EXECUTE'),'No direct aggregate bypass');
select ok(not has_function_privilege('authenticated','private.tier_discovery_card(uuid,bigint,bigint)','EXECUTE'),'Clients cannot inject counts into a private card');
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.search_public_tiers('latest',null,1)->'items'->0->>'id','7d000000-0000-4000-8000-000000000001','Latest uses publication time');
select is(public.search_public_tiers('popular',null,1)->'items'->0->>'id','7d000000-0000-4000-8000-000000000002','Recent reactions outrank larger old totals');
select is(public.search_public_tiers('popular',null,1)->'items'->1->>'id','7d000000-0000-4000-8000-000000000004','Equal recent count/time uses ascending ID');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000001')->>'likeCount','3','All-time count is separate');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000001')->>'recentLikeCount','0','Older than seven days contributes no recent signal');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000002')->>'recentLikeCount','2','Inclusive seven-day boundary');
select is(public.test_discovery_item(public.search_public_tiers('latest',null,1),'7d000000-0000-4000-8000-000000000003')->>'likeCount','1','Self/inactive rows excluded even in malformed fixtures');
select is(public.test_discovery_item(public.search_public_tiers('latest',null,1),'7d000000-0000-4000-8000-000000000003')->>'recentLikeCount','0','Future timestamps cannot boost recent rank');
select ok(public.search_public_tiers('popular',null,1)::text !~ 'spoiler-title-secret|spoiler-tag-secret|old-title-secret|old-tag-secret|draft-|unlisted-title-secret|private-title-secret|hidden-title-secret|inactive-title-secret|user_id|placements|token','Limited cards contain no hidden content or reaction identities');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000004')->'tags','null'::jsonb,'Spoiler tags are unavailable metadata');
select is(jsonb_array_length(public.search_public_tiers('latest','spoiler-tag-secret',1)->'items'),0,'Hidden spoiler tags cannot affect search membership');
select is(jsonb_array_length(public.search_public_tiers('latest','draft-tag-secret',1)->'items'),0,'Unpublished draft tags are not searched');
select is(jsonb_array_length(public.search_public_tiers('latest','old-tag-secret',1)->'items'),0,'Retained old publication tags are not searched');
select is(jsonb_array_length(public.search_public_tiers('latest','판타지',1)->'items'),3,'Only current accessible non-spoiler tags match');
select is(jsonb_array_length(public.search_public_tiers('latest','100%_&?',1)->'items'),1,'JSON containment treats punctuation literally');
select is(jsonb_array_length(public.search_public_tiers('latest','판',1)->'items'),0,'No substring match');
select is(jsonb_array_length(public.search_public_tiers('latest','fantasy',1)->'items'),0,'Case-sensitive exact tags');
select is(jsonb_array_length(public.search_public_tiers('latest','Fantasy',1)->'items'),1,'Exact case matches');
select is(jsonb_array_length(public.search_public_tiers('latest','page-set',1)->'items'),12,'Twelve cards per page');
select is(public.search_public_tiers('latest','page-set',1)->>'hasNext','true','Thirteenth card signals a next page');
select is(jsonb_array_length(public.search_public_tiers('latest','page-set',2)->'items'),1,'Filters retained on second page');
select is(public.search_public_tiers('latest','page-set',2)->'items'->0->>'id','7d000000-0000-4000-8000-000000000023','Stable ID tie-break avoids duplicate boundary items');
select is(public.search_public_tiers('popular','page-set',2)->>'hasNext','false','Zero recent signal still supports bounded pages');
select is(public.list_public_tiers(1),public.search_public_tiers('latest',null,1),'Legacy latest RPC delegates to the same projection');
select is(public.search_public_tiers('latest','',1),public.search_public_tiers('latest',null,1),'Empty form tag means no filter');
select is(jsonb_array_length(public.search_public_tiers('latest',repeat('😀',20),1)->'items'),0,'Unicode limit counts code points');
select throws_ok($$select public.search_public_tiers('latest',repeat('😀',21),1)$$,'P0001','VALIDATION_ERROR','Overlong tags are denied');
select throws_ok($$select public.search_public_tiers('rating',null,1)$$,'P0001','VALIDATION_ERROR','Invalid sort is denied');
select throws_ok($$select public.search_public_tiers(null,null,1)$$,'P0001','VALIDATION_ERROR','Null sort is denied');
select throws_ok($$select public.search_public_tiers('latest',null,0)$$,'P0001','VALIDATION_ERROR','Zero page is denied');
select throws_ok($$select public.search_public_tiers('latest',null,1001)$$,'P0001','VALIDATION_ERROR','Unbounded page is denied');
select is(public.search_public_tiers('latest',null,1000)->'items','[]'::jsonb,'Valid empty high page has no invented items');
reset role;
select set_config('request.jwt.claims','{"sub":"3d000000-0000-4000-8000-000000000002","session_id":"4d000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.set_tier_like('7d000000-0000-4000-8000-000000000001',2,true)$$,'Repeated desired true is accepted');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000001')->>'recentLikeCount','0','Idempotent true does not refresh an old timestamp');
select lives_ok($$select public.set_tier_like('7d000000-0000-4000-8000-000000000001',2,false)$$,'Cancel old reaction');
select lives_ok($$select public.set_tier_like('7d000000-0000-4000-8000-000000000001',2,true)$$,'Explicit new reaction gets current creation time');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000001')->>'recentLikeCount','1','A newly created reaction is recent');
select lives_ok($$select public.set_user_block('3d000000-0000-4000-8000-000000000003',true)$$,'Viewer blocks another reactor');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000002')->>'recentLikeCount','1','Viewer-specific blocks affect ranking signal');
select is(public.test_discovery_item(public.search_public_tiers('popular',null,1),'7d000000-0000-4000-8000-000000000002')->>'likeCount',public.get_tier_like_state('7d000000-0000-4000-8000-000000000002')->>'likeCount','Discovery and detail share validity rules');
select lives_ok($$select public.set_user_block('3d000000-0000-4000-8000-000000000001',true)$$,'Viewer blocks author');
select is(public.search_public_tiers('popular',null,1)->'items','[]'::jsonb,'Blocked author never enters ranking candidates');
select is(public.search_public_tiers('popular',null,1)->>'hasNext','false','Hidden targets do not inflate next-page state');
select lives_ok($$select public.set_user_block('3d000000-0000-4000-8000-000000000001',false)$$,'Viewer unblocks author');
reset role;
delete from private.consent_records where user_id = '3d000000-0000-4000-8000-000000000001' and policy_kind = 'age_14';
set local role authenticated;
select is(public.search_public_tiers('latest',null,1)->'items','[]'::jsonb,'Author missing current consent is excluded');
reset role;
insert into private.consent_records(user_id,policy_kind,version) values('3d000000-0000-4000-8000-000000000001','age_14','2026-10-02-preview');
update public.tier_lists set deleted_at = now() where id = '7d000000-0000-4000-8000-000000000003';
set local role authenticated;
select is(public.test_discovery_item(public.search_public_tiers('latest',null,1),'7d000000-0000-4000-8000-000000000003'),null::jsonb,'Soft-deleted target cannot rank');
reset role;
select * from finish();
rollback;
