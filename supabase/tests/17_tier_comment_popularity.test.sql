-- Local rollback fixtures, WRITTEN ONLY. Never run against the shared project.
-- No migration/Auth/RLS/permission flow or concurrency test has been executed.
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
 select ('31000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'popularity-'||n||'@example.test',now(),false,'{}' from generate_series(1,8) n;
insert into public.toon_profiles(id) select id from auth.users where id::text like '31000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '31000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id::text like '31000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('41000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '31000000-0000-4000-8000-%';
update public.toon_profiles set username='popularity_'||right(id::text,1),display_name='[test] popularity',onboarding_completed_at=now()
 where id::text like '31000000-0000-4000-8000-%';
update toon_private.toon_user_access set status=case when right(user_id::text,1)='5' then 'suspended'::public.toon_access_status else 'active'::public.toon_access_status end
 where user_id::text like '31000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k
 where p.id::text like '31000000-0000-4000-8000-%' and not(right(p.id::text,1)='6' and k='age_14');

-- 13 visible/public rows: a second page exists. A is older than B; ties use ID.
insert into public.toon_tier_lists(id,user_id)
 select ('71000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'31000000-0000-4000-8000-000000000001' from generate_series(1,17) n;
insert into public.toon_tier_list_publications(tier_list_id,version,payload,is_spoiler,published_at)
 select id,1,jsonb_build_object('title','[test] popularity tier','description','tier-body-secret',
 'tags',case when right(id::text,2)::integer<=3 then '["Fantasy"]'::jsonb when right(id::text,2)::integer=4 then '["spoiler-tag"]'::jsonb else '[]'::jsonb end,
 'rows','[{"id":"61000000-0000-4000-8000-000000000001","label":"S","colorToken":"S","canonicalTier":"S"},{"id":"61000000-0000-4000-8000-000000000002","label":"F","colorToken":"F","canonicalTier":"F"}]'::jsonb,'placements','[]'::jsonb),
 right(id::text,2)::integer=4,now()-case when right(id::text,2)::integer=1 then interval '2 days' else interval '1 day' end
 from public.toon_tier_lists where id::text like '71000000-0000-4000-8000-%';
update public.toon_tier_lists set version=2,publication_counter=1,published_version=case when right(id::text,2)::integer=5 then null else 1 end,
 visibility=case right(id::text,2)::integer when 5 then 'private'::public.toon_tier_visibility when 6 then 'unlisted'::public.toon_tier_visibility else 'public'::public.toon_tier_visibility end,
 moderation_status=case when right(id::text,2)::integer=7 then 'hidden' else 'visible' end,
 deleted_at=case when right(id::text,2)::integer=8 then now() else null end
 where id::text like '71000000-0000-4000-8000-%';

-- A: 1 recent valid like, 1 old valid like, 1 invalid suspended-user like.
-- B: 3 recent likes and 1 old like. Its larger like count must not beat A.
insert into public.toon_reactions(id,user_id,tier_list_id,created_at)
 select ('91000000-0000-4000-8000-'||lpad(v.n::text,12,'0'))::uuid,
 ('31000000-0000-4000-8000-'||lpad(v.who::text,12,'0'))::uuid,
 ('71000000-0000-4000-8000-'||lpad(v.tier::text,12,'0'))::uuid,
 now()-case when v.old then interval '169 hours' else interval '1 hour' end
 from (values(1,2,1,false),(2,4,1,true),(3,5,1,false),(4,2,2,false),(5,3,2,false),(6,4,2,false),(7,8,2,true)) v(n,who,tier,old);

-- Visible roots, old/future roots, boundary times, deleted/hidden/invalid roots.
insert into public.toon_comments(id,user_id,tier_list_id,body,moderation_status,deleted_at,created_at,updated_at)
 select ('81000000-0000-4000-8000-'||lpad(v.n::text,12,'0'))::uuid,
 case when v.who is null then null else ('31000000-0000-4000-8000-'||lpad(v.who::text,12,'0'))::uuid end,
 '71000000-0000-4000-8000-000000000001',case when v.deleted then null else 'commenter-body-secret' end,v.moderation,
 case when v.deleted then now() else null end,v.created,now()
 from (values
  (1,2,'visible',false,now()-interval '1 hour'),(2,2,'visible',false,now()-interval '2 hours'),
  (4,1,'visible',false,now()-interval '1 hour'),(5,4,'visible',true,now()-interval '1 hour'),
  (6,5,'visible',false,now()-interval '1 hour'),(7,6,'visible',false,now()-interval '1 hour'),
  (8,4,'visible',false,now()-interval '169 hours'),(9,4,'hidden',false,now()-interval '1 hour'),
  (10,4,'visible',false,now()+interval '1 minute'),(11,4,'visible',false,now()-interval '168 hours'),
  (12,4,'visible',false,now()),(13,8,'visible',false,now()-interval '169 hours'),
  (15,8,'hidden',false,now()-interval '169 hours'),(17,null,'visible',true,now()-interval '169 hours')
 ) v(n,who,moderation,deleted,created);
insert into public.toon_comments(id,user_id,tier_list_id,parent_id,body,created_at)
 select ('81000000-0000-4000-8000-'||lpad(v.n::text,12,'0'))::uuid,
 ('31000000-0000-4000-8000-'||lpad(v.who::text,12,'0'))::uuid,'71000000-0000-4000-8000-000000000001',
 ('81000000-0000-4000-8000-'||lpad(v.parent::text,12,'0'))::uuid,'reply-body-secret',now()-interval '1 hour'
 from (values(3,3,1),(14,2,13),(16,8,15),(18,3,17),(20,7,13)) v(n,who,parent);

create function public.toon_test_popularity_item(p_list jsonb,p_id uuid) returns jsonb language sql set search_path='' as $$
 select value from jsonb_array_elements(p_list->'items') where value->>'id'=p_id::text;
$$;
select ok(not has_table_privilege('anon','public.toon_comments','SELECT'),'Raw comments stay private to RPCs');
select ok(not has_function_privilege('authenticated','toon_private.toon_tier_popularity_metrics(uuid)','EXECUTE'),'Private metrics cannot be called directly');
select ok(not has_function_privilege('service_role','toon_private.toon_tier_popularity_card(uuid,bigint,bigint,bigint)','EXECUTE'),'New private helper has no inherited service execute grant');
set local role anon;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'id','71000000-0000-4000-8000-000000000001','Unique commenters move A ahead of B despite fewer likes and an older publication');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->1->>'id','71000000-0000-4000-8000-000000000002','Like-only B follows A');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->2->>'id','71000000-0000-4000-8000-000000000003','Equal zero scores and publication times use ascending ID');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'likeCount','2','All-time valid likes are separate from popularity');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentLikeCount','1','Old and suspended-user likes do not inflate recent count');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','4','Deduplicate roots and replies; exclude self, deleted, hidden, future, old, suspended and missing-consent comments');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'popularityScore','9','Score is 1 recent like plus 2 times 4 participants');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->2->>'popularityScore','0','Empty activity produces a real zero');
select is(jsonb_array_length(public.toon_search_public_tiers('popular',null,1)->'items'),12,'First page remains bounded');
select is(public.toon_search_public_tiers('popular',null,1)->>'hasNext','true','Thirteenth visible row provides next-page state');
select is(public.toon_search_public_tiers('popular',null,2)->'items'->0->>'id','71000000-0000-4000-8000-000000000017','Second page preserves deterministic score ties');
select is(public.toon_search_public_tiers('popular',null,2)->>'hasNext','false','Last page has no extra item');
select is(public.toon_search_public_tiers('latest',null,2)->'items'->0->>'popularityScore','9','Latest pagination returns the same computed metrics without popularity ordering');
select is(public.toon_list_public_tiers(2),public.toon_search_public_tiers('latest',null,2),'Existing list RPC keeps its latest semantics');
select is(jsonb_array_length(public.toon_search_public_tiers('popular','Fantasy',1)->'items'),3,'Literal tag filter combines with popularity');
select is(public.toon_search_public_tiers('popular','fantasy',1)->'items','[]'::jsonb,'Tag matching keeps case sensitivity');
select is(public.toon_search_public_tiers('popular','spoiler-tag',1)->'items','[]'::jsonb,'Spoiler metadata cannot be discovered through a tag');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->3->'title','null'::jsonb,'Spoiler title remains absent');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->3->'tags','null'::jsonb,'Spoiler tags remain absent');
select ok(strpos(public.toon_search_public_tiers('popular',null,1)::text,'body-secret')=0,'Popularity returns no comment or tier body');
select ok(strpos(public.toon_search_public_tiers('popular',null,1)::text,'31000000-0000-4000-8000-000000000002')=0,'Popularity returns no participant identity');
select ok(strpos(public.toon_search_public_tiers('popular',null,1)::text,'81000000-')=0,'Popularity returns no comment ID');
select throws_ok($$select public.toon_search_public_tiers('rating',null,1)$$,'P0001','VALIDATION_ERROR','Unknown sort remains rejected');
select throws_ok($$select public.toon_search_public_tiers('popular',null,1001)$$,'P0001','VALIDATION_ERROR','Pagination remains bounded');
reset role;

-- Edited old rows do not count; the exact start and end boundaries both do.
update public.toon_comments set created_at=now()-interval '169 hours' where id in('81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000012');
set local role anon;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','3','Updated-at and future creation times do not add a recent participant');
reset role;
update public.toon_comments set created_at=now()-interval '168 hours' where id='81000000-0000-4000-8000-000000000011';
set local role anon;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','4','Exact 168-hour start is inclusive');
reset role;
update public.toon_comments set created_at=now()-interval '169 hours' where id='81000000-0000-4000-8000-000000000011';
update public.toon_comments set created_at=now() where id='81000000-0000-4000-8000-000000000012';
set local role anon;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','4','Exact transaction time end is inclusive');
reset role;

update public.toon_comments set moderation_status='hidden' where id='81000000-0000-4000-8000-000000000013';
set local role anon;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','3','A hidden old parent excludes its otherwise recent reply participant');
reset role;
update public.toon_comments set moderation_status='visible' where id='81000000-0000-4000-8000-000000000013';
update public.toon_comments set moderation_status='hidden' where id='81000000-0000-4000-8000-000000000003';
set local role anon;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','4','A surviving reply to a deleted root still contributes its participant');
reset role;
update public.toon_comments set user_id=null,body=null,deleted_at=now() where id='81000000-0000-4000-8000-000000000018';
set local role anon;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','3','Deleting the last visible recent comment removes its participant');
reset role;
update public.toon_comments set moderation_status='visible' where id='81000000-0000-4000-8000-000000000003';

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","session_id":"41000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_set_user_block('31000000-0000-4000-8000-000000000008',true)$$,'Viewer blocks an old root author');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','3','Blocked parent author hides its recent reply participant from this viewer');
select lives_ok($$select public.toon_set_user_block('31000000-0000-4000-8000-000000000008',false)$$,'Viewer unblocks root author');
select lives_ok($$select public.toon_set_user_block('31000000-0000-4000-8000-000000000004',true)$$,'Viewer blocks a commenter and liker');
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'popularityScore','7','Viewer-specific blocks affect valid participation and score');
select lives_ok($$select public.toon_set_user_block('31000000-0000-4000-8000-000000000004',false)$$,'Viewer unblocks commenter');
reset role;
update toon_private.toon_user_access set status='suspended' where user_id='31000000-0000-4000-8000-000000000003';
set local role authenticated;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'recentCommenterCount','3','Current account suspension removes existing comments from the aggregate');
reset role;
update toon_private.toon_user_access set status='active' where user_id='31000000-0000-4000-8000-000000000003';
insert into public.toon_blocks(blocker_id,blocked_id) values('31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(public.toon_search_public_tiers('popular',null,1)->'items'->0->>'popularityScore','4','Author block removes its liker, commenter and replies under that blocked parent');
reset role;
delete from public.toon_blocks where blocker_id='31000000-0000-4000-8000-000000000001' and blocked_id='31000000-0000-4000-8000-000000000002';
delete from toon_private.toon_consent_records where user_id='31000000-0000-4000-8000-000000000001' and policy_kind='age_14';
set local role authenticated;
select is(public.toon_search_public_tiers('popular',null,1)->'items','[]'::jsonb,'Current author eligibility governs candidates before ranking');
select is(public.toon_search_public_tiers('popular',null,1)->>'hasNext','false','Ineligible targets do not leak through page state');
reset role;
select * from finish();
rollback;
