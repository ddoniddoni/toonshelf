-- Local rollback-only fixtures; written but NOT executed against any DB.
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
  values ('36000000-0000-4000-8000-000000000001','other-app@example.test',now(),false,'{}'),
    ('36000000-0000-4000-8000-000000000002','spoof@example.test',now(),false,'{"toonshelf":{"auth_mode":"username","username":"spoof_member"},"role":"admin"}');
select is((select count(*) from public.toon_profiles where id::text like '36000000-%'),0::bigint,'Other apps and editable metadata do not auto-enroll');

-- Simulate the real Auth admin create order: insert, app metadata update, confirmation.
insert into auth.users(id,email,encrypted_password,is_anonymous)
  values ('36000000-0000-4000-8000-000000000003','username_member@username.toonshelf.invalid','local-fixture-not-a-login-hash',false);
update auth.users set raw_app_meta_data = '{"toonshelf":{"auth_mode":"username","username":"username_member","policy_version":"2026-10-02-preview","consents":{"terms":true,"privacy":true,"age_14":true}},"role":"admin"}'
  where id = '36000000-0000-4000-8000-000000000003';
select is((select count(*) from public.toon_profiles where id = '36000000-0000-4000-8000-000000000003'),0::bigint,'Provisioning waits for the admin confirmation update');
update auth.users set email_confirmed_at = now() where id = '36000000-0000-4000-8000-000000000003';
select is((select username from public.toon_profiles where id = '36000000-0000-4000-8000-000000000003'),'username_member','Confirmed app-marked identity gets its immutable username');
select is((select status::text from toon_private.toon_user_access where user_id = '36000000-0000-4000-8000-000000000003'),'active','Signup activates the app membership');
select is((select role::text from toon_private.toon_user_access where user_id = '36000000-0000-4000-8000-000000000003'),'user','Auth metadata does not grant a ToonShelf admin role');
select is((select count(*) from toon_private.toon_consent_records where user_id = '36000000-0000-4000-8000-000000000003'),3::bigint,'Required consent records are stored together');
select is((select default_library_visibility::text from public.toon_user_settings where user_id = '36000000-0000-4000-8000-000000000003'),'private','Signup keeps library records private by default');
select is((select default_evaluation_visibility::text from public.toon_user_settings where user_id = '36000000-0000-4000-8000-000000000003'),'private','Signup keeps evaluations private by default');
update toon_private.toon_user_access set status = 'suspended' where user_id = '36000000-0000-4000-8000-000000000003';
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"other_app_setting":true}' where id = '36000000-0000-4000-8000-000000000003';
select is((select status::text from toon_private.toon_user_access where user_id = '36000000-0000-4000-8000-000000000003'),'suspended','Later Auth updates never reactivate a suspended membership');

select ok(not has_function_privilege('anon','public.toon_reserve_username_signup(text)','execute'),'Anon cannot use the service-only registration reservation');
select ok(not has_function_privilege('authenticated','public.toon_reserve_username_signup(text)','execute'),'Authenticated cannot reserve privileged signup capacity');
select ok(has_function_privilege('service_role','public.toon_reserve_username_signup(text)','execute'),'Server service role can reserve signup capacity');
select ok(public.toon_reserve_username_signup('rate_fixture'),'First signup reservation is allowed');
select ok(public.toon_reserve_username_signup('rate_fixture'),'Second reservation is allowed');
select ok(public.toon_reserve_username_signup('rate_fixture'),'Third reservation is allowed');
select ok(not public.toon_reserve_username_signup('rate_fixture'),'Fourth reservation is limited');
select is((select request_count from toon_private.toon_rate_limit_buckets where subject_hash = md5('toon-signup:rate_fixture') and action = 'username_signup'),4,'Rejected reservation does not roll back its counter');

insert into auth.sessions(id,user_id,created_at,updated_at)
  values ('46000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000001',now(),now());
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"46000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select lives_ok($$select public.toon_enroll_current_account()$$,'Explicit verified OAuth enrollment only creates the current identity membership');
select is(public.toon_get_my_access()->>'status','pending','Enrollment alone does not activate a foreign Auth identity');
reset role;
select is((select count(*) from public.toon_profiles where id = '36000000-0000-4000-8000-000000000002'),0::bigint,'Enrollment never adds the other Auth identity');
select * from finish();
rollback;
