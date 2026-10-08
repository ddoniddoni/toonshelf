-- Community discussion rollback fixtures WRITTEN ONLY. Never execute on the shared project.
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
 select ('35000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'post-'||n||'@example.test',now(),false,'{"role":"admin"}' from generate_series(1,5) n;
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
update public.toon_user_settings set notification_preferences='{"followers":true,"reactions":true,"replies":true,"announcements":true}' where user_id::text like '35000000-0000-4000-8000-%';
insert into public.toon_posts(id,user_id,title,body,is_spoiler,publication_status,published_at) values
 ('95000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000002','[test] spoiler title','[test] spoiler body long enough to publish',true,'published',now()-interval '2 days'),
 ('95000000-0000-4000-8000-000000000002','35000000-0000-4000-8000-000000000005','[test] newer title','[test] newer public body long enough to publish',false,'published',now()-interval '1 day');
select ok(not has_table_privilege('authenticated','public.toon_post_comments','SELECT,INSERT,UPDATE,DELETE'),'Raw comments inaccessible');
select ok(not has_table_privilege('anon','public.toon_post_reactions','SELECT'),'No raw liker identities');
select ok(not has_function_privilege('authenticated','toon_private.toon_enqueue_post_notification(uuid,uuid,text,uuid,uuid,text)','EXECUTE'),'Cannot forge notification recipient');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000004","session_id":"45000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_post_like('95000000-0000-4000-8000-000000000001',1,true)$$,'P0001','FORBIDDEN','Suspended member cannot react');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_set_post_like('95000000-0000-4000-8000-000000000001',1,true)->>'likeCount','1','First like is counted');
select is(public.toon_set_post_like('95000000-0000-4000-8000-000000000001',1,true)->>'likeCount','1','Desired state retries do not double count');
select throws_ok($$select public.toon_set_post_like('95000000-0000-4000-8000-000000000001',2,false)$$,'P0001','CONFLICT','Stale post version denied');
select is(public.toon_create_post_comment('75000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001',1,null,'root-secret',false,true),'75000000-0000-4000-8000-000000000001'::uuid,'Create root comment');
select is(public.toon_create_post_comment('75000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001',1,null,'root-secret',false,true),'75000000-0000-4000-8000-000000000001'::uuid,'Same request ID is idempotent');
select throws_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001',1,null,'changed secret',false,true)$$,'P0001','CONFLICT','Reused ID cannot overwrite text');
select lives_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000001',1,null,'second-secret',false,true)$$,'Same author adds another root');
select throws_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000009','95000000-0000-4000-8000-000000000002',1,'75000000-0000-4000-8000-000000000001','cross-post',false,true)$$,'P0001','NOT_FOUND','Cross-post parent denied');
reset role;
select is((select count(*) from public.toon_notifications where kind='post_like'),1::bigint,'Like retry creates one notification');
select is((select count(*) from public.toon_notifications where kind='post_comment'),2::bigint,'Comment retry creates one notification per comment');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000005","session_id":"45000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000001',1,'75000000-0000-4000-8000-000000000001','reply-secret',false,true)$$,'Another reader replies');
select throws_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000009','95000000-0000-4000-8000-000000000001',1,'75000000-0000-4000-8000-000000000003','too deep',false,true)$$,'P0001','NOT_FOUND','Second-level replies denied');
select lives_ok($$select public.toon_report_post_comment('75000000-0000-4000-8000-000000000001',1,1,'spam','Report fixture for moderation')$$,'Report visible comment');
select lives_ok($$select public.toon_report_post_comment('75000000-0000-4000-8000-000000000001',1,1,'spam','Duplicate report fixture')$$,'Pending report retry');
select is(jsonb_array_length(public.toon_list_post_comment_reports(1,true)->'items'),1,'Duplicate pending report suppressed');
select set_config('test.comment_report_id',public.toon_list_post_comment_reports(1,true)->'items'->0->>'id',true);
select throws_ok($$select public.toon_moderation_post_comment_snapshot('75000000-0000-4000-8000-000000000001',1,true)$$,'P0001','FORBIDDEN','Editable role metadata cannot authorize moderation');
reset role;
select is((select count(*) from public.toon_notifications where kind='post_reply' and recipient_id='35000000-0000-4000-8000-000000000001'),1::bigint,'Reply notifies root author');
select is((select count(*) from public.toon_notifications where kind='post_comment' and post_comment_id='75000000-0000-4000-8000-000000000003'),1::bigint,'Reply also notifies distinct post author');

select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.toon_search_posts(null,null,'',1,'latest')->'items'->0->>'id','95000000-0000-4000-8000-000000000002','Latest uses first publication time');
select is(public.toon_search_posts(null,null,'',1,'popular')->'items'->0->>'id','95000000-0000-4000-8000-000000000001','Popular ranks engaged post first');
select is(public.toon_search_posts(null,null,'',1,'popular')->'items'->0->>'popularityScore','5','One like and two distinct commenters, not comment volume');
select ok(public.toon_search_posts(null,null,'',1,'popular')::text !~ 'spoiler title|spoiler body|root-secret|reply-secret','Discovery reveals no spoiler text');
select ok(public.toon_list_post_comments('95000000-0000-4000-8000-000000000001',1)::text !~ 'root-secret|second-secret','Parent post spoiler masks comments');
select is(public.toon_get_post_comment('75000000-0000-4000-8000-000000000003',1,1,true)->>'body','reply-secret','Explicit reveal checks post and comment revision');
select throws_ok($$select public.toon_get_post_comment('75000000-0000-4000-8000-000000000003',2,1,true)$$,'P0001','CONFLICT','Stale parent revision rejected');
reset role;

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_post_like('95000000-0000-4000-8000-000000000001',1,true)$$,'P0001','SELF_REACTION','Self-like denied');
select lives_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000004','95000000-0000-4000-8000-000000000001',1,null,'owner-secret',false,true)$$,'Post owner comments');
select ok(public.toon_list_notifications()::text !~ 'root-secret|reply-secret|spoiler body|owner-secret','Inbox has references only');
reset role;
select is((select count(*) from public.toon_notifications where post_comment_id='75000000-0000-4000-8000-000000000004'),0::bigint,'No self notification');
select is((select popularity_score from toon_private.toon_post_popularity_metrics('95000000-0000-4000-8000-000000000001')),5::bigint,'Owner comments excluded from popularity');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select ok(public.toon_moderation_post_comment_snapshot('75000000-0000-4000-8000-000000000001',null,false)::text !~ 'root-secret','Moderator initial body masked');
select lives_ok($$select public.toon_moderate_post_comment('75000000-0000-4000-8000-000000000001',1,'hide','fixture moderation',current_setting('test.comment_report_id')::uuid,'Hidden after review')$$,'Hide and resolve report atomically');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_post_comment('75000000-0000-4000-8000-000000000003',1,1,true),null::jsonb,'Hidden root excludes replies');
select ok(not exists(select 1 from jsonb_array_elements(public.toon_list_notifications()->'items') n where n->>'commentId'='75000000-0000-4000-8000-000000000003'),'Hidden thread notification loses target link');
reset role;
select is((select popularity_score from toon_private.toon_post_popularity_metrics('95000000-0000-4000-8000-000000000001')),3::bigint,'Hidden root and its reply author excluded from popularity');

-- Preference gate: new actions do not backfill disabled notifications.
update public.toon_user_settings set notification_preferences=jsonb_set(notification_preferences,'{replies}','false') where user_id='35000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000005','95000000-0000-4000-8000-000000000001',1,null,'preference-secret',true,true)$$,'Create with owner notifications disabled');
select is(public.toon_set_post_like('95000000-0000-4000-8000-000000000001',1,false)->>'likeCount','0','Unlike removes count');
select is(public.toon_set_post_like('95000000-0000-4000-8000-000000000001',1,true)->>'likeCount','1','Relike restores count');
reset role;
select is((select count(*) from public.toon_notifications where post_comment_id='75000000-0000-4000-8000-000000000005'),0::bigint,'No notification when disabled');
select is((select count(*) from public.toon_notifications where kind='post_like'),1::bigint,'Relike within 24 hours creates no extra alert');

-- Creation time, never edits, defines the popularity window.
update public.toon_post_reactions set created_at=now()-interval '169 hours';
update public.toon_post_comments set created_at=now()-interval '169 hours',updated_at=now() where post_id='95000000-0000-4000-8000-000000000001';
select is((select popularity_score from toon_private.toon_post_popularity_metrics('95000000-0000-4000-8000-000000000001')),0::bigint,'Editing old activity does not refresh seven-day popularity');
-- Restoring and then deleting a root preserves existing replies, not its body.
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_moderate_post_comment('75000000-0000-4000-8000-000000000001',2,'restore','fixture restoration',null,'')$$,'Restore the root');
reset role;
select is((select popularity_score from toon_private.toon_post_popularity_metrics('95000000-0000-4000-8000-000000000001')),0::bigint,'Restoring old comments does not refresh popularity');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_delete_post_comment('75000000-0000-4000-8000-000000000001',3,true)$$,'Delete root text');
select is(public.toon_get_post_comment('75000000-0000-4000-8000-000000000001',1)->'author','null'::jsonb,'Deleted root has no public identity');
select is(public.toon_get_post_comment('75000000-0000-4000-8000-000000000001',1)->>'replyCount','1','Deleted root keeps existing reply count');
select is(public.toon_get_post_comment('75000000-0000-4000-8000-000000000003',1,1,true)->>'body','reply-secret','Existing reply remains accessible below deleted root');
select throws_ok($$select public.toon_create_post_comment('75000000-0000-4000-8000-000000000006','95000000-0000-4000-8000-000000000001',1,'75000000-0000-4000-8000-000000000001','late reply',false,true)$$,'P0001','NOT_FOUND','No new replies below deleted root');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_set_user_block('35000000-0000-4000-8000-000000000002',true)$$,'Block the post owner');
select is(public.toon_get_post_like_state('95000000-0000-4000-8000-000000000001'),null::jsonb,'Block hides post reaction state');
select is(public.toon_list_post_comments('95000000-0000-4000-8000-000000000001',1),null::jsonb,'Block hides discussion');
select lives_ok($$select public.toon_delete_post_comment('75000000-0000-4000-8000-000000000002',1,true)$$,'Own text removal remains possible after losing access');
reset role;
select is((select count(*) from public.toon_post_reactions),0::bigint,'Block cleans post reactions in the same transaction');
select is((select body from public.toon_post_comments where id='75000000-0000-4000-8000-000000000002'),null::text,'Deleted text is scrubbed');
update public.toon_posts set publication_status='draft',version=2 where id='95000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_moderation_post_comment_snapshot('75000000-0000-4000-8000-000000000003',1,true)->>'body',null::text,'Moderator cannot read comments of withdrawn posts');
reset role;
select * from finish();
rollback;
