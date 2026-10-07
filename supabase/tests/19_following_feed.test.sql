-- Local rollback fixtures WRITTEN ONLY. Never execute on the shared project.
-- Does not establish multi-session race, production performance or browser proof.
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
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data)
 select ('33000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'feed-'||n||'@example.test',now(),false,'{"role":"admin"}' from generate_series(1,4) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'feed_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '33000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '33000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status)
 select id,case when right(id::text,1)='4' then 'suspended'::public.toon_access_status else 'active'::public.toon_access_status end
 from public.toon_profiles where id::text like '33000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '33000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('43000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '33000000-0000-4000-8000-%';
insert into public.toon_follows(follower_id,following_id) values('33000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002');

insert into public.toon_tier_lists(id,user_id)
 select ('73000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('33000000-0000-4000-8000-'||lpad((case n when 27 then 3 when 28 then 4 when 29 then 1 else 2 end)::text,12,'0'))::uuid from generate_series(1,29) n;
insert into public.toon_tier_list_publications(tier_list_id,version,payload,is_spoiler)
 select id,1,jsonb_build_object('title',case when right(id::text,2)='01' then 'spoiler-title-secret' else '[test] public tier' end,
 'description','private-payload-secret','tags','[]'::jsonb,
 'rows','[{"id":"63000000-0000-4000-8000-000000000001","label":"S","colorToken":"S","canonicalTier":"S"},{"id":"63000000-0000-4000-8000-000000000002","label":"F","colorToken":"F","canonicalTier":"F"}]'::jsonb,'placements','[]'::jsonb),
 right(id::text,2)='01' from public.toon_tier_lists where id::text like '73000000-0000-4000-8000-%';
update public.toon_tier_lists set publication_counter=1,published_version=case when right(id::text,2)='24' then null else 1 end,
 visibility=case right(id::text,2) when '24' then 'private'::public.toon_tier_visibility when '25' then 'unlisted'::public.toon_tier_visibility else 'public'::public.toon_tier_visibility end,
 moderation_status=case when right(id::text,2)='26' then 'hidden' else 'visible' end
 where id::text like '73000000-0000-4000-8000-%';

insert into public.toon_platforms(id,code,name,approved_hosts) values('53000000-0000-4000-8000-000000000001','feed_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status)
 values('53000000-0000-4000-8000-000000000002','feed-fixture','[test] work','all','published');
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 values('53000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000001','https://example.test/feed-fixture','all',now());
insert into public.toon_reviews(id,user_id,work_id,body,is_spoiler,publication_status,published_at) values
 ('83000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002','spoiler-review-secret-content-for-local-fixture',true,'published',now()),
 ('83000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000002','private-review-draft-secret',false,'draft',null);
-- Deterministic fixture-only event IDs and equal microsecond timestamps.
update public.toon_activity_events set id=((case when review_id is null then '93000000' else '94000000' end)||'-0000-4000-8000-'||right(coalesce(tier_list_id,review_id)::text,12))::uuid,
 created_at='2026-10-07T09:00:00.123456Z' where actor_id::text like '33000000-0000-4000-8000-%';

select is((select count(*) from public.toon_activity_events where tier_list_id in ('73000000-0000-4000-8000-000000000024','73000000-0000-4000-8000-000000000025','73000000-0000-4000-8000-000000000026','73000000-0000-4000-8000-000000000028')),0::bigint,'No event for private, unlisted, hidden or inactive-author publication');
select is((select count(*) from public.toon_activity_events where review_id='83000000-0000-4000-8000-000000000002'),0::bigint,'Review drafts do not create activity');
select ok(not has_table_privilege('authenticated','public.toon_activity_events','SELECT'),'No raw activity enumeration');
select ok(not has_table_privilege('authenticated','public.toon_activity_events','INSERT,UPDATE,DELETE'),'Members cannot forge or bump activity');
select ok(not has_function_privilege('authenticated','toon_private.toon_record_tier_activity()','EXECUTE'),'Trigger helper cannot be called directly');
select ok(not has_function_privilege('anon','public.toon_get_following_feed(jsonb)','EXECUTE'),'Anonymous feed RPC access is denied');
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select throws_ok($$select public.toon_get_following_feed()$$,'P0001','AUTH_REQUIRED','Role alone does not grant membership');
reset role;
select set_config('request.jwt.claims','{"sub":"33000000-0000-4000-8000-000000000001","session_id":"43000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.feed_first',public.toon_get_following_feed()::text,true);
select set_config('test.feed_second',public.toon_get_following_feed(current_setting('test.feed_first')::jsonb->'next')::text,true);
select is(jsonb_array_length(current_setting('test.feed_first')::jsonb->'items'),20,'First page bounded after permission filtering');
select is(jsonb_array_length(current_setting('test.feed_second')::jsonb->'items'),4,'Second page contains remaining visible sources only');
select is(current_setting('test.feed_first')::jsonb->'items'->0->>'kind','review','Equal timestamp ordering spans both domains');
select is(current_setting('test.feed_first')::jsonb->'next'->>'id','93000000-0000-4000-8000-000000000005','Tie-breaker cursor uses last returned ID');
select is(current_setting('test.feed_first')::jsonb->'next'->>'createdAt','2026-10-07T09:00:00.123456Z','Cursor preserves all microseconds');
select is((select count(distinct item->>'eventId') from jsonb_array_elements((current_setting('test.feed_first')::jsonb->'items')||(current_setting('test.feed_second')::jsonb->'items')) item),24::bigint,'No duplicate or lost events across equal timestamps');
select ok((current_setting('test.feed_first')||current_setting('test.feed_second')) !~ 'spoiler-review-secret|spoiler-title-secret|private-payload-secret|private-review-draft|example.test|user_access','No spoiler content, private drafts, email or role leaks');
select is(current_setting('test.feed_second')::jsonb->'next','null'::jsonb,'Last page has no next cursor');
select throws_ok($$select public.toon_get_following_feed('{"id":"93000000-0000-4000-8000-000000000005","createdAt":"2026-10-07T09:00:00.123456Z","actor":"forged"}')$$,'P0001','VALIDATION_ERROR','Cursor cannot inject actor fields');
select throws_ok($$select public.toon_get_following_feed('{"id":"bad","createdAt":"infinity"}')$$,'P0001','VALIDATION_ERROR','Invalid UUID and unbounded timestamps denied');
select throws_ok($$select public.toon_get_following_feed('{"id":"93000000-0000-4000-8000-000000000005","createdAt":"2026-99-99T09:00:00.123456Z"}')$$,'P0001','VALIDATION_ERROR','Invalid calendar dates sanitized');
reset role;

-- Re-publish and edit do not create duplicate events or advance their times.
update public.toon_reviews set publication_status='draft' where id='83000000-0000-4000-8000-000000000001';
update public.toon_reviews set publication_status='published',body='changed-spoiler-review-secret-content' where id='83000000-0000-4000-8000-000000000001';
update public.toon_tier_lists set visibility='unlisted' where id='73000000-0000-4000-8000-000000000001';
update public.toon_tier_lists set visibility='public' where id='73000000-0000-4000-8000-000000000001';
select is((select count(*) from public.toon_activity_events where review_id='83000000-0000-4000-8000-000000000001'),1::bigint,'Review republication deduplicates');
select is((select count(*) from public.toon_activity_events where tier_list_id='73000000-0000-4000-8000-000000000001'),1::bigint,'Tier republication deduplicates');
select is((select created_at from public.toon_activity_events where review_id='83000000-0000-4000-8000-000000000001'),'2026-10-07T09:00:00.123456Z'::timestamptz,'Review edit never bumps feed order');
select is((select created_at from public.toon_activity_events where tier_list_id='73000000-0000-4000-8000-000000000001'),'2026-10-07T09:00:00.123456Z'::timestamptz,'Tier edit never bumps feed order');
update public.toon_works set age_rating='19' where id='53000000-0000-4000-8000-000000000002';
set local role authenticated;
select ok(public.toon_get_following_feed()::text !~ '83000000-0000-4000-8000-000000000001','Adult work gate also removes its review from the feed');
reset role;
update public.toon_works set age_rating='all' where id='53000000-0000-4000-8000-000000000002';
-- Withdraw the anchor itself, and also withdraw content already read on page one.
update public.toon_tier_lists set visibility='private',published_version=null where id='73000000-0000-4000-8000-000000000005';
update public.toon_reviews set publication_status='draft' where id='83000000-0000-4000-8000-000000000001';
update public.toon_tier_lists set moderation_status='hidden' where id='73000000-0000-4000-8000-000000000023';
update public.toon_tier_lists set deleted_at=now() where id='73000000-0000-4000-8000-000000000022';
set local role authenticated;
select is(jsonb_array_length(public.toon_get_following_feed(current_setting('test.feed_first')::jsonb->'next')->'items'),4,'Withdrawn anchor still permits safe continuation');
select ok(public.toon_get_following_feed()::text !~ '73000000-0000-4000-8000-000000000005|83000000-0000-4000-8000-000000000001|73000000-0000-4000-8000-000000000023|73000000-0000-4000-8000-000000000022','New reads exclude withdrawn, hidden and deleted sources');
reset role;
-- Publication content is read live, without copying old text into the ledger.
update public.toon_tier_list_publications set payload=jsonb_set(payload,'{title}','"[test] updated title"') where tier_list_id='73000000-0000-4000-8000-000000000021' and version=1;
set local role authenticated;
select ok(public.toon_get_following_feed()::text like '%[test] updated title%','Projection uses current public content');
select lives_ok($$select public.toon_set_user_follow('33000000-0000-4000-8000-000000000002',false)$$,'Unfollow acknowledged');
select is(public.toon_get_following_feed()->>'hasFollowing','false','No-follow state after unfollow');
select is(jsonb_array_length(public.toon_get_following_feed()->'items'),0,'Unfollow removes historical sources');
select lives_ok($$select public.toon_set_user_follow('33000000-0000-4000-8000-000000000002',true)$$,'Refollow acknowledged');
select lives_ok($$select public.toon_set_user_block('33000000-0000-4000-8000-000000000002',true)$$,'Block acknowledged');
select is(jsonb_array_length(public.toon_get_following_feed()->'items'),0,'Blocking removes past activity');
select lives_ok($$select public.toon_set_user_block('33000000-0000-4000-8000-000000000002',false)$$,'Unblock acknowledged');
select is(public.toon_get_following_feed()->>'hasFollowing','false','Unblock does not restore feed subscription');
reset role;
-- Defense against a privileged retained relationship in the reverse block direction.
insert into public.toon_blocks(blocker_id,blocked_id) values('33000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000001');
insert into public.toon_follows(follower_id,following_id) values('33000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(jsonb_array_length(public.toon_get_following_feed()->'items'),0,'Reverse block filtered even with retained relationship');
reset role;
delete from public.toon_blocks where blocker_id='33000000-0000-4000-8000-000000000002' and blocked_id='33000000-0000-4000-8000-000000000001';
update toon_private.toon_user_access set status='suspended' where user_id='33000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(jsonb_array_length(public.toon_get_following_feed()->'items'),0,'Suspended authors are filtered on new reads');
reset role;
update toon_private.toon_user_access set status='active' where user_id='33000000-0000-4000-8000-000000000002';
delete from toon_private.toon_consent_records where user_id='33000000-0000-4000-8000-000000000002' and policy_kind='age_14';
set local role authenticated;
select is(jsonb_array_length(public.toon_get_following_feed()->'items'),0,'Current author consent is required');
reset role;
select set_config('request.jwt.claims','{"sub":"33000000-0000-4000-8000-000000000003","session_id":"43000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.toon_get_following_feed(current_setting('test.feed_first')::jsonb->'next')->'items'),0,'Another account cursor never grants the original viewer feed');
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id='43000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.toon_get_following_feed()$$,'P0001','AUTH_REQUIRED','Expired session denied on direct RPC');
reset role;
update auth.sessions set not_after=null where id='43000000-0000-4000-8000-000000000003';
update auth.users set email_confirmed_at=null where id='33000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.toon_get_following_feed()$$,'P0001','FORBIDDEN','Unconfirmed viewer denied');
reset role;
update auth.users set email_confirmed_at=now() where id='33000000-0000-4000-8000-000000000003';
update toon_private.toon_user_access set status='pending' where user_id='33000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.toon_get_following_feed()$$,'P0001','FORBIDDEN','Pending viewer denied');
reset role;
select set_config('request.jwt.claims','{"sub":"33000000-0000-4000-8000-000000000004","session_id":"43000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"admin"}}',true);
set local role authenticated;
select throws_ok($$select public.toon_get_following_feed()$$,'P0001','FORBIDDEN','Suspended viewer denied despite editable role metadata');
reset role;
select * from finish();
rollback;
