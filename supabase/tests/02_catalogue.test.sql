-- Rollback-only synthetic fixtures. This file has not been executed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
grant usage on schema extensions to anon,authenticated;
do $$
declare v_function regprocedure;
begin
 for v_function in select p.oid::regprocedure from pg_proc p
  join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap'
 loop execute format('grant execute on function %s to anon, authenticated',v_function); end loop;
end;
$$;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values
 ('30000000-0000-4000-8000-000000000001','catalogue-a@example.test',now(),false,'{"role":"admin"}'),
 ('30000000-0000-4000-8000-000000000002','catalogue-b@example.test',now(),false,'{}');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now(),now()),
 ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',now(),now());
update public.profiles set username = case id when '30000000-0000-4000-8000-000000000001' then 'catalogue_a' else 'catalogue_b' end,
 display_name = '[테스트] 독자',onboarding_completed_at = now() where id::text like '30000000-%';
update private.user_access set status = 'active' where user_id::text like '30000000-%';
insert into private.consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '30000000-%';
insert into public.works(id,slug,title,aliases,age_rating,catalogue_status) values
 ('50000000-0000-4000-8000-000000000001','p2-fixture-alpha','[테스트] p2fixture 알파',array['p2별칭'],'all','published'),
 ('50000000-0000-4000-8000-000000000002','p2-fixture-beta','[테스트] p2fixture 베타','{}','12','published'),
 ('50000000-0000-4000-8000-000000000003','p2-fixture-adult','[테스트] p2fixture 성인','{}','19','published'),
 ('50000000-0000-4000-8000-000000000004','p2-fixture-unknown','[테스트] p2fixture 미확인','{}','unknown','published'),
 ('50000000-0000-4000-8000-000000000005','p2-fixture-hidden','[테스트] p2fixture 숨김','{}','all','hidden');
insert into public.work_platforms(work_id,platform_id,official_url,weekdays,age_rating,verified_at)
 select w.id,p.id,'https://comic.naver.com/toonshelf-test-only/' || w.slug,array[1]::smallint[],'all',now()
 from public.works w cross join public.platforms p where w.id::text like '50000000-%' and p.code = 'naver_webtoon';
insert into public.work_platforms(work_id,platform_id,official_url,weekdays,age_rating,verified_at)
 select '50000000-0000-4000-8000-000000000001',p.id,'https://page.kakao.com/toonshelf-test-only/alpha',array[2]::smallint[],'all',now()
 from public.platforms p where p.code = 'kakao_page';
insert into public.creators(id,name,aliases) values('60000000-0000-4000-8000-000000000001','[테스트] p2fixture 작가',array['p2필명']);
insert into public.work_creators(work_id,creator_id,role)
 values('50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','writer');
select private.refresh_work_search(id) from public.works where id::text like '50000000-%';
select ok(not has_table_privilege('authenticated','public.works','update'),'Even admins cannot mutate works through generic DML');
select ok(not has_table_privilege('authenticated','public.catalogue_submissions','insert'),'Suggestion DML cannot forge owner/status');
select ok(not has_schema_privilege('authenticated','private','usage'),'Private source/evidence/audit schema remains inaccessible');
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is((select count(*) from public.works where id::text like '50000000-%'),2::bigint,'Adult/unknown/hidden works excluded by direct REST table reads');
select is((select count(*) from public.work_platforms where work_id = '50000000-0000-4000-8000-000000000003'),0::bigint,'Adult child links are not exposed');
select is(public.get_catalogue_detail('p2-fixture-hidden'),null::jsonb,'Hidden detail RPC returns no metadata');
select is(public.get_catalogue_detail('p2-fixture-adult'),null::jsonb,'Adult detail cannot be opened directly');
select is(public.search_catalogue('p2별칭','{}','{}',null,'{}',null,'latest',null,24)->>'total','1','Alias search finds one canonical work');
select is(public.search_catalogue('p2필명','{}','{}',null,'{}',null,'latest',null,24)->>'total','1','Creator alias is included in normalized search');
select is(public.search_catalogue('p2fixture',array['naver_webtoon'],'{}',null,array[2],null,'latest',null,24)->>'total','0','Platform/day filters must match the same link');
select is(public.search_catalogue('p2fixture%_','{}','{}',null,'{}',null,'latest',null,24)->>'total','0','Percent/underscore do not expand SQL search patterns');
select throws_ok($$select public.search_catalogue('','{}','{}',null,'{}','19','latest',null,24)$$,'P0001','VALIDATION_ERROR','Adult filters cannot open a public path');
select throws_ok($$select public.search_catalogue('','{}','{}',null,'{}',null,'latest',null,51)$$,'P0001','VALIDATION_ERROR','Public result bounds enforced by DB');
reset role;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","session_id":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_my_catalogue_role(),false,'Editable Auth metadata does not grant catalogue administration');
select throws_ok($$select public.admin_catalogue_snapshot('50000000-0000-4000-8000-000000000001')$$,'P0001','FORBIDDEN','Normal member cannot read private sources/rights');
select throws_ok($$select public.admin_upsert_work(null,null,'{}','권한 위조')$$,'P0001','FORBIDDEN','Normal member cannot write using the admin RPC');
select lives_ok($$select public.submit_catalogue_suggestion('new_work',null,'[테스트] 작품 정보와 확인 출처를 제보해요.','https://example.test/source')$$,'Member can submit a pending suggestion');
select is((select status from public.catalogue_submissions where user_id = '30000000-0000-4000-8000-000000000001'),'pending','Server determines pending status');
reset role;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","session_id":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.catalogue_submissions where user_id = '30000000-0000-4000-8000-000000000001'),0::bigint,'B cannot read A proposal');
select throws_ok($$select public.submit_catalogue_suggestion('correction','50000000-0000-4000-8000-000000000003','[테스트] 성인 작품에 대한 제보입니다.','https://example.test/source')$$,'P0001','VALIDATION_ERROR','Suggestions cannot expose forbidden targets');
reset role;
update private.user_access set role = 'admin' where user_id = '30000000-0000-4000-8000-000000000001';
update public.work_platforms set external_id = 'p2alpha' where work_id = '50000000-0000-4000-8000-000000000001'
 and platform_id = (select id from public.platforms where code = 'naver_webtoon');
select set_config('test.catalogue_alpha_link_id',(select id::text from public.work_platforms where external_id = 'p2alpha'),true);
select set_config('test.catalogue_payload',jsonb_build_object(
 'slug','p2-fixture-alpha','title','[테스트] p2fixture 알파','aliases',jsonb_build_array('p2별칭'),'description','[테스트] 직접 작성한 소개입니다.',
 'serialStatus','ongoing','ageRating','all','catalogueStatus','published',
 'creators',jsonb_build_array(jsonb_build_object('id','60000000-0000-4000-8000-000000000001','name','[테스트] p2fixture 작가','aliases',jsonb_build_array('p2필명'),'role','writer','order',0)),
 'genreIds','[]'::jsonb,'links',jsonb_build_array(jsonb_build_object(
  'platformId',(select id from public.platforms where code = 'naver_webtoon'),'url','https://comic.naver.com/toonshelf-test-only/alpha-new',
  'externalId','p2alpha','weekdays',jsonb_build_array(1),'serialStatus','ongoing','ageRating','all','verifiedAt','2020-01-01T00:00:00Z','active',true)),
 'source',jsonb_build_object('url','https://example.test/p2-info','fields',jsonb_build_array('title','ageRating','links'),'verifiedAt','2020-01-01T00:00:00Z','note','[테스트] 확인 기록')
)::text,true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","session_id":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_my_catalogue_role(),true,'Verified active DB admin can use management');
select throws_ok($$select public.admin_upsert_work('50000000-0000-4000-8000-000000000001',999,'{}','오래된 저장')$$,'P0001','CONFLICT','Expected version prevents stale overwrites');
select is(jsonb_array_length(public.admin_find_duplicates('[테스트] p2fixture 알파','{}')),1,'Exact title yields a reviewable duplicate candidate');
select lives_ok($$select public.admin_upsert_work('50000000-0000-4000-8000-000000000001',1,current_setting('test.catalogue_payload')::jsonb,'공식 주소 갱신 확인')$$,'Admin writes work/relations/source/audit as one transaction');
select is((select id::text from public.work_platforms where external_id = 'p2alpha'),current_setting('test.catalogue_alpha_link_id'),'Changed URL keeps its platform link ID');
select is((select official_url from public.work_platforms where external_id = 'p2alpha'),'https://comic.naver.com/toonshelf-test-only/alpha-new','Changed URL is applied to the same identifier');
select throws_ok($$select public.admin_upsert_work('50000000-0000-4000-8000-000000000001',2,
 jsonb_set(current_setting('test.catalogue_payload')::jsonb,'{links,0,url}','"https://comic.naver.com/toonshelf-test-only/p2-fixture-beta"'),'잘못된 중복 주소')$$,
 'P0001','CONFLICT','Cannot update a link owned by another canonical work');
reset role;
select is((select count(*) from private.catalogue_sources where work_id = '50000000-0000-4000-8000-000000000001'),1::bigint,'Failed writes roll back their private source history');
insert into private.asset_licenses(id,work_id,storage_path,rights_holder,evidence_reference,display_allowed,og_allowed,export_allowed,commercial_allowed,valid_from,expires_at,status)
 values('70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001.webp','[테스트] 권리자','private-evidence-never-public',true,false,false,false,now()-interval '1 day',now()+interval '1 day','active');
update public.works set cover_asset_id = '70000000-0000-4000-8000-000000000001' where id = '50000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{}',true);
set local role anon;
select ok(public.get_cover_access('70000000-0000-4000-8000-000000000001','display') is not null,'Valid display permission can serve through proxy');
select is(public.get_cover_access('70000000-0000-4000-8000-000000000001','export'),null::jsonb,'Display permission does not imply PNG permission');
select is(public.get_cover_access('70000000-0000-4000-8000-000000000001','og'),null::jsonb,'Display permission does not imply OG permission');
select ok(position('private-evidence-never-public' in public.get_catalogue_detail('p2-fixture-alpha')::text) = 0,'Public detail does not contain contract evidence');
select throws_ok($$select * from private.asset_licenses$$,'42501',null,'Direct license read denied');
reset role;
update private.asset_licenses set expires_at = now()-interval '1 hour' where id = '70000000-0000-4000-8000-000000000001';
set local role anon;
select is(public.get_cover_access('70000000-0000-4000-8000-000000000001','display'),null::jsonb,'Expiry immediately denies new image grants');
reset role;
update private.asset_licenses set expires_at = now()+interval '1 day' where id = '70000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","session_id":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.admin_revoke_cover('70000000-0000-4000-8000-000000000001','권리 철회 확인')$$,'Admin can revoke an asset');
select is(public.get_cover_access('70000000-0000-4000-8000-000000000001','display'),null::jsonb,'Revoked display grant denied');
select throws_ok($$insert into storage.objects(bucket_id,name) values('licensed-covers','unvalidated.webp')$$,'42501',null,'Direct unvalidated cover upload denied');
select throws_ok($$select public.admin_merge_works('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',2,1,'동일 작품 검토',false,null,'latest_private')$$,'P0001','VALIDATION_ERROR','Merge confirmation required in DB too');
select throws_ok($$select public.admin_merge_works('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',
 (select version from public.works where id = '50000000-0000-4000-8000-000000000001'),
 (select version from public.works where id = '50000000-0000-4000-8000-000000000002'),'동일 웹툰 병합 확인',true,null,'latest_private')$$,'P0001','MERGE_PREVIEW_EXPIRED','Merge requires a current owner-bound preview token');
select is(public.get_catalogue_detail('p2-fixture-alpha')->>'slug','p2-fixture-alpha','Rejected merge leaves source unchanged');
select is(public.get_catalogue_detail('p2-fixture-beta')->>'ageRating','12','Rejected merge leaves target unchanged');
reset role;
update private.user_access set status = 'suspended' where user_id = '30000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.get_my_catalogue_role(),false,'Suspended admin loses management immediately');
select throws_ok($$select public.admin_catalogue_audit()$$,'P0001','FORBIDDEN','Suspended JWT cannot read audit');
reset role;
select * from finish();
rollback;
