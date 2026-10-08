-- Review discussion rollback fixtures WRITTEN ONLY. Never execute on the shared project.
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
 select ('36000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'review-'||n||'@example.test',now(),false,'{"role":"admin"}' from generate_series(1,5) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'review_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '36000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '36000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status)
 select id,case when right(id::text,1)='4' then 'suspended'::public.toon_access_status else 'active'::public.toon_access_status end
 from public.toon_profiles where id::text like '36000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '36000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('46000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '36000000-0000-4000-8000-%';
insert into public.toon_follows(follower_id,following_id) values('36000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000002');

update toon_private.toon_user_access set role='moderator' where user_id='36000000-0000-4000-8000-000000000003';
insert into public.toon_platforms(id,code,name,approved_hosts) values('56000000-0000-4000-8000-000000000001','review_fixture','[test] platform',array['example.test']);
insert into public.toon_works(id,slug,title,age_rating,catalogue_status) values
 ('56000000-0000-4000-8000-000000000002','review-fixture','[test] work','all','published'),
 ('56000000-0000-4000-8000-000000000003','review-private','[test] unavailable','all','draft');
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at) values
 ('56000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000001','https://example.test/review-fixture','all',now());
update public.toon_user_settings set notification_preferences='{"followers":true,"reactions":true,"replies":true,"announcements":true}' where user_id::text like '36000000-0000-4000-8000-%';
insert into public.toon_reviews(id,user_id,work_id,body,is_spoiler,publication_status,published_at) values
 ('96000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000002','[test] spoiler body long enough to publish',true,'published',now()-interval '2 days'),
 ('96000000-0000-4000-8000-000000000002','36000000-0000-4000-8000-000000000005','56000000-0000-4000-8000-000000000002','[test] newer public body long enough to publish',false,'published',now()-interval '1 day');
select ok(not has_table_privilege('authenticated','public.toon_review_comments','SELECT,INSERT,UPDATE,DELETE'),'Raw comments inaccessible');
select ok(not has_table_privilege('anon','public.toon_review_reactions','SELECT'),'No raw liker identities');
select ok(not has_function_privilege('authenticated','toon_private.toon_enqueue_review_notification(uuid,uuid,text,uuid,uuid,text)','EXECUTE'),'Cannot forge notification recipient');

select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000004","session_id":"46000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_review_like('96000000-0000-4000-8000-000000000001',1,true)$$,'P0001','FORBIDDEN','Suspended member cannot react');
reset role;
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","session_id":"46000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_set_review_like('96000000-0000-4000-8000-000000000001',1,true)->>'likeCount','1','First like is counted');
select is(public.toon_set_review_like('96000000-0000-4000-8000-000000000001',1,true)->>'likeCount','1','Desired state retries do not double count');
select throws_ok($$select public.toon_set_review_like('96000000-0000-4000-8000-000000000001',2,false)$$,'P0001','CONFLICT','Stale review version denied');
select is(public.toon_create_review_comment('76000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',1,null,'root-secret',false,true),'76000000-0000-4000-8000-000000000001'::uuid,'Create root comment');
select is(public.toon_create_review_comment('76000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',1,null,'root-secret',false,true),'76000000-0000-4000-8000-000000000001'::uuid,'Same request ID is idempotent');
select throws_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',1,null,'changed secret',false,true)$$,'P0001','CONFLICT','Reused ID cannot overwrite text');
select lives_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001',1,null,'second-secret',false,true)$$,'Same author adds another root');
select throws_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000009','96000000-0000-4000-8000-000000000002',1,'76000000-0000-4000-8000-000000000001','cross-review',false,true)$$,'P0001','NOT_FOUND','Cross-review parent denied');
reset role;
select is((select count(*) from public.toon_notifications where kind='review_like'),1::bigint,'Like retry creates one notification');
select is((select count(*) from public.toon_notifications where kind='review_comment'),2::bigint,'Comment retry creates one notification per comment');

select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000005","session_id":"46000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000001',1,'76000000-0000-4000-8000-000000000001','reply-secret',false,true)$$,'Another reader replies');
select throws_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000009','96000000-0000-4000-8000-000000000001',1,'76000000-0000-4000-8000-000000000003','too deep',false,true)$$,'P0001','NOT_FOUND','Second-level replies denied');
select lives_ok($$select public.toon_report_review_comment('76000000-0000-4000-8000-000000000001',1,1,'spam','Report fixture for moderation')$$,'Report visible comment');
select lives_ok($$select public.toon_report_review_comment('76000000-0000-4000-8000-000000000001',1,1,'spam','Duplicate report fixture')$$,'Pending report retry');
select is(jsonb_array_length(public.toon_list_review_comment_reports(1,true)->'items'),1,'Duplicate pending report suppressed');
select set_config('test.comment_report_id',public.toon_list_review_comment_reports(1,true)->'items'->0->>'id',true);
select throws_ok($$select public.toon_moderation_review_comment_snapshot('76000000-0000-4000-8000-000000000001',1,true)$$,'P0001','FORBIDDEN','Editable role metadata cannot authorize moderation');
reset role;
select is((select count(*) from public.toon_notifications where kind='review_reply' and recipient_id='36000000-0000-4000-8000-000000000001'),1::bigint,'Reply notifies root author');
select is((select count(*) from public.toon_notifications where kind='review_comment' and review_comment_id='76000000-0000-4000-8000-000000000003'),1::bigint,'Reply also notifies distinct review author');

select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.toon_search_reviews('56000000-0000-4000-8000-000000000002',null,1,'latest')->'items'->0->>'id','96000000-0000-4000-8000-000000000002','Latest uses first publication time');
select is(public.toon_search_reviews('56000000-0000-4000-8000-000000000002',null,1,'popular')->'items'->0->>'id','96000000-0000-4000-8000-000000000001','Popular ranks engaged review first');
select is(public.toon_search_reviews('56000000-0000-4000-8000-000000000002',null,1,'popular')->'items'->0->'engagement'->>'popularityScore','5','One like and two distinct commenters, not comment volume');
select ok(public.toon_search_reviews('56000000-0000-4000-8000-000000000002',null,1,'popular')::text !~ 'spoiler title|spoiler body|root-secret|reply-secret','Discovery reveals no spoiler text');
select ok(public.toon_list_review_comments('96000000-0000-4000-8000-000000000001',1)::text !~ 'root-secret|second-secret','Parent review spoiler masks comments');
select is(public.toon_get_review_comment('76000000-0000-4000-8000-000000000003',1,1,true)->>'body','reply-secret','Explicit reveal checks review and comment revision');
select throws_ok($$select public.toon_get_review_comment('76000000-0000-4000-8000-000000000003',2,1,true)$$,'P0001','CONFLICT','Stale parent revision rejected');
reset role;

select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000002","session_id":"46000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_review_like('96000000-0000-4000-8000-000000000001',1,true)$$,'P0001','SELF_REACTION','Self-like denied');
select lives_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000004','96000000-0000-4000-8000-000000000001',1,null,'owner-secret',false,true)$$,'Review owner comments');
select ok(public.toon_list_notifications()::text !~ 'root-secret|reply-secret|spoiler body|owner-secret','Inbox has references only');
reset role;
select is((select count(*) from public.toon_notifications where review_comment_id='76000000-0000-4000-8000-000000000004'),0::bigint,'No self notification');
select is((select popularity_score from toon_private.toon_review_popularity_metrics('96000000-0000-4000-8000-000000000001')),5::bigint,'Owner comments excluded from popularity');

select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000003","session_id":"46000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select ok(public.toon_moderation_review_comment_snapshot('76000000-0000-4000-8000-000000000001',null,false)::text !~ 'root-secret','Moderator initial body masked');
select lives_ok($$select public.toon_moderate_review_comment('76000000-0000-4000-8000-000000000001',1,'hide','fixture moderation',current_setting('test.comment_report_id')::uuid,'Hidden after review')$$,'Hide and resolve report atomically');
reset role;
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000002","session_id":"46000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_get_review_comment('76000000-0000-4000-8000-000000000003',1,1,true),null::jsonb,'Hidden root excludes replies');
select ok(not exists(select 1 from jsonb_array_elements(public.toon_list_notifications()->'items') n where n->>'commentId'='76000000-0000-4000-8000-000000000003'),'Hidden thread notification loses target link');
reset role;
select is((select popularity_score from toon_private.toon_review_popularity_metrics('96000000-0000-4000-8000-000000000001')),3::bigint,'Hidden root and its reply author excluded from popularity');

-- Preference gate: new actions do not backfill disabled notifications.
update public.toon_user_settings set notification_preferences=jsonb_set(notification_preferences,'{replies}','false') where user_id='36000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","session_id":"46000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000005','96000000-0000-4000-8000-000000000001',1,null,'preference-secret',true,true)$$,'Create with owner notifications disabled');
select is(public.toon_set_review_like('96000000-0000-4000-8000-000000000001',1,false)->>'likeCount','0','Unlike removes count');
select is(public.toon_set_review_like('96000000-0000-4000-8000-000000000001',1,true)->>'likeCount','1','Relike restores count');
reset role;
select is((select count(*) from public.toon_notifications where review_comment_id='76000000-0000-4000-8000-000000000005'),0::bigint,'No notification when disabled');
select is((select count(*) from public.toon_notifications where kind='review_like'),1::bigint,'Relike within 24 hours creates no extra alert');

-- Creation time, never edits, defines the popularity window.
update public.toon_review_reactions set created_at=now()-interval '169 hours';
update public.toon_review_comments set created_at=now()-interval '169 hours',updated_at=now() where review_id='96000000-0000-4000-8000-000000000001';
select is((select popularity_score from toon_private.toon_review_popularity_metrics('96000000-0000-4000-8000-000000000001')),0::bigint,'Editing old activity does not refresh seven-day popularity');
-- Restoring and then deleting a root preserves existing replies, not its body.
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000003","session_id":"46000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_moderate_review_comment('76000000-0000-4000-8000-000000000001',2,'restore','fixture restoration',null,'')$$,'Restore the root');
reset role;
select is((select popularity_score from toon_private.toon_review_popularity_metrics('96000000-0000-4000-8000-000000000001')),0::bigint,'Restoring old comments does not refresh popularity');
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","session_id":"46000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_delete_review_comment('76000000-0000-4000-8000-000000000001',3,true)$$,'Delete root text');
select is(public.toon_get_review_comment('76000000-0000-4000-8000-000000000001',1)->'author','null'::jsonb,'Deleted root has no public identity');
select is(public.toon_get_review_comment('76000000-0000-4000-8000-000000000001',1)->>'replyCount','1','Deleted root keeps existing reply count');
select is(public.toon_get_review_comment('76000000-0000-4000-8000-000000000003',1,1,true)->>'body','reply-secret','Existing reply remains accessible below deleted root');
select throws_ok($$select public.toon_create_review_comment('76000000-0000-4000-8000-000000000006','96000000-0000-4000-8000-000000000001',1,'76000000-0000-4000-8000-000000000001','late reply',false,true)$$,'P0001','NOT_FOUND','No new replies below deleted root');
reset role;
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","session_id":"46000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_set_user_block('36000000-0000-4000-8000-000000000002',true)$$,'Block the review owner');
select is(public.toon_get_review_like_state('96000000-0000-4000-8000-000000000001'),null::jsonb,'Block hides review reaction state');
select is(public.toon_list_review_comments('96000000-0000-4000-8000-000000000001',1),null::jsonb,'Block hides discussion');
select lives_ok($$select public.toon_delete_review_comment('76000000-0000-4000-8000-000000000002',1,true)$$,'Own text removal remains possible after losing access');
reset role;
select is((select count(*) from public.toon_review_reactions),0::bigint,'Block cleans review reactions in the same transaction');
select is((select body from public.toon_review_comments where id='76000000-0000-4000-8000-000000000002'),null::text,'Deleted text is scrubbed');
-- Work visibility is rechecked even for an otherwise published review.
update public.toon_works set catalogue_status='hidden' where id='56000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.toon_get_review_like_state('96000000-0000-4000-8000-000000000001'),null::jsonb,'Hidden work removes review engagement');
select is(public.toon_list_review_comments('96000000-0000-4000-8000-000000000001',1),null::jsonb,'Hidden work removes discussion');
select is(public.toon_search_reviews('56000000-0000-4000-8000-000000000002',null,1,'popular'),null::jsonb,'Hidden work has no discovery list');
select is(jsonb_array_length(public.toon_search_reviews(null,'review_2',1,'latest')->'items'),0,'Author list excludes hidden works');
reset role;
update public.toon_works set catalogue_status='published' where id='56000000-0000-4000-8000-000000000002';
update public.toon_reviews set publication_status='draft',version=2 where id='96000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000003","session_id":"46000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_moderation_review_comment_snapshot('76000000-0000-4000-8000-000000000003',1,true)->>'body',null::text,'Moderator cannot read comments of withdrawn reviews');
reset role;
select * from finish();
rollback;
