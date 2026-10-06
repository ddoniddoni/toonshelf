-- Synthetic accounts only in a rollback transaction. Never seed real users.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to anon, authenticated;
-- pgTAP assertions must remain callable after switching test roles.
do $$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p
    join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap'
  loop execute format('grant execute on function %s to anon, authenticated',v_function); end loop;
end;
$$;
select no_plan();

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,is_anonymous)
values ('10000000-0000-4000-8000-000000000001','a@example.test',now(),'{"role":"admin"}',false),
       ('10000000-0000-4000-8000-000000000002','b@example.test',now(),'{}',false),
       ('10000000-0000-4000-8000-000000000003','pending@example.test',null,'{}',false);
-- Local transactional fixtures only: shared Auth identities do not auto-enroll.
insert into public.toon_profiles(id) select id from auth.users where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003') on conflict(id) do nothing;
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003') on conflict(user_id) do nothing;
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003') on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id,created_at,updated_at)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now(),now()),
       ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',now(),now()),
       ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',now(),now());
select is((select count(*) from public.toon_profiles where id::text like '10000000-%'),3::bigint,'Explicit pending fixtures create minimum profile rows');
select is((select role::text from toon_private.toon_user_access where user_id='10000000-0000-4000-8000-000000000001'),'user','Editable metadata cannot assign admin role');
select ok(not has_function_privilege('authenticated','public.toon_issue_reauth_ticket(uuid,uuid,text,text)','execute'),'Users cannot issue proof tickets');
select ok(not has_function_privilege('anon','public.toon_complete_onboarding(text,text,text,public.toon_visibility,public.toon_visibility,uuid[],text,boolean,boolean,boolean)','execute'),'Anon cannot onboard');
select ok(not has_table_privilege('authenticated','public.toon_profiles','update'),'Profile DML cannot bypass RPC invariants');
select ok(not has_table_privilege('authenticated','public.toon_user_settings','update'),'Settings DML cannot bypass RPC validation');

set local role anon;
select is((select count(*) from public.toon_profiles where id::text like '10000000-%'),0::bigint,'Pending accounts have no public profiles');
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select is(public.toon_get_my_access()->>'status','pending','Verified new user is still pending');
select throws_ok($$select public.toon_save_profile('테스트 독자','',false)$$,'P0001','ONBOARDING_REQUIRED','Pending user cannot edit profile');
select throws_ok($$select public.toon_complete_onboarding('reader_a','테스트 독자','','private','private','{}','2026-10-02-preview',false,true,true)$$,'P0001','VALIDATION_ERROR','Missing consent cannot activate user');
select lives_ok($$select public.toon_complete_onboarding('reader_a','테스트 독자','','private','private','{}','2026-10-02-preview',true,true,true)$$,'Confirmed consenting user completes onboarding');
select is(public.toon_get_my_access()->>'status','active','Onboarding activates account atomically');
select is((select default_library_visibility::text from public.toon_user_settings where user_id='10000000-0000-4000-8000-000000000001'),'private','Library default remains private');
select is((select count(*) from public.toon_user_settings where user_id='10000000-0000-4000-8000-000000000002'),0::bigint,'A cannot read B settings');
select throws_ok($$update public.toon_profiles set username='changed' where id='10000000-0000-4000-8000-000000000001'$$,'42501',null,'Direct username mutation denied');
select throws_ok($$select public.toon_complete_onboarding('changed','테스트 독자','','private','private','{}','2026-10-02-preview',true,true,true)$$,'P0001','FORBIDDEN','Username immutable after onboarding');
select throws_ok($$select public.toon_save_settings('private','private','system','Asia/Seoul','{"role":"admin"}','{}')$$,'P0001','VALIDATION_ERROR','Notification JSON keys validated in DB');
select throws_ok($$select public.toon_save_settings('private','private','system','Asia/Seoul','{"followers":true,"replies":true,"reactions":true,"announcements":true}',array['99999999-0000-4000-8000-000000000001']::uuid[])$$,'P0001','VALIDATION_ERROR','Nonexistent genre rejected');
select throws_ok($$select public.toon_consume_reauth_ticket(repeat('a',64),'password_reset')$$,'P0001','FORBIDDEN','Normal login does not grant password reset');
select throws_ok($$insert into storage.objects(bucket_id,name) values('toon_avatars','10000000-0000-4000-8000-000000000001/raw.svg')$$,'42501',null,'Direct unvalidated avatar upload denied');
reset role;

-- A server-issued ticket is tied to one session, one purpose and one use.
select public.toon_issue_reauth_ticket('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',repeat('a',64),'password_change');
set local role authenticated;
select throws_ok($$select public.toon_consume_reauth_ticket(repeat('a',64),'email_change')$$,'P0001','FORBIDDEN','Ticket cannot change purpose');
select is(public.toon_consume_reauth_ticket(repeat('a',64),'password_change'),true,'Correct ticket consumed once');
select throws_ok($$select public.toon_consume_reauth_ticket(repeat('a',64),'password_change')$$,'P0001','FORBIDDEN','Ticket replay denied');
reset role;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select throws_ok($$select public.toon_complete_onboarding('reader_c','테스트 독자','','private','private','{}','2026-10-02-preview',true,true,true)$$,'P0001','EMAIL_UNVERIFIED','Unconfirmed email cannot onboard');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is((select count(*) from public.toon_profiles where username='reader_a'),1::bigint,'Anon can read active public profile');
reset role;

update toon_private.toon_user_access set status='suspended' where user_id='10000000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*) from public.toon_profiles where username='reader_a'),0::bigint,'Suspension immediately hides public profile');
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select throws_ok($$select public.toon_save_profile('변경 시도','',true)$$,'P0001','FORBIDDEN','Suspended user cannot write with an existing JWT');
reset role;
update toon_private.toon_user_access set status='active' where user_id='10000000-0000-4000-8000-000000000001';
delete from auth.sessions where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.toon_save_profile('변경 시도','',true)$$,'P0001','AUTH_REQUIRED','Revoked session cannot write even before JWT expiry');
reset role;
select * from finish();
rollback;
