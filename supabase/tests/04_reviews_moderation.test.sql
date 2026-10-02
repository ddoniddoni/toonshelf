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
 ('32000000-0000-4000-8000-000000000001','review-a@example.test',now(),false,'{"role":"admin"}'),
 ('32000000-0000-4000-8000-000000000002','review-b@example.test',now(),false,'{}'),
 ('32000000-0000-4000-8000-000000000003','review-moderator@example.test',now(),false,'{}');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('42000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001',now(),now()),
 ('42000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000002',now(),now()),
 ('42000000-0000-4000-8000-000000000003','32000000-0000-4000-8000-000000000003',now(),now());
update public.profiles set username = case id when '32000000-0000-4000-8000-000000000001' then 'review_a' when '32000000-0000-4000-8000-000000000002' then 'review_b' else 'review_mod' end,
 display_name = '[테스트] 리뷰 독자',onboarding_completed_at = now() where id::text like '32000000-%';
update private.user_access set status = 'active',role = case when user_id = '32000000-0000-4000-8000-000000000003' then 'moderator'::public.user_role else 'user'::public.user_role end where user_id::text like '32000000-%';
insert into private.consent_records(user_id,policy_kind,version)
 select p.id,k,'2026-10-02-preview' from public.profiles p cross join unnest(array['terms','privacy','age_14']) k where p.id::text like '32000000-%';
insert into public.works(id,slug,title,age_rating,catalogue_status) values('52000000-0000-4000-8000-000000000001','p3-review-fixture','[테스트] 리뷰 작품','all','published');
insert into public.work_platforms(work_id,platform_id,official_url,age_rating,verified_at)
 select '52000000-0000-4000-8000-000000000001',id,'https://comic.naver.com/toonshelf-test-only/p3-review-fixture','all',now() from public.platforms where code = 'naver_webtoon';
insert into public.library_entries(user_id,work_id,status,visibility) values('32000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','reading','private');
insert into public.library_private_details(user_id,work_id,last_read_episode,private_note) values('32000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001',77,'fixture-never-copy-private-note');
insert into public.user_evaluations(user_id,work_id,rating_steps,visibility) values('32000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001',10,'private');
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000001","session_id":"42000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.review_id',public.create_review_draft('52000000-0000-4000-8000-000000000001')::text,true);
select is(public.create_review_draft('52000000-0000-4000-8000-000000000001')::text,current_setting('test.review_id'),'Create reuses one current review per owner/work');
select is(public.get_my_review_editor(current_setting('test.review_id')::uuid)->'draft'->>'episode',null::text,'Private progress is not copied to review draft');
select is(public.get_review(current_setting('test.review_id')::uuid,false,null),null::jsonb,'Owner draft is not a public review');
select is(public.get_my_review_moderator_role(),false,'Editable user metadata cannot grant moderator rights');
select throws_ok($attempt$do $blank$begin
 perform public.save_review_draft(current_setting('test.review_id')::uuid,1,jsonb_build_object('body',repeat(U&'\0009\000A\00A0\3000',20),'isSpoiler',false,'episode',null));
 perform public.publish_review(current_setting('test.review_id')::uuid,2,1);
end;$blank$$attempt$,'P0001','VALIDATION_ERROR','Direct RPC publication rejects Unicode whitespace-only bodies');
select lives_ok($$select public.save_review_draft(current_setting('test.review_id')::uuid,1,'{"body":"[테스트] 처음 게시한 리뷰 본문은 스포일러를 포함해요.","isSpoiler":true,"episode":7}')$$,'Draft saved privately');
select throws_ok($$select public.save_review_draft(current_setting('test.review_id')::uuid,1,'{"body":"stale","isSpoiler":false,"episode":null}')$$,'P0001','CONFLICT','Concurrent draft cannot overwrite silently');
select lives_ok($$select public.publish_review(current_setting('test.review_id')::uuid,2,1)$$,'Publication copies the stored draft');
select lives_ok($$select public.save_review_draft(current_setting('test.review_id')::uuid,2,'{"body":"[테스트] 두 번째 비공개 수정 초안은 게시 버튼 전까지 공개되면 안 돼요.","isSpoiler":true,"episode":8}')$$,'Editing an existing publication creates only private changes');
select is(public.get_review(current_setting('test.review_id')::uuid,true,2)->>'body','[테스트] 처음 게시한 리뷰 본문은 스포일러를 포함해요.','Private editing does not alter the current publication');
select is(public.get_review(current_setting('test.review_id')::uuid,false,null)->>'ratingSteps',null::text,'Review cannot reveal a private evaluation');
select throws_ok($$update public.reviews set moderation_status = 'visible'$$,'42501',null,'Owners cannot set moderation columns directly');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is(public.get_review(current_setting('test.review_id')::uuid,false,null)->>'body',null::text,'Initial spoiler DTO contains no body');
select is(public.list_reviews('52000000-0000-4000-8000-000000000001',null,1)->'items'->0->>'excerpt',null::text,'Spoiler list exposes no excerpt');
select throws_ok($$select body from public.reviews$$,'42501',null,'Direct table SELECT cannot bypass a spoiler gate');
select throws_ok($$select payload from public.content_edit_drafts$$,'42501',null,'Anon cannot read private editing payload');
select is(public.get_review(current_setting('test.review_id')::uuid,true,2)->>'episode','7','Explicitly published episode is available');
select throws_ok($$select public.get_review(current_setting('test.review_id')::uuid,true,1)$$,'P0001','CONFLICT','Reveal is bound to the current publication version');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000002","session_id":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::integer from public.content_edit_drafts),0,'B cannot read A edit draft directly');
select is((select count(*)::integer from public.reviews),0,'B cannot read A raw publication body directly');
select is(public.get_my_review_editor(current_setting('test.review_id')::uuid),null::jsonb,'B cannot fetch A owner editor DTO');
select throws_ok($$select public.publish_review(current_setting('test.review_id')::uuid,3,2)$$,'P0001','NOT_FOUND','B cannot publish A draft');
select lives_ok($$select public.report_review(current_setting('test.review_id')::uuid,'spoiler','스포일러 표시와 실제 공개 기준을 확인해 주세요.')$$,'B reports a visible review');
select lives_ok($$select public.report_review(current_setting('test.review_id')::uuid,'spam','동일한 처리 중 신고는 중복 접수하지 않아야 해요.')$$,'Repeated pending report is idempotent');
select is((select count(*)::integer from public.reports),1,'One pending report per reporter/review');
select set_config('test.report_id',(select id::text from public.reports),true);
select throws_ok($$select public.moderation_review_snapshot(current_setting('test.review_id')::uuid,true,2)$$,'P0001','FORBIDDEN','Ordinary member cannot read moderation evidence');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000001","session_id":"42000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::integer from public.reports),0,'Reported author cannot identify reporter or their detail');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000003","session_id":"42000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_my_review_moderator_role(),true,'Current private DB role grants moderation');
select is(public.get_my_catalogue_role(),false,'Moderator cannot obtain catalogue admin powers');
select is((select count(*)::integer from public.content_edit_drafts),0,'Moderator cannot read private drafts through raw SELECT');
select is(public.moderation_review_snapshot(current_setting('test.review_id')::uuid,false,null)->>'body',null::text,'Moderation initial DTO does not include body');
select ok(not (public.moderation_review_snapshot(current_setting('test.review_id')::uuid,true,2) ? 'draft'),'Moderation DTO never includes private editing payload');
select lives_ok($$select public.moderate_review(current_setting('test.review_id')::uuid,2,'hide','스포일러 표시 검토를 위한 임시 숨김',current_setting('test.report_id')::uuid,'리뷰를 검토하고 숨김 처리했어요.')$$,'Hide, report result and audit saved atomically');
select is(public.get_review(current_setting('test.review_id')::uuid,true,3),null::jsonb,'Hidden publication immediately disappears even on reveal');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000001","session_id":"42000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.publish_review(current_setting('test.review_id')::uuid,3,3)$$,'P0001','MODERATION_HIDDEN','Author cannot bypass moderator hiding by republishing');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000003","session_id":"42000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.moderate_review(current_setting('test.review_id')::uuid,3,'restore','운영 검토를 마치고 숨김 해제',null,'')$$,'Moderator can restore a current active publication');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000002","session_id":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select status from public.reports),'resolved','Reporter sees only their processing result');
select lives_ok($$select public.set_user_block('32000000-0000-4000-8000-000000000001',true)$$,'B blocks A with goal state');
select is(public.get_review(current_setting('test.review_id')::uuid,false,null),null::jsonb,'Block filters public review reads');
select is(public.get_public_library('review_a',1),null::jsonb,'Block filters public library RPC');
select is((select count(*)::integer from public.profiles where username = 'review_a'),0,'Block filters direct profile SELECT');
select lives_ok($$select public.set_user_block('32000000-0000-4000-8000-000000000001',false)$$,'B can unblock from own block list');
select ok(public.get_review(current_setting('test.review_id')::uuid,false,null) is not null,'Unblock restores permitted public reads');
reset role;
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000001","session_id":"42000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.withdraw_review(current_setting('test.review_id')::uuid,4,false,true)$$,'Owner withdraws publication without deleting the draft');
select is(public.get_review(current_setting('test.review_id')::uuid,true,5),null::jsonb,'Withdrawn review is unavailable to the public');
select is(public.get_my_review_editor(current_setting('test.review_id')::uuid)->>'draftVersion','3','Withdrawal preserves private editing draft');
select lives_ok($$select public.withdraw_review(current_setting('test.review_id')::uuid,5,true,true)$$,'Deletion clears publication and editing draft');
select is((select count(*)::integer from public.content_edit_drafts),0,'No editing payload remains after review deletion');
select is((select count(work_id)::integer from public.library_entries where user_id = auth.uid()),1,'Review deletion preserves personal library');
select is((select count(work_id)::integer from public.user_evaluations where user_id = auth.uid()),1,'Review deletion preserves canonical evaluation');
reset role;
select is((select body from public.reviews where id = current_setting('test.review_id')::uuid),'','Deleted original body is erased');
update private.user_access set status = 'suspended' where user_id = '32000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000003","session_id":"42000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.list_review_reports(1)$$,'P0001','FORBIDDEN','Suspended moderator cannot access the queue');
reset role;
select * from finish();
rollback;
