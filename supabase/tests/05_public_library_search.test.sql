-- Rollback-only synthetic fixtures. Written, not executed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
grant usage on schema extensions to anon,authenticated;
do $$ declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap'
 loop execute format('grant execute on function %s to anon,authenticated',f);end loop;
end;$$;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values
 ('33000000-0000-4000-8000-000000000001','public-library-a@example.test',now(),false,'{}'),
 ('33000000-0000-4000-8000-000000000002','public-library-b@example.test',now(),false,'{}');
-- Local transactional fixtures only: shared Auth identities do not auto-enroll.
insert into public.toon_profiles(id) select id from auth.users where id in ('33000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002') on conflict(id) do nothing;
insert into public.toon_user_settings(user_id) select id from public.toon_profiles where id in ('33000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002') on conflict(user_id) do nothing;
insert into toon_private.toon_user_access(user_id) select id from public.toon_profiles where id in ('33000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002') on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('43000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001',now(),now()),
 ('43000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000002',now(),now());
update public.toon_profiles set username = case id when '33000000-0000-4000-8000-000000000001' then 'public_library_a' else 'public_library_b' end,
 display_name = '[테스트] 공개 서재',onboarding_completed_at = now() where id::text like '33000000-%';
update toon_private.toon_user_access set status = 'active' where user_id::text like '33000000-%';
insert into toon_private.toon_consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.toon_profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '33000000-%';
insert into public.toon_works(id,slug,title,search_text,age_rating,catalogue_status) values
 ('53000000-0000-4000-8000-000000000001','public-library-alpha','[테스트] Alpha %_','[테스트] alpha %_ alias-author','all','published'),
 ('53000000-0000-4000-8000-000000000002','public-library-beta','[테스트] Beta','[테스트] beta','all','published'),
 ('53000000-0000-4000-8000-000000000003','public-library-gamma','[테스트] Gamma','[테스트] gamma','all','published'),
 ('53000000-0000-4000-8000-000000000004','public-library-hidden','[테스트] Hidden','[테스트] hidden','all','hidden');
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,'all',now()
 from public.toon_works w cross join public.toon_platforms p where w.id::text like '53000000-%' and p.code = 'naver_webtoon';
insert into public.toon_work_genres(work_id,genre_id)
 select '53000000-0000-4000-8000-000000000003',id from public.toon_genres where slug = 'fantasy';
insert into public.toon_library_entries(user_id,work_id,status,visibility) values
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','reading','private'),
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000002','completed','public'),
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000003','reading','public'),
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000004','reading','public');
insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility) values
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',9,'A','public'),
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000002',10,'S','private'),
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000003',2,'C','public');
insert into public.toon_library_private_details(user_id,work_id,private_note,last_read_episode,tags) values
 ('33000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','fixture-private-note',44,array['private-tag']);
create function public.toon_test_public_library_filters(p_patch jsonb default '{}') returns jsonb
language sql set search_path = '' as $$
 select jsonb_build_object('q','','status',null,'platform',null,'genre',null,'rating',null,'tier',null,'sort','title') || p_patch;
$$;
grant execute on function public.toon_test_public_library_filters(jsonb) to anon,authenticated;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1)->>'total','3','Hidden work excluded; independent public status/evaluation records included once');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1)->'items'->0->>'status',null::text,'Evaluation-only work never exposes private status');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"status":"reading"}'),1)->>'total','1','Private reading status cannot affect filtered result count');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"rating":10}'),1)->>'total','0','Private rating cannot affect filtered result count');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"tier":"S"}'),1)->>'total','0','Private canonical tier cannot affect filtered result count');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"status":"completed"}'),1)->'items'->0->>'ratingSteps',null::text,'Public reading status does not expose private evaluation');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"rating":9,"tier":"A"}'),1)->>'total','1','Public evaluation remains searchable with private library status');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"status":"completed","rating":9}'),1)->>'total','0','Combined conditions must match the same projected public record');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"q":"%_"}'),1)->>'total','1','SQL LIKE wildcards are treated as literal search text');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"q":"ALIAS-AUTHOR"}'),1)->>'total','1','Public normalized alias/author search is case insensitive');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"platform":"naver_webtoon","genre":"fantasy"}'),1)->>'total','1','Platform and genre narrow the same public work');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"sort":"rating"}'),1)->'items'->0->'work'->>'id','53000000-0000-4000-8000-000000000001','Private five-star rating never sorts ahead of public ratings');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"sort":"tier"}'),1)->'items'->0->'work'->>'id','53000000-0000-4000-8000-000000000001','Tier ordering uses public A, not private S');
select ok(not (public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1)::text like '%fixture-private-note%'),'Private note never appears anywhere in response');
select ok(not ((public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1)->'items'->0) ?| array['note','episode','tags','preferredLink','startedOn','finishedOn','updatedAt','createdAt']),'No private details or personal activity timestamps in public DTO');
select throws_ok($$select public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"tag":"private-tag"}'),1)$$,'P0001','VALIDATION_ERROR','Direct RPC rejects private filter fields');
select throws_ok($$select public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"sort":"updated"}'),1)$$,'P0001','VALIDATION_ERROR','Direct RPC rejects private activity sorting');
select throws_ok($$select public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"rating":2.5}'),1)$$,'P0001','VALIDATION_ERROR','RPC rejects fractional rating steps');
select throws_ok($$select public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"status":["reading"]}'),1)$$,'P0001','VALIDATION_ERROR','RPC rejects malformed scalar filters');
select throws_ok($$select public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1001)$$,'P0001','VALIDATION_ERROR','Pagination bounded before offset calculation');
select throws_ok($$select public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"platform":"missing_platform"}'),1)$$,'P0001','VALIDATION_ERROR','Inactive or nonexistent taxonomy is not silently ignored');
select is(public.toon_search_public_library('missing_reader',public.toon_test_public_library_filters(),1),null::jsonb,'Unavailable profile returns no library');
select set_config('test.public_library_before',public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"sort":"rating"}'),1)::text,true);
reset role;
update public.toon_user_evaluations set rating_steps = 1,canonical_tier = 'F' where user_id = '33000000-0000-4000-8000-000000000001' and work_id = '53000000-0000-4000-8000-000000000002';
update public.toon_library_entries set status = 'dropped' where user_id = '33000000-0000-4000-8000-000000000001' and work_id = '53000000-0000-4000-8000-000000000001';
set local role anon;
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"sort":"rating"}'),1)::text,current_setting('test.public_library_before'),'Private status/rating changes cannot alter public payload or ordering');
reset role;

-- More than one full page; use only rollback fixtures, never production data.
insert into public.toon_works(id,slug,title,search_text,age_rating,catalogue_status)
 select ('53000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'public-library-page-' || n,'[테스트] Page ' || n,'[테스트] page ' || n,'all','published' from generate_series(10,36) n;
insert into public.toon_work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,'all',now()
 from public.toon_works w cross join public.toon_platforms p where w.slug like 'public-library-page-%' and p.code = 'naver_webtoon';
insert into public.toon_library_entries(user_id,work_id,status,visibility)
 select '33000000-0000-4000-8000-000000000001',id,'completed','public' from public.toon_works where slug like 'public-library-page-%';
set local role anon;
select is(jsonb_array_length(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1)->'items'),24,'Page size is 24');
select is(jsonb_array_length(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),2)->'items'),6,'Next page contains remaining matching records');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),2)->>'hasNext','false','Final page has no next link');
select is((select count(distinct item->'work'->>'id')::integer from (
 select jsonb_array_elements(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1)->'items') item
 union all select jsonb_array_elements(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),2)->'items') item) pages),30,'Stable public ordering has no duplicate work across pages');
reset role;
select set_config('request.jwt.claims','{"sub":"33000000-0000-4000-8000-000000000001","session_id":"43000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters('{"rating":1}'),1)->>'total','0','Even owner uses public projection on the public endpoint');
reset role;
select set_config('request.jwt.claims','{"sub":"33000000-0000-4000-8000-000000000002","session_id":"43000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.toon_set_user_block('33000000-0000-4000-8000-000000000001',true)$$,'Viewer blocks library owner');
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1),null::jsonb,'Viewer block applies to filtered endpoint');
reset role;
select set_config('request.jwt.claims','{"sub":"33000000-0000-4000-8000-000000000001","session_id":"43000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.toon_search_public_library('public_library_b',public.toon_test_public_library_filters(),1),null::jsonb,'Reverse block applies to profile visibility');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1)->>'total','30','Blocks do not claim to make public records private to anonymous visitors');
reset role;
update toon_private.toon_user_access set status = 'suspended' where user_id = '33000000-0000-4000-8000-000000000001';
set local role anon;
select is(public.toon_search_public_library('public_library_a',public.toon_test_public_library_filters(),1),null::jsonb,'Suspended owner cannot expose public library');
reset role;
select * from finish();
rollback;
