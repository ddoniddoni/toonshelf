-- TIER-10: extend the installed discovery RPC without replaying its baseline.
-- No stored counters, comment text/identities, or changes to other apps.
begin;
set local lock_timeout = '3s';

create index toon_comments_tier_recent_visible_idx
 on public.toon_comments(tier_list_id,created_at desc,user_id) include(id)
 where deleted_at is null and moderation_status = 'visible' and user_id is not null;

-- Likes keep their existing validity definition. Comments and replies share
-- the discussion access checks, including visibility of the parent thread.
-- Deleted roots are tombstones: their visible surviving replies can count.
-- Creation time, never edit time, determines the inclusive 168-hour window.
create function toon_private.toon_tier_popularity_metrics(p_id uuid)
 returns table(like_count bigint,recent_like_count bigint,recent_commenter_count bigint,popularity_score bigint)
language sql stable set search_path = '' as $$
 select likes.like_count,likes.recent_like_count,commenters.recent_commenter_count,
  likes.recent_like_count+2*commenters.recent_commenter_count
 from public.toon_tier_lists l
 cross join lateral toon_private.toon_tier_like_metrics(l.id) likes
 cross join lateral (
  select count(distinct c.user_id) as recent_commenter_count
  from public.toon_comments c
  where c.tier_list_id = l.id and c.deleted_at is null and c.moderation_status = 'visible'
   and c.user_id is not null and c.user_id <> l.user_id
   and c.created_at >= now()-interval '168 hours' and c.created_at <= now()
   and toon_private.toon_tier_comment_accessible(c.id)
 ) commenters
 where l.id = p_id;
$$;

-- Retain the original private card helper for its existing callers, and add
-- only aggregate values to its spoiler-safe limited metadata.
create function toon_private.toon_tier_popularity_card(p_id uuid,p_count bigint,p_recent bigint,p_commenters bigint) returns jsonb
language sql stable set search_path = '' as $$
 select toon_private.toon_tier_discovery_card(p_id,p_count,p_recent)
  || jsonb_build_object('recentCommenterCount',p_commenters,'popularityScore',p_recent+2*p_commenters);
$$;

create or replace function public.toon_search_public_tiers(p_sort text default 'latest',p_tag text default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_result jsonb;v_tag text := nullif(p_tag,'');
begin
 if p_sort is null or p_sort not in ('latest','popular') or p_page is null or p_page not between 1 and 1000
  or (v_tag is not null and char_length(v_tag) not between 1 and 20) then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if p_sort = 'popular' then
  with candidates as (
   select l.id,p.published_at from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
   where l.visibility = 'public' and l.deleted_at is null and l.moderation_status = 'visible' and toon_private.toon_tier_accessible(l.id,null)
    and (v_tag is null or (p.is_spoiler = false and (p.payload->'tags') @> jsonb_build_array(v_tag)))
  ), scored as materialized (
   select c.*,m.like_count,m.recent_like_count,m.recent_commenter_count,m.popularity_score
   from candidates c cross join lateral toon_private.toon_tier_popularity_metrics(c.id) m
  ), page as (
   select * from scored order by popularity_score desc,published_at desc,id limit 13 offset (p_page-1)*12
  ), ranked as (select *,row_number() over(order by popularity_score desc,published_at desc,id) n from page)
  select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_tier_popularity_card(id,like_count,recent_like_count,recent_commenter_count)
   order by popularity_score desc,published_at desc,id) filter(where n <= 12),'[]'::jsonb),'hasNext',count(*) > 12)
  into v_result from ranked;
 else
  -- Bound the default latest page before aggregating either reaction signal.
  with page as materialized (
   select l.id,p.published_at from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
   where l.visibility = 'public' and l.deleted_at is null and l.moderation_status = 'visible' and toon_private.toon_tier_accessible(l.id,null)
    and (v_tag is null or (p.is_spoiler = false and (p.payload->'tags') @> jsonb_build_array(v_tag)))
   order by p.published_at desc,l.id limit 13 offset (p_page-1)*12
  ), scored as materialized (
   select c.*,m.like_count,m.recent_like_count,m.recent_commenter_count
   from page c cross join lateral toon_private.toon_tier_popularity_metrics(c.id) m
  ), ranked as (select *,row_number() over(order by published_at desc,id) n from scored)
  select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_tier_popularity_card(id,like_count,recent_like_count,recent_commenter_count)
   order by published_at desc,id) filter(where n <= 12),'[]'::jsonb),'hasNext',count(*) > 12)
  into v_result from ranked;
 end if;
 return v_result;
end;$$;

revoke all on function toon_private.toon_tier_popularity_metrics(uuid),toon_private.toon_tier_popularity_card(uuid,bigint,bigint,bigint)
 from public,anon,authenticated,service_role;
revoke all on function public.toon_search_public_tiers(text,text,integer) from public,anon,authenticated;
grant execute on function public.toon_search_public_tiers(text,text,integer) to anon,authenticated;
commit;
