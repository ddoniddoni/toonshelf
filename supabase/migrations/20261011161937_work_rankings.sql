-- DISC-04/05, SOC-06. Additive, viewer-aware public ranking API.
begin;
set local lock_timeout='3s';
create function public.toon_get_work_rankings(p_audience text default 'all',p_platform text default null,
 p_genre text default null,p_section text default 'ranked',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_result jsonb;
begin
 if auth.uid() is not null then
  if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
  if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 end if;
 if p_audience is null or p_audience not in ('all','completed','experienced','completed_experienced')
  or p_section is null or p_section not in ('ranked','insufficient') or p_page is null or p_page not between 1 and 1000
  or (p_platform is not null and (p_platform!~'^[a-z0-9_]{1,40}$' or not exists(select 1 from public.toon_platforms where code=p_platform and active)))
  or (p_genre is not null and (p_genre!~'^[a-z0-9-]{1,80}$' or not exists(select 1 from public.toon_genres where slug=p_genre and active)))
 then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 with visible_works as materialized (
  select w.id from public.toon_works w where toon_private.toon_work_public(w.id)
 ), eligible_members as materialized (
  select p.id from public.toon_profiles p where toon_private.toon_profile_visible(p.id)
 ), public_ratings as materialized (
  select e.user_id,e.work_id,e.rating_steps/2.0 rating from public.toon_user_evaluations e
  join visible_works w on w.id=e.work_id join eligible_members m on m.id=e.user_id
  where e.visibility='public' and e.rating_steps is not null
 ), baseline as (select avg(rating) average from public_ratings),
 experienced as materialized (
  select l.user_id from public.toon_library_entries l join eligible_members m on m.id=l.user_id
  join visible_works w on w.id=l.work_id
  where p_audience in ('experienced','completed_experienced') and l.visibility='public' and l.status<>'planned'
  group by l.user_id having count(*)>=30
 ), filtered_ratings as (
  select e.* from public_ratings e where
   (p_audience not in ('completed','completed_experienced') or exists(
    select 1 from public.toon_library_entries l where l.user_id=e.user_id and l.work_id=e.work_id and l.visibility='public' and l.status='completed'))
   and (p_audience not in ('experienced','completed_experienced') or exists(select 1 from experienced x where x.user_id=e.user_id))
 ), candidates as (
  select w.id from visible_works w where
   (p_platform is null or exists(select 1 from public.toon_work_platforms wp join public.toon_platforms p on p.id=wp.platform_id
    where wp.work_id=w.id and p.code=p_platform and p.active and wp.active and wp.verified_at<=now() and wp.age_rating in ('all','12','15')))
   and (p_genre is null or exists(select 1 from public.toon_work_genres wg join public.toon_genres g on g.id=wg.genre_id where wg.work_id=w.id and g.slug=p_genre and g.active))
 ), aggregates as (
  select w.id,count(r.rating) sample_count,avg(r.rating) average from candidates w left join filtered_ratings r on r.work_id=w.id group by w.id
 ), scored as (
  select a.*,case when sample_count>=5 then (sample_count*a.average+20*b.average)/(sample_count+20) end score
  from aggregates a cross join baseline b
 ), selected as (
  select * from scored where (p_section='ranked' and sample_count>=5 and score is not null) or (p_section='insufficient' and sample_count<5)
 ), ordered as (
  select *,row_number() over(order by score desc nulls last,sample_count desc,id) row_position from selected
 ), page_rows as (select * from ordered order by row_position offset (p_page-1)*20 limit 20)
 select jsonb_build_object('audience',p_audience,'platform',p_platform,'genre',p_genre,'section',p_section,'page',p_page,
  'computedAt',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'total',(select count(*) from selected),'hasNext',p_page<1000 and (select count(*) from selected)>p_page*20,
  'items',coalesce((select jsonb_agg(jsonb_build_object('work',toon_private.toon_work_card(id),'sampleCount',sample_count,
   'rank',case when p_section='ranked' then row_position end,'average',case when sample_count>=5 then average end) order by row_position) from page_rows),'[]'::jsonb)) into v_result;
 return v_result;
end $$;
revoke all on function public.toon_get_work_rankings(text,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.toon_get_work_rankings(text,text,text,text,integer) to anon,authenticated;
comment on function public.toon_get_work_rankings(text,text,text,text,integer) is 'Public ratings, v>=5, m=20; filter-independent visible-site baseline; no private reading qualification.';
commit;
