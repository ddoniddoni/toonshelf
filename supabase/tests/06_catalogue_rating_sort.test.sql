-- Synthetic rollback fixtures only. Written, not executed or used as public data.
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
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data)
 select ('34000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'catalogue-rating-' || n || '@example.test',now(),false,'{}' from generate_series(1,5) n;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select ('44000000-0000-4000-8000-' || right(id::text,12))::uuid,id,now(),now() from auth.users where id::text like '34000000-%';
update public.profiles set username = 'rating_reader_' || right(id::text,1),display_name = '[테스트] 평점',onboarding_completed_at = now() where id::text like '34000000-%';
update private.user_access set status = 'active' where user_id::text like '34000000-%';
insert into private.consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '34000000-%';
update private.user_access set status = 'suspended' where user_id = '34000000-0000-4000-8000-000000000005';
insert into public.works(id,slug,title,search_text,serial_status,age_rating,catalogue_status,is_test,merged_into_id,created_at)
 select ('54000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'rating-fixture-' || n,
  '[테스트] catalogue-rating-fixture ' || case n when 1 then '%_ Alpha' when 2 then 'Beta' when 3 then 'Gamma' when 4 then 'Delta' when 5 then 'Epsilon' when 6 then 'Zeta' else 'Unavailable ' || n end,
  'catalogue-rating-fixture ' || n,'ongoing',case n when 8 then '19'::public.age_rating when 9 then 'unknown'::public.age_rating else 'all'::public.age_rating end,
  case n when 7 then 'hidden'::public.catalogue_status when 11 then 'merged'::public.catalogue_status else 'published'::public.catalogue_status end,n = 10,
  case when n = 11 then '54000000-0000-4000-8000-000000000001'::uuid else null end,'2020-01-01'::timestamptz + n * interval '1 day' from generate_series(1,11) n;
insert into public.work_platforms(work_id,platform_id,official_url,weekdays,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,array[1]::smallint[],w.age_rating,now()
 from public.works w cross join public.platforms p where w.id::text like '54000000-%' and p.code = 'naver_webtoon';
insert into public.work_platforms(work_id,platform_id,official_url,weekdays,age_rating,verified_at)
 select '54000000-0000-4000-8000-000000000001',id,'https://ridibooks.com/toonshelf-test-only/rating-fixture-1',array[2]::smallint[],'all',now() from public.platforms where code = 'ridi';
insert into public.work_genres(work_id,genre_id)
 select '54000000-0000-4000-8000-000000000001',id from public.genres where slug in ('fantasy','action');
insert into public.creators(id,name,aliases) values ('64000000-0000-4000-8000-000000000001','[테스트] 평점 작가',array['rating-author-alias']);
insert into public.work_creators(work_id,creator_id,role)
 select '54000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001',r from unnest(array['writer','artist']) r;
select private.refresh_work_search(id) from public.works where id::text like '54000000-%';
insert into public.library_entries(user_id,work_id,status,visibility)
 select p.id,w.id,'reading',case when p.id = '34000000-0000-4000-8000-000000000001' then 'private'::public.visibility else 'public'::public.visibility end
 from public.profiles p cross join public.works w where p.id::text like '34000000-%' and w.id::text like '54000000-%';
insert into public.user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility) values
 ('34000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',10,'S','public'),
 ('34000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000001',6,null,'public'),
 ('34000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002',8,null,'public'),
 ('34000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000003',9,'A','public'),
 ('34000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000003',10,'S','private'),
 ('34000000-0000-4000-8000-000000000005','54000000-0000-4000-8000-000000000003',10,null,'public'),
 ('34000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000004',4,null,'public'),
 ('34000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000004',5,null,'public'),
 ('34000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000004',4,null,'public'),
 ('34000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000005',null,'S','public'),
 ('34000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000006',10,'S','private');
insert into public.user_evaluations(user_id,work_id,rating_steps,visibility)
 select '34000000-0000-4000-8000-000000000001',id,10,'public' from public.works where id::text like '54000000-%' and right(id::text,12)::integer >= 7;
insert into public.library_private_details(user_id,work_id,private_note,tags,last_read_episode)
 values ('34000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','rating-private-note',array['rating-private-tag'],55);
create function public.test_catalogue_rating_search(p_after jsonb default null,p_limit integer default 24,p_sort text default 'rating') returns jsonb
language sql set search_path = '' as $$ select public.search_catalogue('catalogue-rating-fixture','{}','{}',null,'{}',null,p_sort,p_after,p_limit); $$;
grant execute on function public.test_catalogue_rating_search(jsonb,integer,text) to anon,authenticated;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.test_catalogue_rating_search()->>'total','6','Hidden/adult/unknown/test/merged works never enter count or rating ordering');
select is(public.test_catalogue_rating_search()->'items'->0->>'id','54000000-0000-4000-8000-000000000003','Public 4.5 sorts ahead of private/suspended five-star ratings');
select is(public.test_catalogue_rating_search()->'items'->0->'rating','{"average":4.5,"ratingCount":1}'::jsonb,'Only visible public stars form average and denominator');
select is(public.test_catalogue_rating_search()->'items'->1->'rating','{"average":4,"ratingCount":2}'::jsonb,'Two links, genres and creator roles never multiply evaluations');
select is(public.test_catalogue_rating_search()->'items'->1->>'id','54000000-0000-4000-8000-000000000001','Equal average sorts greater public count first');
select is(public.test_catalogue_rating_search()->'items'->4->'rating','{"average":null,"ratingCount":0}'::jsonb,'Tier-only evaluations are not star samples');
select is(public.test_catalogue_rating_search()->'items'->5->'rating','{"average":null,"ratingCount":0}'::jsonb,'Private stars are indistinguishable from no public stars');
select is(public.search_catalogue('catalogue-rating-fixture',array['naver_webtoon'],'{}',null,array[2],null,'rating',null,24)->>'total','0','Platform/day continue to match the same official link');
select is(public.search_catalogue('catalogue-rating-fixture',array['ridi'],array['fantasy'],null,array[2],'all','rating',null,24)->'items'->0->'rating','{"average":4,"ratingCount":2}'::jsonb,'Metadata filters keep the complete public evaluation sample of the matching work');
select is(public.search_catalogue('catalogue-rating-fixture %_','{}','{}',null,'{}',null,'rating',null,24)->>'total','1','Wildcard characters remain literal in rating search');
select is(public.search_catalogue('rating-author-alias','{}','{}',null,'{}',null,'rating',null,24)->'items'->0->'rating'->>'ratingCount','2','Creator alias search preserves one rating per user/work');
select ok(not (public.test_catalogue_rating_search()::text like '%rating-private-note%' or public.test_catalogue_rating_search()::text like '%rating-private-tag%'),'Public results never include private details');
select ok(not ((public.test_catalogue_rating_search()->'items'->0->'rating') ?| array['userId','status','updatedAt','createdAt','canonicalTier']),'Rating DTO contains aggregates only');
select set_config('test.rating.full',public.test_catalogue_rating_search()::text,true);
select set_config('test.rating.first',public.test_catalogue_rating_search(null,2)::text,true);
select set_config('test.rating.second',public.test_catalogue_rating_search(current_setting('test.rating.first')::jsonb->'next',2)::text,true);
select set_config('test.rating.third',public.test_catalogue_rating_search(current_setting('test.rating.second')::jsonb->'next',2)::text,true);
select is(current_setting('test.rating.first')::jsonb->'next'->>'ratingSum','16','Cursor uses exact unrounded star-step sum');
select is(current_setting('test.rating.second')::jsonb->'next'->>'ratingSum','13','Repeating averages retain their integer sum');
select is(current_setting('test.rating.second')::jsonb->'next'->>'ratingCount','3','Repeating averages retain their denominator');
select is(current_setting('test.rating.third')::jsonb->'next','null'::jsonb,'Final unrated page ends the cursor');
select is((select count(distinct item->>'id')::integer from (
 select jsonb_array_elements(current_setting('test.rating.first')::jsonb->'items') item union all
 select jsonb_array_elements(current_setting('test.rating.second')::jsonb->'items') item union all
 select jsonb_array_elements(current_setting('test.rating.third')::jsonb->'items') item) pages),6,'Live unchanged dataset pages have no duplicate or missing work');
select is(public.test_catalogue_rating_search('{"id":"54000000-0000-4000-8000-000000000005","ratingSum":0,"ratingCount":0,"viewerId":null}',2)->'items'->0->>'id','54000000-0000-4000-8000-000000000006','Unrated tie advances by ID');
select is(public.test_catalogue_rating_search(null,2,'latest')->'items'->0->>'id','54000000-0000-4000-8000-000000000006','Latest order remains unchanged while adding public summaries');
select lives_ok($$select public.test_catalogue_rating_search(public.test_catalogue_rating_search(null,2,'title')->'next',2,'title')$$,'Existing title cursor remains valid');
select throws_ok($$select public.test_catalogue_rating_search('{"id":"54000000-0000-4000-8000-000000000001","ratingSum":"16","ratingCount":2,"viewerId":null}')$$,'P0001','VALIDATION_ERROR','Reject stringified sums in direct RPC');
select throws_ok($$select public.test_catalogue_rating_search('{"id":"54000000-0000-4000-8000-000000000001","ratingSum":16.5,"ratingCount":2,"viewerId":null}')$$,'P0001','VALIDATION_ERROR','Reject fractional cursor sums');
select throws_ok($$select public.test_catalogue_rating_search('{"id":"54000000-0000-4000-8000-000000000001","ratingSum":0,"ratingCount":2,"viewerId":null}')$$,'P0001','VALIDATION_ERROR','Reject impossible sample sums');
select throws_ok($$select public.test_catalogue_rating_search('{"id":"54000000-0000-4000-8000-000000000001","ratingSum":16,"ratingCount":2,"viewerId":null,"userId":"another-owner"}')$$,'P0001','VALIDATION_ERROR','Unknown/private cursor keys are rejected');
select throws_ok($$select public.test_catalogue_rating_search('{"id":"54000000-0000-4000-8000-000000000001","ratingSum":16,"ratingCount":2}')$$,'P0001','VALIDATION_ERROR','Caller scope is required');
select throws_ok($$select public.test_catalogue_rating_search('{"id":"54000000-0000-4000-8000-000000000001","createdAt":"2020-01-01T00:00:00Z","title":"Alpha"}')$$,'P0001','VALIDATION_ERROR','Metadata cursors cannot enter rating sorting');
select throws_ok($$select public.test_catalogue_rating_search(null,51)$$,'P0001','VALIDATION_ERROR','Direct RPC page size remains bounded');
reset role;
update public.user_evaluations set rating_steps = 1 where user_id = '34000000-0000-4000-8000-000000000002' and visibility = 'private';
update public.library_private_details set private_note = 'changed-rating-private-note',last_read_episode = 66 where user_id = '34000000-0000-4000-8000-000000000001';
update public.library_entries set status = 'dropped' where user_id = '34000000-0000-4000-8000-000000000001';
set local role anon;
select is(public.test_catalogue_rating_search()::text,current_setting('test.rating.full'),'Private stars/notes/status changes cannot change public payload or sorting');
reset role;
update public.user_evaluations set rating_steps = 9 where user_id = '34000000-0000-4000-8000-000000000001' and work_id = '54000000-0000-4000-8000-000000000001';
set local role anon;
select throws_ok($$select public.test_catalogue_rating_search(current_setting('test.rating.first')::jsonb->'next',2)$$,'P0001','VALIDATION_ERROR','Changed public anchor rating requires page restart');
reset role;
update public.user_evaluations set rating_steps = 10 where user_id = '34000000-0000-4000-8000-000000000001' and work_id = '54000000-0000-4000-8000-000000000001';
update public.works set catalogue_status = 'hidden' where id = '54000000-0000-4000-8000-000000000001';
set local role anon;
select throws_ok($$select public.test_catalogue_rating_search(current_setting('test.rating.first')::jsonb->'next',2)$$,'P0001','VALIDATION_ERROR','Hidden anchor never continues from stored public ratings');
reset role;
update public.works set catalogue_status = 'published' where id = '54000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000002","session_id":"44000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.test_catalogue_rating_search(current_setting('test.rating.first')::jsonb->'next',2)$$,'P0001','VALIDATION_ERROR','Anonymous rating cursor cannot be reused after login');
select is(public.test_catalogue_rating_search()->'items'->5->'rating','{"average":null,"ratingCount":0}'::jsonb,'Caller own private stars are excluded too');
select lives_ok($$select public.set_user_block('34000000-0000-4000-8000-000000000001',true)$$,'Viewer can block a rating author');
select is(public.search_catalogue('catalogue-rating-fixture Gamma','{}','{}',null,'{}',null,'rating',null,24)->'items'->0->'rating','{"average":null,"ratingCount":0}'::jsonb,'Viewer block excludes author from public denominator');
select lives_ok($$select public.set_user_block('34000000-0000-4000-8000-000000000001',false)$$,'Viewer removes block');
reset role;
insert into public.blocks(blocker_id,blocked_id) values ('34000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(public.search_catalogue('catalogue-rating-fixture Gamma','{}','{}',null,'{}',null,'rating',null,24)->'items'->0->'rating','{"average":null,"ratingCount":0}'::jsonb,'Reverse block excludes public rating author');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.search_catalogue('catalogue-rating-fixture Gamma','{}','{}',null,'{}',null,'rating',null,24)->'items'->0->'rating','{"average":4.5,"ratingCount":1}'::jsonb,'Anonymous aggregates still follow public visibility');
reset role;
update public.user_evaluations set visibility = 'private' where work_id = '54000000-0000-4000-8000-000000000003' and user_id = '34000000-0000-4000-8000-000000000001';
set local role anon;
select is(public.search_catalogue('catalogue-rating-fixture Gamma','{}','{}',null,'{}',null,'rating',null,24)->'items'->0->'rating','{"average":null,"ratingCount":0}'::jsonb,'Public withdrawal applies to next request without cached scores');
reset role;
update private.user_access set status = 'suspended' where user_id = '34000000-0000-4000-8000-000000000001';
set local role anon;
select is(public.search_catalogue('catalogue-rating-fixture Beta','{}','{}',null,'{}',null,'rating',null,24)->'items'->0->'rating','{"average":null,"ratingCount":0}'::jsonb,'Suspension removes public stars on next request');
reset role;
select * from finish();
rollback;
