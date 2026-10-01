-- LOCAL ONLY. scripts/local-db.mjs rejects remote/linked reset before this runs.
-- No fake users, reviews or ratings. All 60 synthetic works remain drafts,
-- marked is_test=true and excluded by every public catalogue projection/RLS.
-- No fabricated official platform links or copied introductions/covers.
insert into public.creators(id,name,aliases)
 select md5('toonshelf-local-creator-' || i)::uuid,'[테스트] 작가 ' || i,array['[테스트] 필명 ' || i]
 from generate_series(1,15) i on conflict(id) do nothing;
insert into public.works(id,slug,title,aliases,original_description,serial_status,age_rating,catalogue_status,is_test)
 select md5('toonshelf-local-work-' || i)::uuid,'local-test-' || lpad(i::text,3,'0'),
  '[테스트] 작품 ' || lpad(i::text,3,'0'),array['[테스트] 별칭 ' || i],
  '로컬 카탈로그 개발을 위한 합성 작품입니다. 실제 유통 작품이 아닙니다.',
  case i % 3 when 0 then 'completed'::public.serial_status when 1 then 'ongoing'::public.serial_status else 'hiatus'::public.serial_status end,
  'all'::public.age_rating,'draft'::public.catalogue_status,true
 from generate_series(1,60) i on conflict(id) do nothing;
insert into public.work_creators(work_id,creator_id,role,sort_order)
 select md5('toonshelf-local-work-' || i)::uuid,md5('toonshelf-local-creator-' || (1 + (i - 1) % 15))::uuid,'writer',0
 from generate_series(1,60) i on conflict do nothing;
insert into public.work_genres(work_id,genre_id)
 select md5('toonshelf-local-work-' || i)::uuid,g.id
 from generate_series(1,60) i join public.genres g on g.sort_order = 1 + (i - 1) % 12 on conflict do nothing;
do $$
declare v_id uuid;
begin
 for v_id in select id from public.works where is_test loop perform private.refresh_work_search(v_id); end loop;
end;
$$;
