-- WRITTEN ONLY. Local rollback fixtures; never execute on the shared project.
-- Does not prove multi-session concurrency, throughput, browser or Auth flows.
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
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
 select ('35000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'notification-'||n||'@example.test',now(),false from generate_series(1,3) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'notice_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '35000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '35000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status) select id,'active' from public.toon_profiles where id::text like '35000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '35000000-0000-4000-8000-%';
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('45000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '35000000-0000-4000-8000-%';
insert into public.toon_tier_lists(id,user_id) values('75000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000001');
insert into public.toon_tier_list_publications(tier_list_id,version,payload,is_spoiler)
 values('75000000-0000-4000-8000-000000000001',1,'{"title":"secret-spoiler-title","description":"secret-description","tags":[],"rows":[{"id":"65000000-0000-4000-8000-000000000001","label":"S","colorToken":"S","canonicalTier":"S"},{"id":"65000000-0000-4000-8000-000000000002","label":"F","colorToken":"F","canonicalTier":"F"}],"placements":[]}',true);
update public.toon_tier_lists set visibility='public',published_version=1,publication_counter=1 where id='75000000-0000-4000-8000-000000000001';
select set_config('test.notice_tier_version',(select version::text from public.toon_tier_lists where id='75000000-0000-4000-8000-000000000001'),true);
select ok(not has_table_privilege('authenticated','public.toon_notifications','SELECT,INSERT,UPDATE,DELETE'),'Raw notification access denied');
select ok(not has_function_privilege('anon','public.toon_list_notifications(boolean,jsonb)','EXECUTE'),'Anonymous list denied');
select ok(not has_function_privilege('authenticated','toon_private.toon_enqueue_notification(uuid,uuid,text,uuid,uuid,uuid,text)','EXECUTE'),'Members cannot forge notifications');
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select throws_ok($$select public.toon_list_notifications()$$,'P0001','AUTH_REQUIRED','Role alone is not a live session');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.toon_set_user_follow('35000000-0000-4000-8000-000000000001',true);
select public.toon_set_user_follow('35000000-0000-4000-8000-000000000001',false);
select public.toon_set_user_follow('35000000-0000-4000-8000-000000000001',true);
select public.toon_set_tier_like('75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,true);
select public.toon_set_tier_like('75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,false);
select public.toon_set_tier_like('75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,true);
select public.toon_create_tier_comment('85000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,null,'secret-root-comment',true,true);
select public.toon_create_tier_comment('85000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,null,'secret-root-comment',true,true);
reset role;
select is((select count(*) from public.toon_notifications where recipient_id='35000000-0000-4000-8000-000000000001'),3::bigint,'Follow, like and root comment each notify once despite retries');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","session_id":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.toon_create_tier_comment('85000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,'85000000-0000-4000-8000-000000000001','secret-reply-comment',false,true);
reset role;
select is((select count(*) from public.toon_notifications where comment_id='85000000-0000-4000-8000-000000000002'),2::bigint,'Reply notifies parent author and distinct tier owner');
select is((select kind from public.toon_notifications where comment_id='85000000-0000-4000-8000-000000000002' and recipient_id='35000000-0000-4000-8000-000000000002'),'tier_reply','Parent author receives reply kind');
update public.toon_user_settings set notification_preferences=jsonb_set(notification_preferences,'{replies}','false') where user_id='35000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.toon_create_tier_comment('85000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,null,'secret-disabled-comment',false,true);
reset role;
select is((select count(*) from public.toon_notifications where comment_id='85000000-0000-4000-8000-000000000003'),0::bigint,'Disabled preference suppresses future notification');
update public.toon_user_settings set notification_preferences=jsonb_set(notification_preferences,'{replies}','true') where user_id='35000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.toon_create_tier_comment('85000000-0000-4000-8000-000000000004','75000000-0000-4000-8000-000000000001',current_setting('test.notice_tier_version')::bigint,null,'secret-self-comment',false,true);
reset role;
select is((select count(*) from public.toon_notifications where comment_id='85000000-0000-4000-8000-000000000004'),0::bigint,'Own activity never notifies self');
insert into public.toon_catalogue_submissions(id,user_id,kind,proposal,source_url) values('55000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000001','new_work','secret-private-submission','https://example.test/notice');
update public.toon_catalogue_submissions set status='accepted',result_note='secret-result-note',reviewed_at=now() where id='55000000-0000-4000-8000-000000000001';
update public.toon_catalogue_submissions set result_note='secret-updated-note' where id='55000000-0000-4000-8000-000000000001';
select is((select count(*) from public.toon_notifications where submission_id='55000000-0000-4000-8000-000000000001'),1::bigint,'Submission processing notifies once; result edit does not duplicate');
set local role authenticated;
select set_config('test.notice_initial',public.toon_list_notifications()::text,true);
select is(jsonb_array_length(current_setting('test.notice_initial')::jsonb->'items'),5,'Only this recipient notifications returned');
select ok(current_setting('test.notice_initial') !~ 'secret-|example.test|recipient_id|dedupe_key','No source body, titles, private result, contact or raw columns');
select set_config('test.notice_id',current_setting('test.notice_initial')::jsonb->'items'->0->>'id',true);
select set_config('test.notice_read',public.toon_mark_notification_read(current_setting('test.notice_id')::uuid)::text,true);
select is(public.toon_mark_notification_read(current_setting('test.notice_id')::uuid)->>'readAt',current_setting('test.notice_read')::jsonb->>'readAt','Repeated read preserves original timestamp');
select is(public.toon_notification_unread_count(),4::bigint,'Unread count changes after acknowledged read');
select throws_ok($$select public.toon_mark_all_notifications_read('infinity')$$,'P0001','VALIDATION_ERROR','Unbounded cutoff rejected');
select throws_ok($$select public.toon_mark_all_notifications_read('9999-01-01T00:00:00.000000Z')$$,'P0001','VALIDATION_ERROR','Future cutoff rejected');
reset role;
-- A new, later notification must survive mark-all using the prior page boundary.
insert into public.toon_notifications(recipient_id,kind,dedupe_key,created_at)
 values('35000000-0000-4000-8000-000000000001','follow','local-later',((current_setting('test.notice_initial')::jsonb->>'readThrough')::timestamptz)+interval '1 second');
set local role authenticated;
select is((public.toon_mark_all_notifications_read(current_setting('test.notice_initial')::jsonb->>'readThrough')->>'updated')::integer,4,'Mark-all only updates unread rows through supplied boundary');
select is(public.toon_notification_unread_count(),1::bigint,'Later notification remains unread');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","session_id":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_mark_notification_read(current_setting('test.notice_id')::uuid)$$,'P0001','NOT_FOUND','Foreign ID cannot be marked read');
select is(jsonb_array_length(public.toon_list_notifications()->'items'),1,'Another recipient sees only their reply');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","session_id":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.toon_tier_lists set visibility='unlisted' where id='75000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(public.toon_list_notifications()::text !~ '75000000-0000-4000-8000-000000000001|85000000-0000-4000-8000-|tier_like|tier_comment','Unlisted tier removes original kind and target IDs from notifications');
select public.toon_set_user_block('35000000-0000-4000-8000-000000000002',true);
select ok(public.toon_list_notifications()::text !~ 'notice_2|35000000-0000-4000-8000-000000000002','Block hides actor as well as source');
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id='45000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_notification_unread_count()$$,'P0001','AUTH_REQUIRED','Expired sessions cannot read counts');
select throws_ok($$select public.toon_mark_notification_read(current_setting('test.notice_id')::uuid)$$,'P0001','AUTH_REQUIRED','Expired sessions cannot mutate read state');
reset role;
select * from finish();
rollback;
