-- Local rollback fixtures WRITTEN ONLY. Never run on the shared project.
-- Pair-lock races require separate requested multi-session verification.
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
 select ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'follow-'||n||'@example.test',
 case when n=7 then null else now() end,false,'{"role":"admin"}' from generate_series(1,30) n;
insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
 select id,'follow_'||right(id::text,12)::integer,'[test] reader',now() from auth.users where id::text like '32000000-0000-4000-8000-%';
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id::text like '32000000-0000-4000-8000-%';
insert into toon_private.toon_user_access(user_id,status)
 select id,case right(id::text,12)::integer when 4 then 'suspended'::public.toon_access_status when 5 then 'pending'::public.toon_access_status
 when 6 then 'deleting'::public.toon_access_status else 'active'::public.toon_access_status end
 from public.toon_profiles where id::text like '32000000-0000-4000-8000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k
 where p.id::text like '32000000-0000-4000-8000-%' and not(right(p.id::text,12)::integer=8 and k='age_14');
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('42000000-0000-4000-8000-'||right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '32000000-0000-4000-8000-%';
insert into public.toon_follows(follower_id,following_id,created_at)
 select id,'32000000-0000-4000-8000-000000000001',now()-interval '1 hour' from public.toon_profiles
 where id::text like '32000000-0000-4000-8000-%' and id<>'32000000-0000-4000-8000-000000000001';
insert into public.toon_follows(follower_id,following_id) values
 ('32000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000002'),
 ('32000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000003'),
 ('32000000-0000-4000-8000-000000000003','32000000-0000-4000-8000-000000000002');
select ok(not has_table_privilege('anon','public.toon_follows','SELECT'),'No raw public relationship enumeration');
select ok(not has_table_privilege('authenticated','public.toon_follows','INSERT'),'No forged follower/target insertion');
select ok(not has_table_privilege('authenticated','public.toon_follows','UPDATE'),'No reassignment of relationship ownership');
select ok(not has_table_privilege('authenticated','public.toon_follows','DELETE'),'Other members cannot directly delete a relationship');
select ok(not has_function_privilege('authenticated','toon_private.toon_follow_state(uuid)','EXECUTE'),'Private state helper is not directly callable');
select ok(not has_function_privilege('anon','public.toon_set_user_follow(uuid,boolean)','EXECUTE'),'Anonymous cannot mutate follows');
select throws_ok($$insert into public.toon_follows(follower_id,following_id) values('32000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001')$$,
 '23514',null,'Table rejects self follows even for privileged fixtures');
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.toon_get_public_follow_state('follow_1')->>'followerCount','24','Inactive/unverified/missing-consent profiles excluded from actual count');
select is(public.toon_get_public_follow_state('follow_1')->>'followingCount','1','Following and followers have independent directions');
select is(public.toon_get_public_follow_state('follow_1')->>'canFollow','false','Guest gets no mutation capability');
select is(public.toon_get_public_follow_state('follow_1')->>'following','false','Guest does not inherit member follow state');
select is(jsonb_array_length(public.toon_list_public_follows('follow_1','followers',1)->'items'),20,'List is bounded at 20 after filtering');
select is(public.toon_list_public_follows('follow_1','followers',1)->>'hasNext','true','Second page acknowledged');
select is(jsonb_array_length(public.toon_list_public_follows('follow_1','followers',2)->'items'),4,'No invalid profiles or duplicates on second page');
select is(public.toon_list_public_follows('follow_1','followers',2)->'items'->0->>'username','follow_27','Equal timestamps use stable target UUID order');
select is(public.toon_list_public_follows('follow_1','following',1)->'items'->0->>'username','follow_2','Following route returns followed users');
select is(public.toon_get_public_follow_state('follow_4'),null::jsonb,'Suspended target concealed');
select is(public.toon_list_public_follows('missing_user','followers',1),null::jsonb,'Unknown profile does not become a fabricated empty list');
select is(public.toon_get_public_follow_state('follow_1')->>'isSelf','false','Guest has no self status');
select ok(public.toon_list_public_follows('follow_1','followers',1)::text !~ 'example.test|user_access|role|consent|privateMemo','Only public identity projection');
select throws_ok($$select public.toon_list_public_follows('follow_1','followers',0)$$,'P0001','VALIDATION_ERROR','Zero page rejected');
select throws_ok($$select public.toon_list_public_follows('follow_1','followers',1001)$$,'P0001','VALIDATION_ERROR','Large offset rejected');
select throws_ok($$select public.toon_list_public_follows('follow_1','likes',1)$$,'P0001','VALIDATION_ERROR','Unknown relationship direction rejected');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000003","session_id":"42000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000003',true)$$,'P0001','SELF_FOLLOW','Forged metadata cannot allow self follow');
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000004',true)$$,'P0001','NOT_FOUND','Suspended target cannot be followed');
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000002',null)$$,'P0001','VALIDATION_ERROR','Null desired flag rejected');
select is(public.toon_set_user_follow('32000000-0000-4000-8000-000000000001',true)->>'followerCount','24','Retry of already-following is idempotent');
select is(public.toon_set_user_follow('32000000-0000-4000-8000-000000000001',false)->>'following','false','Unfollow acknowledges desired state');
select is(public.toon_set_user_follow('32000000-0000-4000-8000-000000000001',false)->>'followerCount','23','Retry of unfollow does not affect other members');
select is(public.toon_set_user_follow('32000000-0000-4000-8000-000000000001',true)->>'following','true','Can follow again');
select lives_ok($$select public.toon_set_user_block('32000000-0000-4000-8000-000000000002',true)$$,'Blocking performs transactional cleanup');
select is(public.toon_get_public_follow_state('follow_2'),null::jsonb,'Viewer cannot access blocked profile');
select is(public.toon_get_public_follow_state('follow_1')->>'followerCount','23','Third-party list count excludes viewer-blocked member');
select is(public.toon_get_public_follow_state('follow_1')->>'followingCount','0','Third-party following count respects the same filter');
select is(public.toon_list_public_follows('follow_1','followers',1)->'items'->0->>'username','follow_3','Blocked member filtered before paging');
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000002',true)$$,'P0001','NOT_FOUND','Cannot refollow while blocked');
reset role;
select is((select count(*) from public.toon_follows where
 (follower_id='32000000-0000-4000-8000-000000000002' and following_id='32000000-0000-4000-8000-000000000003') or
 (follower_id='32000000-0000-4000-8000-000000000003' and following_id='32000000-0000-4000-8000-000000000002')),0::bigint,'Both relationship directions removed');
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000002","session_id":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000003',true)$$,'P0001','NOT_FOUND','Blocked recipient cannot follow blocker');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000003","session_id":"42000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_set_user_block('32000000-0000-4000-8000-000000000002',false)$$,'Unblock can be retried safely');
select is(public.toon_get_public_follow_state('follow_2')->>'following','false','Unblock never restores prior follows');
select is(public.toon_get_public_follow_state('follow_1')->>'followerCount','24','Unrelated relation remains intact');
select is(public.toon_set_user_follow('ffffffff-ffff-4fff-8fff-ffffffffffff',false),null::jsonb,'Removing a nonexistent target reveals no identity');
reset role;
-- A retained relationship with an inaccessible account can still be removed by its owner.
insert into public.toon_follows(follower_id,following_id) values('32000000-0000-4000-8000-000000000003','32000000-0000-4000-8000-000000000004');
set local role authenticated;
select is(public.toon_set_user_follow('32000000-0000-4000-8000-000000000004',false),null::jsonb,'Owner can cancel an inactive target without revealing a profile');
reset role;
select is((select count(*) from public.toon_follows where follower_id='32000000-0000-4000-8000-000000000003' and following_id='32000000-0000-4000-8000-000000000004'),0::bigint,'Inactive relation actually removed');
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000004","session_id":"42000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000001',true)$$,'P0001','FORBIDDEN','Suspended actor cannot mutate');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000005","session_id":"42000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000001',true)$$,'P0001','ONBOARDING_REQUIRED','Pending actor cannot mutate');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000007","session_id":"42000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000001',true)$$,'P0001','EMAIL_UNVERIFIED','Unverified actor cannot mutate');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000030","session_id":"42000000-0000-4000-8000-000000000030","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_set_user_follow('32000000-0000-4000-8000-000000000002',true)->>'following','true','A fresh actor follows');
reset role;
update toon_private.toon_rate_limit_buckets set request_count=30 where subject_hash=md5('32000000-0000-4000-8000-000000000030') and action='user_follow';
set local role authenticated;
select throws_ok($$select public.toon_set_user_follow('32000000-0000-4000-8000-000000000002',false)$$,'P0001','RATE_LIMITED','Follow limit enforced at direct RPC boundary');
reset role;
select * from finish();
rollback;
