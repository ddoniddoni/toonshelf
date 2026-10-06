-- P3 catalogue average-rating sort and public summaries. File only; not applied.
-- Retain the P2 RPC signature and latest/title cursors. Aggregate ratings before
-- card metadata; never join private reading details or infer a private status.
create or replace function public.toon_search_catalogue(p_q text,p_platforms text[],p_genres text[],p_status text,p_days integer[],p_age text,p_sort text,p_after jsonb,p_limit integer) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '3s' as $$
declare
 v_result jsonb; v_pattern text; v_anchor_valid boolean;
 v_after_id uuid; v_after_created timestamptz; v_after_title text;
 v_after_sum numeric; v_after_count numeric;
begin
 if p_q is null or char_length(btrim(p_q)) > 100 or p_limit is null or p_limit not between 1 and 50
  or p_platforms is null or cardinality(p_platforms) > 8 or exists(select 1 from unnest(p_platforms) c where not exists(select 1 from public.toon_platforms where code = c and active))
  or p_genres is null or cardinality(p_genres) > 12 or exists(select 1 from unnest(p_genres) s where not exists(select 1 from public.toon_genres where slug = s and active))
  or (p_status is not null and p_status not in ('ongoing','completed','hiatus','unknown'))
  or p_days is null or cardinality(p_days) > 7 or exists(select 1 from unnest(p_days) d where d is null or d not between 0 and 6)
  or (p_age is not null and p_age not in ('all','12','15')) or p_sort is null or p_sort not in ('latest','title','rating')
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 if p_after is not null then
  if jsonb_typeof(p_after) is distinct from 'object' or octet_length(p_after::text) > 2048 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  -- Reject malformed direct RPC cursors as well as the application's envelope.
  begin
   if p_sort = 'rating' then
    perform toon_private.toon_assert_keys(p_after,array['id','ratingSum','ratingCount','viewerId']);
    if not (p_after ?& array['id','ratingSum','ratingCount','viewerId'])
     or jsonb_typeof(p_after->'id') is distinct from 'string'
     or jsonb_typeof(p_after->'ratingSum') is distinct from 'number'
     or jsonb_typeof(p_after->'ratingCount') is distinct from 'number'
     or (p_after->>'ratingSum') !~ '^(0|[1-9][0-9]{0,15})$'
     or (p_after->>'ratingCount') !~ '^(0|[1-9][0-9]{0,15})$'
     or jsonb_typeof(p_after->'viewerId') not in ('null','string')
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
    v_after_id := (p_after->>'id')::uuid;
    v_after_sum := (p_after->>'ratingSum')::numeric;
    v_after_count := (p_after->>'ratingCount')::numeric;
    if (p_after->>'viewerId')::uuid is distinct from auth.uid()
     or v_after_sum > 9007199254740991 or v_after_count > 9007199254740991
     or (v_after_count = 0 and v_after_sum <> 0)
     or (v_after_count > 0 and (v_after_sum < v_after_count or v_after_sum > v_after_count * 10))
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
   else
    perform toon_private.toon_assert_keys(p_after,array['id','createdAt','title']);
    if not (p_after ?& array['id','createdAt','title'])
     or jsonb_typeof(p_after->'id') is distinct from 'string'
     or jsonb_typeof(p_after->'createdAt') is distinct from 'string'
     or jsonb_typeof(p_after->'title') is distinct from 'string' or char_length(p_after->>'title') > 200
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
    v_after_id := (p_after->>'id')::uuid;
    v_after_created := (p_after->>'createdAt')::timestamptz;
    v_after_title := p_after->>'title';
    if not isfinite(v_after_created) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
   end if;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
   raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end;
 end if;
 if toon_private.toon_session_live() then perform toon_private.toon_take_rate('catalogue_search',120,60); end if;
 v_pattern := '%' || replace(replace(replace(lower(regexp_replace(btrim(p_q),'[[:space:]]+',' ','g')),'\','\\'),'%','\%'),'_','\_') || '%';
 with filtered as (
  select w.id,w.title,w.created_at from public.toon_works w where toon_private.toon_work_public(w.id) and (p_q = '' or w.search_text like v_pattern)
   and (p_status is null or w.serial_status::text = p_status) and (p_age is null or w.age_rating::text = p_age)
   and (cardinality(p_genres) = 0 or exists(select 1 from public.toon_work_genres r join public.toon_genres g on g.id = r.genre_id where r.work_id = w.id and g.active and g.slug = any(p_genres)))
   and exists(select 1 from public.toon_work_platforms l join public.toon_platforms p on p.id = l.platform_id
    where l.work_id = w.id and l.active and p.active and l.age_rating in ('all','12','15') and l.verified_at <= now()
    and (cardinality(p_platforms) = 0 or p.code = any(p_platforms)) and (cardinality(p_days) = 0 or l.weekdays && p_days::smallint[]))
 ), metadata_page as (
  -- Latest/title only need summaries for their bounded page and lookahead.
  select w.* from filtered w where p_sort <> 'rating' and (p_after is null
   or (p_sort = 'latest' and (w.created_at,w.id) < (v_after_created,v_after_id))
   or (p_sort = 'title' and (lower(w.title),w.id) > (lower(v_after_title),v_after_id)))
  order by case when p_sort = 'latest' then w.created_at end desc,case when p_sort = 'title' then lower(w.title) end,
   case when p_sort = 'latest' then w.id end desc,case when p_sort = 'title' then w.id end limit p_limit + 1
 ), candidates as (
  select * from filtered where p_sort = 'rating'
  union all select * from metadata_page
 ), ratings as (
  select e.work_id,count(*) rating_count,sum(e.rating_steps)::numeric rating_sum
  from candidates c join public.toon_user_evaluations e on e.work_id = c.id
  where e.visibility = 'public' and e.rating_steps is not null and toon_private.toon_profile_visible(e.user_id)
  group by e.work_id
 ), scored as (
  select c.*,coalesce(r.rating_count,0) rating_count,coalesce(r.rating_sum,0) rating_sum,
   r.rating_sum / nullif(r.rating_count * 2::numeric,0) rating_average
  from candidates c left join ratings r on r.work_id = c.id
 ), page as (
  select s.* from scored s where p_sort <> 'rating' or p_after is null
   or (v_after_count > 0 and (s.rating_count = 0
    or s.rating_sum * v_after_count < v_after_sum * s.rating_count
    or (s.rating_sum * v_after_count = v_after_sum * s.rating_count and s.rating_count > 0
     and (s.rating_count < v_after_count or (s.rating_count = v_after_count and s.id > v_after_id)))))
   or (v_after_count = 0 and s.rating_count = 0 and s.id > v_after_id)
  order by case when p_sort = 'rating' then s.rating_average end desc nulls last,
   case when p_sort = 'rating' then s.rating_count end desc,
   case when p_sort = 'latest' then s.created_at end desc,case when p_sort = 'title' then lower(s.title) end,
   case when p_sort = 'latest' then s.id end desc,case when p_sort <> 'latest' then s.id end limit p_limit + 1
 ), numbered as (
  select p.*,row_number() over(order by case when p_sort = 'rating' then p.rating_average end desc nulls last,
   case when p_sort = 'rating' then p.rating_count end desc,
   case when p_sort = 'latest' then p.created_at end desc,case when p_sort = 'title' then lower(p.title) end,
   case when p_sort = 'latest' then p.id end desc,case when p_sort <> 'latest' then p.id end) n from page p
 )
 select p_sort <> 'rating' or p_after is null or exists(select 1 from scored where id = v_after_id and rating_count = v_after_count and rating_sum = v_after_sum),
  jsonb_build_object('items',coalesce((select jsonb_agg(toon_private.toon_work_card(id) || jsonb_build_object('rating',jsonb_build_object('average',rating_average,'ratingCount',rating_count)) order by n) from numbered where n <= p_limit),'[]'),
   'total',(select count(*) from filtered),'next',case when (select count(*) from numbered) > p_limit then
    (select case when p_sort = 'rating' then jsonb_build_object('id',id,'ratingSum',rating_sum,'ratingCount',rating_count,'viewerId',auth.uid())
     else jsonb_build_object('id',id,'createdAt',created_at,'title',title) end from numbered where n = p_limit) else null end)
 into v_anchor_valid,v_result;
 -- A changed/hidden anchor or another viewer's cursor must start over. This is
 -- live pagination, not a snapshot of ratings that might later become private.
 if not v_anchor_valid then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 return v_result;
end;
$$;
revoke execute on function public.toon_search_catalogue(text,text[],text[],text,integer[],text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.toon_search_catalogue(text,text[],text[],text,integer[],text,text,jsonb,integer) to anon,authenticated;
