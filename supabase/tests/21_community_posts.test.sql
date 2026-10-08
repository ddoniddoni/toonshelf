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
 select ('35000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'post-'||n||'@example.test',now(),false,'{"role":"admin"}' from generate_series(1,4) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'post_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '35000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '35000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status)
 select id,case when right(id::text,1)='4' then 'suspended'::public.toon_access_status else 'active'::public.toon_access_status end
 from public.toon_profiles where id::text like '35000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '35000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('45000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '35000000-0000-4000-8000-%';
insert into public.toon_follows(follower_id,following_id) values('35000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000002');

update toon_private.toon_user_access set role='moderator' where user_id='35000000-0000-4000-8000-000000000003';
insert into public.toon_platforms(id,code,name,approved_hosts) values('55000000-0000-4000-8000-000000000001','post_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status) values
 ('55000000-0000-4000-8000-000000000002','post-fixture','[test] work','all','published'),
 ('55000000-0000-4000-8000-000000000003','post-private','[test] unavailable','all','draft');
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at) values
 ('55000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000001','https://example.test/post-fixture','all',now());
select ok(not has_table_privilege('anon','public.toon_posts','SELECT'),'No raw anonymous publication access');
select ok(not has_table_privilege('authenticated','public.toon_posts','SELECT,INSERT,UPDATE,DELETE'),'Members cannot bypass spoiler or ownership checks');
select ok(not has_table_privilege('authenticated','toon_private.toon_post_drafts','SELECT,UPDATE'),'Private drafts are RPC only');
select ok(not has_table_privilege('authenticated','toon_private.toon_post_reports','SELECT'),'Reporter identities cannot be enumerated');
select ok(not has_function_privilege('anon','public.toon_publish_post(uuid,bigint,bigint)','EXECUTE'),'Anonymous writes denied');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000004","session_id":"45000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_create_post_draft('95000000-0000-4000-8000-000000000004')$$,'P0001','FORBIDDEN','Suspended users cannot create posts');
reset role;

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_create_post_draft('95000000-0000-4000-8000-000000000001'),'95000000-0000-4000-8000-000000000001'::uuid,'Owner creates a draft');
select is(public.toon_create_post_draft('95000000-0000-4000-8000-000000000001'),'95000000-0000-4000-8000-000000000001'::uuid,'Same creation ID safely retries');
select throws_ok($$select public.toon_save_post_draft('95000000-0000-4000-8000-000000000001',1,'{"title":"title","body":"body","category":"general","isSpoiler":false,"workIds":[],"userId":"forged"}')$$,'P0001','VALIDATION_ERROR','Unknown ownership fields rejected');
select throws_ok($$select public.toon_save_post_draft('95000000-0000-4000-8000-000000000001',1,'{"title":"title","body":"body","category":"general","isSpoiler":false,"workIds":["55000000-0000-4000-8000-000000000003"]}')$$,'P0001','WORK_UNAVAILABLE','Unavailable work cannot be attached');
select lives_ok($$select public.toon_save_post_draft('95000000-0000-4000-8000-000000000001',1,'{"title":"spoiler-secret-title","body":"spoiler-secret-body-that-is-long-enough","category":"recommendation","isSpoiler":true,"workIds":["55000000-0000-4000-8000-000000000002"]}')$$,'Owner saves private draft');
select throws_ok($$select public.toon_save_post_draft('95000000-0000-4000-8000-000000000001',1,'{"title":"title","body":"body","category":"general","isSpoiler":false,"workIds":[]}')$$,'P0001','CONFLICT','Stale draft version rejected');
select throws_ok($$select public.toon_publish_post('95000000-0000-4000-8000-000000000001',1,1)$$,'P0001','CONFLICT','Publishing requires current stored draft');
select lives_ok($$select public.toon_publish_post('95000000-0000-4000-8000-000000000001',2,1)$$,'Publish stored draft');
select lives_ok($$select public.toon_save_post_draft('95000000-0000-4000-8000-000000000001',2,'{"title":"private-new-title","body":"private-new-body-that-is-not-yet-published","category":"information","isSpoiler":false,"workIds":[]}')$$,'Editing stays private');
select is(public.toon_get_post('95000000-0000-4000-8000-000000000001',true,2)->>'title','spoiler-secret-title','Private edits do not replace publication');
reset role;
select is((select count(*) from public.toon_activity_events where post_id='95000000-0000-4000-8000-000000000001'),1::bigint,'Exactly one first-publication activity');
select set_config('test.post_event_time',(select created_at::text from public.toon_activity_events where post_id='95000000-0000-4000-8000-000000000001'),true);
select ok(toon_private.toon_post_merge_blocked('55000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000003'),'Referenced works preserve existing publication');

select set_config('request.jwt.claims','{}',true);
set local role anon;
select ok(public.toon_get_post('95000000-0000-4000-8000-000000000001',false,null)::text !~ 'spoiler-secret|private-new|post-fixture','Initial response hides title/body/works');
select is(public.toon_get_post('95000000-0000-4000-8000-000000000001',true,2)->>'title','spoiler-secret-title','Explicit reveal reads current public snapshot');
select throws_ok($$select public.toon_get_post('95000000-0000-4000-8000-000000000001',true,1)$$,'P0001','CONFLICT','Old reveal version denied');
select is(jsonb_array_length(public.toon_list_posts(null,null,'spoiler-secret',1)->'items'),0,'Search cannot infer hidden spoiler text');
select is(jsonb_array_length(public.toon_list_posts(null,'55000000-0000-4000-8000-000000000002','',1)->'items'),0,'Work filter cannot infer hidden attachments');
reset role;
update public.toon_works set catalogue_status='hidden' where id='55000000-0000-4000-8000-000000000002';
set local role anon;
select is(public.toon_get_post('95000000-0000-4000-8000-000000000001',true,2),null::jsonb,'Unavailable attachment hides the whole public post');
reset role;
update public.toon_works set catalogue_status='published' where id='55000000-0000-4000-8000-000000000002';

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_my_post_editor('95000000-0000-4000-8000-000000000001'),null::jsonb,'Reader cannot inspect owner draft');
select throws_ok($$select public.toon_save_post_draft('95000000-0000-4000-8000-000000000001',3,'{}')$$,'P0001','NOT_FOUND','Other users cannot modify draft');
select is(public.toon_get_following_feed()->'items'->0->>'kind','post','Following feed includes community');
select ok(public.toon_get_following_feed()::text !~ 'spoiler-secret|private-new','Feed contains no hidden text');
select lives_ok($$select public.toon_report_post('95000000-0000-4000-8000-000000000001','spam','This is a local report fixture')$$,'Reader reports current public post');
select lives_ok($$select public.toon_report_post('95000000-0000-4000-8000-000000000001','spam','A second duplicate report fixture')$$,'Repeated report is idempotent');
select is(jsonb_array_length(public.toon_list_my_post_reports(1)->'items'),1,'One pending report per reader/post');
select set_config('test.post_report_id',public.toon_list_my_post_reports(1)->'items'->0->>'id',true);
select throws_ok($$select public.toon_moderation_post_snapshot('95000000-0000-4000-8000-000000000001',true,2)$$,'P0001','FORBIDDEN','Editable metadata cannot grant moderator');
select lives_ok($$select public.toon_set_user_block('35000000-0000-4000-8000-000000000002',true)$$,'Reader blocks author');
select is(public.toon_get_post('95000000-0000-4000-8000-000000000001',true,2),null::jsonb,'Block immediately excludes public detail');
select is(jsonb_array_length(public.toon_get_following_feed()->'items'),0,'Block excludes feed');
select lives_ok($$select public.toon_set_user_block('35000000-0000-4000-8000-000000000002',false)$$,'Reader removes block');
reset role;
insert into public.toon_follows(follower_id,following_id) values('35000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select ok(public.toon_moderation_post_snapshot('95000000-0000-4000-8000-000000000001',false,null)::text !~ 'spoiler-secret|private-new','Moderator initial response contains no body or draft');
select is(public.toon_moderation_post_snapshot('95000000-0000-4000-8000-000000000001',true,2)->>'title','spoiler-secret-title','Moderator sees only current published title');
select lives_ok($$select public.toon_moderate_post('95000000-0000-4000-8000-000000000001',2,'hide','local moderation fixture',current_setting('test.post_report_id')::uuid,'Hidden after review')$$,'Moderation and report result stored atomically');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_publish_post('95000000-0000-4000-8000-000000000001',3,3)$$,'P0001','MODERATION_HIDDEN','Owner cannot undo moderation by publishing');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_post('95000000-0000-4000-8000-000000000001',true,3),null::jsonb,'Hidden post not readable');
select is(jsonb_array_length(public.toon_get_following_feed()->'items'),0,'Hidden post not in feed');
select is(public.toon_list_my_post_reports(1)->'items'->0->>'status','resolved','Reporter receives result');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_moderate_post('95000000-0000-4000-8000-000000000001',3,'restore','local restoration fixture',null,'')$$,'Moderator restores publication');
reset role;

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_withdraw_post('95000000-0000-4000-8000-000000000001',4,false,true)$$,'Owner withdraws');
select is(public.toon_get_post('95000000-0000-4000-8000-000000000001',true,5),null::jsonb,'Withdrawn content disappears');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_moderation_post_snapshot('95000000-0000-4000-8000-000000000001',true,5)->>'body',null::text,'Moderator cannot reveal withdrawn or private draft body');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_publish_post('95000000-0000-4000-8000-000000000001',3,5)$$,'Owner publishes latest saved draft');
reset role;
select is((select count(*) from public.toon_activity_events where post_id='95000000-0000-4000-8000-000000000001'),1::bigint,'Republication does not duplicate activity');
select is((select created_at::text from public.toon_activity_events where post_id='95000000-0000-4000-8000-000000000001'),current_setting('test.post_event_time'),'Republication preserves activity time');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_withdraw_post('95000000-0000-4000-8000-000000000001',6,true,true)$$,'Owner deletes post and draft');
select is(public.toon_get_my_post_editor('95000000-0000-4000-8000-000000000001'),null::jsonb,'Deleted editor unavailable');
reset role;
select is((select body from public.toon_posts where id='95000000-0000-4000-8000-000000000001'),'','Deleted body removed');
select is((select count(*) from toon_private.toon_post_drafts where post_id='95000000-0000-4000-8000-000000000001'),0::bigint,'Deleted private draft removed');
select * from finish();
rollback;
