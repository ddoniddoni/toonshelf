-- TIER-10 discovery increment. File only; not applied or executed.
-- Recent likes are the first popularity signal. P5 comments will add the
-- documented distinct-commenter weight; do not report an uncomputed score.
create index tier_publications_theme_idx on public.tier_list_publications using gin((payload->'tags') jsonb_path_ops) where is_spoiler = false;
create index reactions_tier_recent_idx on public.reactions(tier_list_id,created_at desc,user_id) where tier_list_id is not null;

-- One validity definition for all-time and recent counts. A repeated desired
-- true does not refresh created_at. Cancel + a new like is a new reaction.
-- The rolling window is [transaction now - 168 hours, transaction now].
create function private.tier_like_metrics(p_id uuid) returns table(like_count bigint,recent_like_count bigint)
language sql stable set search_path = '' as $$
 select count(r.user_id),count(r.user_id) filter(where r.created_at >= now()-interval '168 hours' and r.created_at <= now())
 from public.tier_lists l left join public.reactions r on r.tier_list_id = l.id and r.user_id <> l.user_id
  and private.author_active(r.user_id) and private.users_can_interact(r.user_id)
  and not exists(select 1 from public.blocks b where
   (b.blocker_id = r.user_id and b.blocked_id = l.user_id) or (b.blocker_id = l.user_id and b.blocked_id = r.user_id))
 where l.id = p_id and private.tier_accessible(l.id,null) group by l.id;
$$;
create or replace function private.tier_like_count(p_id uuid) returns bigint
language sql stable set search_path = '' as $$
 select like_count from private.tier_like_metrics(p_id);
$$;
-- Counts come only from the private aggregate inside the same list statement.
-- Spoiler tags are null, and never become searchable metadata or suggestions.
create function private.tier_discovery_card(p_id uuid,p_count bigint,p_recent bigint) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'publishedVersion',p.version,'publishedAt',p.published_at,
  'authorId',a.id,'username',a.username,'name',a.display_name,'isSpoiler',p.is_spoiler,
  'title',case when p.is_spoiler then null else p.payload->>'title' end,
  'tags',case when p.is_spoiler then null else p.payload->'tags' end,'likeCount',p_count,'recentLikeCount',p_recent)
 from public.tier_lists l join public.tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
 join public.profiles a on a.id = l.user_id where l.id = p_id and private.tier_accessible(l.id,null);
$$;
-- Unique RPC name: retain the old one-argument list without overloaded APIs.
create function public.search_public_tiers(p_sort text default 'latest',p_tag text default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_result jsonb;v_tag text := nullif(p_tag,'');
begin
 if p_sort is null or p_sort not in ('latest','popular') or p_page is null or p_page not between 1 and 1000
  or (v_tag is not null and char_length(v_tag) not between 1 and 20) then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if p_sort = 'popular' then
  with candidates as (
   select l.id,p.published_at from public.tier_lists l join public.tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
   where l.visibility = 'public' and l.deleted_at is null and l.moderation_status = 'visible' and private.tier_accessible(l.id,null)
    and (v_tag is null or (p.is_spoiler = false and (p.payload->'tags') @> jsonb_build_array(v_tag)))
  ), scored as materialized (
   select c.*,m.like_count,m.recent_like_count from candidates c cross join lateral private.tier_like_metrics(c.id) m
  ), page as (
   select * from scored order by recent_like_count desc,published_at desc,id limit 13 offset (p_page-1)*12
  ), ranked as (select *,row_number() over(order by recent_like_count desc,published_at desc,id) n from page)
  select jsonb_build_object('items',coalesce(jsonb_agg(private.tier_discovery_card(id,like_count,recent_like_count)
   order by recent_like_count desc,published_at desc,id) filter(where n <= 12),'[]'::jsonb),'hasNext',count(*) > 12)
  into v_result from ranked;
 else
  -- Bound candidates before counts for the default latest listing.
  with page as materialized (
   select l.id,p.published_at from public.tier_lists l join public.tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
   where l.visibility = 'public' and l.deleted_at is null and l.moderation_status = 'visible' and private.tier_accessible(l.id,null)
    and (v_tag is null or (p.is_spoiler = false and (p.payload->'tags') @> jsonb_build_array(v_tag)))
   order by p.published_at desc,l.id limit 13 offset (p_page-1)*12
  ), scored as materialized (
   select c.*,m.like_count,m.recent_like_count from page c cross join lateral private.tier_like_metrics(c.id) m
  ), ranked as (select *,row_number() over(order by published_at desc,id) n from scored)
  select jsonb_build_object('items',coalesce(jsonb_agg(private.tier_discovery_card(id,like_count,recent_like_count)
   order by published_at desc,id) filter(where n <= 12),'[]'::jsonb),'hasNext',count(*) > 12)
  into v_result from ranked;
 end if;
 return v_result;
end;$$;
create or replace function public.list_public_tiers(p_page integer default 1) returns jsonb
language sql stable security definer set search_path = '' set statement_timeout = '5s' as $$
 select public.search_public_tiers('latest',null,p_page);
$$;
revoke all on function private.tier_like_metrics(uuid),private.tier_like_count(uuid),private.tier_discovery_card(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.search_public_tiers(text,text,integer),public.list_public_tiers(integer) from public,anon,authenticated;
grant execute on function public.search_public_tiers(text,text,integer),public.list_public_tiers(integer) to anon,authenticated;
