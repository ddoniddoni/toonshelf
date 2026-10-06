-- P3 public library filters. File written only; not applied to any database.
-- A separate RPC preserves the existing get_public_library(text,integer) contract.
create function public.toon_search_public_library(p_username text,p_filters jsonb,p_page integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
 v_uid uuid; v_key text; v_q text; v_status text; v_sort text; v_platform text;
 v_genre text; v_rating integer; v_tier text; v_total integer; v_items jsonb;
begin
 if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$'
  or p_page is null or p_page not between 1 and 1000 then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
 end if;
 perform toon_private.toon_assert_keys(p_filters,array['q','status','sort','platform','genre','rating','tier']);
 if not p_filters ?& array['q','status','sort','platform','genre','rating','tier']
  or octet_length(p_filters::text) > 4096
  or jsonb_typeof(p_filters->'q') is distinct from 'string' or char_length(p_filters->>'q') > 100
  or jsonb_typeof(p_filters->'sort') is distinct from 'string' then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
 end if;
 foreach v_key in array array['status','platform','genre','tier'] loop
  if p_filters->v_key <> 'null'::jsonb and jsonb_typeof(p_filters->v_key) <> 'string' then
   raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
 end loop;
 if p_filters->'rating' <> 'null'::jsonb and
  (jsonb_typeof(p_filters->'rating') <> 'number' or p_filters->>'rating' !~ '^(10|[1-9])$') then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
 end if;
 v_status := p_filters->>'status'; v_sort := p_filters->>'sort'; v_platform := p_filters->>'platform';
 v_genre := p_filters->>'genre'; v_rating := (p_filters->>'rating')::integer; v_tier := p_filters->>'tier';
 if v_sort not in ('title','rating','tier')
  or (v_status is not null and v_status not in ('reading','completed','dropped','planned'))
  or (v_tier is not null and v_tier not in ('S','A','B','C','D','F'))
  or (v_platform is not null and (v_platform !~ '^[a-z0-9_]{1,40}$' or not exists(select 1 from public.toon_platforms where code = v_platform and active)))
  or (v_genre is not null and (v_genre !~ '^[a-z0-9-]{1,40}$' or not exists(select 1 from public.toon_genres where slug = v_genre and active))) then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
 end if;
 select id into v_uid from public.toon_profiles where username = p_username and toon_private.toon_profile_visible(id);
 if v_uid is null then return null; end if;
 v_q := '%' || replace(replace(replace(p_filters->>'q','\','\\'),'%','\%'),'_','\_') || '%';

 -- Definer is needed to combine independently public status/evaluation entries,
 -- including evaluation-only works. Every field is projected before filtering.
 -- Private evaluation rows are never joined, even when the caller is the owner.
 -- No private details, activity timestamps, tags, progress or preferred link reads.
 with visible as (
  select l.work_id,w.title,w.search_text,
   case when l.visibility = 'public' then l.status::text else null end as status,
   e.rating_steps as rating,e.canonical_tier::text as tier
  from public.toon_library_entries l join public.toon_works w on w.id = l.work_id
  left join public.toon_user_evaluations e on e.user_id = l.user_id and e.work_id = l.work_id and e.visibility = 'public'
  where l.user_id = v_uid and (l.visibility = 'public' or e.work_id is not null) and toon_private.toon_work_public(l.work_id)
 ), filtered as (
  select * from visible v
  where (p_filters->>'q' = '' or v.search_text ilike v_q escape '\')
   and (v_status is null or v.status = v_status)
   and (v_rating is null or v.rating = v_rating) and (v_tier is null or v.tier = v_tier)
   and (v_platform is null or exists(
    select 1 from public.toon_work_platforms r join public.toon_platforms p on p.id = r.platform_id
    where r.work_id = v.work_id and p.code = v_platform and p.active and r.active
     and r.age_rating in ('all','12','15') and r.verified_at <= now()))
   and (v_genre is null or exists(
    select 1 from public.toon_work_genres r join public.toon_genres g on g.id = r.genre_id
    where r.work_id = v.work_id and g.slug = v_genre and g.active))
 ), page as (
  select *,row_number() over(order by
   case when v_sort = 'rating' then rating end desc nulls last,
   case when v_sort = 'tier' then case tier when 'S' then 1 when 'A' then 2 when 'B' then 3
    when 'C' then 4 when 'D' then 5 when 'F' then 6 end end asc nulls last,
   title asc,work_id asc) as position from filtered
 )
 select (select count(*) from filtered),coalesce((select jsonb_agg(jsonb_build_object(
  'work',toon_private.toon_work_card(work_id),'status',status,'ratingSteps',rating,'canonicalTier',tier) order by position)
  from page where position > (p_page - 1)*24 and position <= p_page*24),'[]') into v_total,v_items;
 return jsonb_build_object('items',v_items,'total',v_total,'hasNext',v_total > p_page*24 and p_page < 1000);
end;
$$;
revoke all on function public.toon_search_public_library(text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.toon_search_public_library(text,jsonb,integer) to anon,authenticated;
