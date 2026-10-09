-- Community work merge rollback fixtures WRITTEN ONLY. Never execute on the shared project.
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
 select ('37000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'post-'||n||'@example.test',now(),false,'{"role":"admin"}' from generate_series(1,5) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'post_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '37000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '37000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status)
 select id,case when right(id::text,1)='4' then 'suspended'::public.toon_access_status else 'active'::public.toon_access_status end
 from public.toon_profiles where id::text like '37000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '37000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('47000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '37000000-0000-4000-8000-%';
insert into public.toon_follows(follower_id,following_id) values('37000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000002');

update toon_private.toon_user_access set role='admin' where user_id='37000000-0000-4000-8000-000000000003';
insert into public.toon_platforms(id,code,name,approved_hosts) values('57000000-0000-4000-8000-000000000001','post_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status) values
 ('57000000-0000-4000-8000-000000000002','post-fixture','[test] work','all','published'),
 ('57000000-0000-4000-8000-000000000003','post-private','[test] unavailable','all','draft');
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at) values
 ('57000000-0000-4000-8000-000000000002','57000000-0000-4000-8000-000000000001','https://example.test/post-fixture','all',now());
update public.toon_user_settings set notification_preferences='{"followers":true,"reactions":true,"replies":true,"announcements":true}' where user_id::text like '37000000-0000-4000-8000-%';
update public.toon_works set catalogue_status='published' where id='57000000-0000-4000-8000-000000000003';
insert into public.toon_works(id,slug,title,age_rating,catalogue_status) values('57000000-0000-4000-8000-000000000004','merge-other','[test] other work','all','published');
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at) values
 ('57000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000001','https://example.test/target-work','all',now()),
 ('57000000-0000-4000-8000-000000000004','57000000-0000-4000-8000-000000000001','https://example.test/other-work','all',now());
insert into public.toon_posts(id,user_id,title,body,is_spoiler,publication_status,published_at) values
 ('97000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000002','[test] public title','published-secret-body-long-enough',true,'published',now()-interval '3 days'),
 ('97000000-0000-4000-8000-000000000002','37000000-0000-4000-8000-000000000005','','',false,'draft',null),
 ('97000000-0000-4000-8000-000000000003','37000000-0000-4000-8000-000000000002','[test] target only','untouched published body long enough',false,'published',now()-interval '2 days');
insert into public.toon_post_works(post_id,work_id,position) values
 ('97000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002',0),
 ('97000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000004',1),
 ('97000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000003',2),
 ('97000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000003',0);
insert into toon_private.toon_post_drafts(post_id,payload) values
 ('97000000-0000-4000-8000-000000000001','{"title":"private-title","body":"private-draft-secret-body","category":"information","isSpoiler":false,"workIds":["57000000-0000-4000-8000-000000000003","57000000-0000-4000-8000-000000000004","57000000-0000-4000-8000-000000000002"]}'),
 ('97000000-0000-4000-8000-000000000002','{"title":"draft only","body":"private-draft-only","category":"general","isSpoiler":true,"workIds":["57000000-0000-4000-8000-000000000004","57000000-0000-4000-8000-000000000002"]}');
insert into public.toon_post_comments(id,user_id,post_id,body,is_spoiler) values('77000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','preserved comment',true);
insert into public.toon_post_reactions(user_id,post_id) values('37000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001');
insert into toon_private.toon_post_reports(reporter_id,post_id,reason,detail) values('37000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','spoiler','Preserve the existing report reference');
select set_config('test.post_before',(select (to_jsonb(p)-'version')::text from public.toon_posts p where id='97000000-0000-4000-8000-000000000001'),true);
select set_config('test.events_before',(select jsonb_agg(to_jsonb(e) order by id)::text from public.toon_activity_events e where post_id is not null),true);
select set_config('test.notifications_before',(select count(*)::text from public.toon_notifications),true);
create function public.toon_test_post_merge_preview() returns jsonb language sql set search_path='' as $$
 select public.toon_admin_merge_preview('57000000-0000-4000-8000-000000000002','57000000-0000-4000-8000-000000000003');$$;
create function public.toon_test_post_merge_apply() returns void language sql set search_path='' as $$
 select public.toon_admin_merge_works('57000000-0000-4000-8000-000000000002','57000000-0000-4000-8000-000000000003',
  (current_setting('test.merge_preview')::jsonb->'source'->>'version')::bigint,(current_setting('test.merge_preview')::jsonb->'target'->>'version')::bigint,
  'Local duplicate-work fixture',true,(current_setting('test.merge_preview')::jsonb->>'previewToken')::uuid,'latest_private');$$;
grant execute on function public.toon_test_post_merge_preview(),public.toon_test_post_merge_apply() to authenticated;
select ok(not has_table_privilege('authenticated','toon_private.toon_post_work_merge_history','SELECT'),'No raw history read');
select ok(not has_function_privilege('authenticated','toon_private.toon_admin_merge_before_posts(uuid,uuid,bigint,bigint,text,boolean,uuid,text)','EXECUTE'),'Cannot bypass post preservation wrapper');
select ok(not has_function_privilege('anon','public.toon_get_my_post_merge_history(uuid,integer)','EXECUTE'),'Anonymous history read denied');
select set_config('request.jwt.claims','{"sub":"37000000-0000-4000-8000-000000000001","session_id":"47000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_test_post_merge_preview()$$,'P0001','FORBIDDEN','Editable admin metadata cannot authorize merge');
reset role;
select set_config('request.jwt.claims','{"sub":"37000000-0000-4000-8000-000000000003","session_id":"47000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.merge_preview',public.toon_test_post_merge_preview()::text,true);
select is(current_setting('test.merge_preview')::jsonb->'community','{"posts":1,"drafts":2,"deduplicatedPosts":1,"deduplicatedDrafts":1}'::jsonb,'Counts reflect separate published and draft references');
select ok((current_setting('test.merge_preview')::jsonb->>'canMerge')::boolean,'Post references now have a preservation handler');
select ok(current_setting('test.merge_preview') !~ 'private-draft|published-secret|fingerprint|userId','Admin receives no private text/digest/owner');
reset role;
-- Even a same-count draft edit invalidates the token; no partial merge on failure.
update toon_private.toon_post_drafts set payload=jsonb_set(payload,'{body}','"edited-private-draft-secret"'),version=version+1 where post_id='97000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_test_post_merge_apply()$$,'P0001','MERGE_PREVIEW_EXPIRED','Concurrent draft edit requires new preview');
reset role;
select is((select count(*) from toon_private.toon_post_work_merge_history),0::bigint,'Failed merge leaves no provenance rows');
select is((select catalogue_status::text from public.toon_works where id='57000000-0000-4000-8000-000000000002'),'published','Failed merge does not alter source');
update public.toon_works set catalogue_status='hidden' where id='57000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('test.merge_preview',public.toon_test_post_merge_preview()::text,true);
select is(current_setting('test.merge_preview')::jsonb->'conflicts'->>'unavailable','2','Hidden source references must not become public via merge');
select throws_ok($$select public.toon_test_post_merge_apply()$$,'P0001','MERGE_RECORD_CONFLICT','Hidden source remains blocked');
reset role;
update public.toon_works set catalogue_status='published' where id='57000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('test.merge_preview',public.toon_test_post_merge_preview()::text,true);
select lives_ok($$select public.toon_test_post_merge_apply()$$,'Merge personal/tier/catalogue and post links atomically');
select is(public.toon_get_my_post_merge_history('97000000-0000-4000-8000-000000000001',1),null::jsonb,'Admin role does not expose another owner history');
reset role;
select is((select array_agg(work_id::text order by position) from public.toon_post_works where post_id='97000000-0000-4000-8000-000000000001'),array['57000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000004'],'First occurrence wins while preserving relative order');
select is((select array_agg(position::integer order by position) from public.toon_post_works where post_id='97000000-0000-4000-8000-000000000001'),array[0,1],'Positions compact without unique collisions');
select is((select payload->'workIds' from toon_private.toon_post_drafts where post_id='97000000-0000-4000-8000-000000000001'),'["57000000-0000-4000-8000-000000000003","57000000-0000-4000-8000-000000000004"]'::jsonb,'Draft uses its own order');
select is((select payload->>'body' from toon_private.toon_post_drafts where post_id='97000000-0000-4000-8000-000000000001'),'edited-private-draft-secret','Private content preserved separately');
select is((select to_jsonb(p)-'version' from public.toon_posts p where id='97000000-0000-4000-8000-000000000001'),current_setting('test.post_before')::jsonb,'Body/lifecycle/spoiler/timestamps preserved');
select is((select version from public.toon_posts where id='97000000-0000-4000-8000-000000000001'),2::bigint,'Published-reference changes invalidate stale versions');
select is((select version from toon_private.toon_post_drafts where post_id='97000000-0000-4000-8000-000000000001'),3::bigint,'Draft version invalidated');
select is((select publication_status::text from public.toon_posts where id='97000000-0000-4000-8000-000000000002'),'draft','Draft-only post is never published');
select is((select version from public.toon_posts where id='97000000-0000-4000-8000-000000000003'),1::bigint,'Target-only post unchanged');
select is((select count(*) from public.toon_post_comments where post_id='97000000-0000-4000-8000-000000000001'),1::bigint,'Comments remain attached');
select is((select count(*) from public.toon_post_reactions where post_id='97000000-0000-4000-8000-000000000001'),1::bigint,'Likes remain attached');
select is((select count(*) from toon_private.toon_post_reports where post_id='97000000-0000-4000-8000-000000000001'),1::bigint,'Reports remain attached');
select is((select jsonb_agg(to_jsonb(e) order by id) from public.toon_activity_events e where post_id is not null),current_setting('test.events_before')::jsonb,'Feed events are not republished');
select is((select count(*)::text from public.toon_notifications),current_setting('test.notifications_before'),'Merge sends no synthetic reaction notifications');
select is((select count(*) from toon_private.toon_post_work_merge_history),2::bigint,'Only changed posts receive private history');
select set_config('request.jwt.claims','{}',true);
set local role anon;
select ok(public.toon_get_post('97000000-0000-4000-8000-000000000001',false,null)::text !~ 'published-secret|private-draft|post-fixture','Spoiler text and attachments stay masked');
select is(public.toon_get_post('97000000-0000-4000-8000-000000000001',true,2)->'works'->0->>'id','57000000-0000-4000-8000-000000000003','Current public post uses merged target');
select throws_ok($$select public.toon_get_post('97000000-0000-4000-8000-000000000001',true,1)$$,'P0001','CONFLICT','Pre-merge spoiler reveal must refresh');
reset role;
select set_config('request.jwt.claims','{"sub":"37000000-0000-4000-8000-000000000002","session_id":"47000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.toon_get_my_post_merge_history('97000000-0000-4000-8000-000000000001',1)->'items'),1,'Owner can see only own provenance');
select is(public.toon_get_my_post_merge_history('97000000-0000-4000-8000-000000000002',1),null::jsonb,'Other owner draft history is inaccessible');
select throws_ok($$select public.toon_publish_post('97000000-0000-4000-8000-000000000001',2,1)$$,'P0001','CONFLICT','Stale editor cannot republish old links');
select throws_ok($$select public.toon_get_my_post_merge_history('97000000-0000-4000-8000-000000000001',1001)$$,'P0001','VALIDATION_ERROR','Pagination bounded');
reset role;
select * from finish();
rollback;
