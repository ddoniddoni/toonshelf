-- DISC-02. Current-member private analysis; no shared Auth or existing RPC changes.
begin;
set local lock_timeout='3s';
create function public.toon_get_my_taste_analysis() returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_uid uuid:=auth.uid();v_result jsonb;
begin
 if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
 if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 with library as materialized (
  select l.work_id,l.status,e.rating_steps,e.canonical_tier
  from public.toon_library_entries l left join public.toon_user_evaluations e using(user_id,work_id)
  where l.user_id=v_uid and toon_private.toon_work_public(l.work_id)
 ), reads as materialized (select * from library where status<>'planned'),
 genre_parts as (
  select r.work_id,g.id,coalesce(g.name,'미분류') name,
   1.0/count(*) over(partition by r.work_id) weight
  from reads r left join lateral (
   select g.id,g.name from public.toon_work_genres wg join public.toon_genres g on g.id=wg.genre_id
   where wg.work_id=r.work_id and g.active
  ) g on true
 ), platform_parts as (
  select r.work_id,p.id,coalesce(p.name,'미분류') name,
   1.0/count(*) over(partition by r.work_id) weight
  from reads r left join lateral (
   select distinct p.id,p.name from public.toon_work_platforms wp join public.toon_platforms p on p.id=wp.platform_id
   where wp.work_id=r.work_id and wp.active and p.active and wp.verified_at<=now() and wp.age_rating in ('all','12','15')
  ) p on true
 ), genres as (select id,name,sum(weight) weight,count(*) work_count from genre_parts group by id,name),
 platforms as (select id,name,sum(weight) weight,count(*) work_count from platform_parts group by id,name)
 select jsonb_build_object(
  'viewerId',v_uid,'computedAt',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'totalCount',(select count(*) from library),'readCount',(select count(*) from reads),
  'statuses',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from library group by status) s),'{}'::jsonb),
  'ratings',coalesce((select jsonb_object_agg(rating_steps,n) from (select rating_steps,count(*) n from reads where rating_steps is not null group by rating_steps) s),'{}'::jsonb),
  'tiers',coalesce((select jsonb_object_agg(canonical_tier,n) from (select canonical_tier,count(*) n from reads where canonical_tier is not null group by canonical_tier) s),'{}'::jsonb),
  'genres',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'weight',weight,'workCount',work_count,'share',weight/nullif((select count(*) from reads),0)) order by weight desc,name,id) from genres),'[]'::jsonb),
  'platforms',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'weight',weight,'workCount',work_count,'share',weight/nullif((select count(*) from reads),0)) order by weight desc,name,id) from platforms),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.toon_get_my_taste_analysis() from public,anon,service_role;
grant execute on function public.toon_get_my_taste_analysis() to authenticated;
comment on function public.toon_get_my_taste_analysis() is 'Own current-visible library analysis; non-planned weighted genres/platforms, no public sharing.';
commit;
