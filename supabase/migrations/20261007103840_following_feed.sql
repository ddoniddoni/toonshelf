-- SOC-03: reference-only, deduplicated public activity for the member feed.
-- Additive ToonShelf objects only; no Auth/other-app/default-grant changes.
begin;
set local lock_timeout = '3s';

create table public.toon_activity_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.toon_profiles(id) on delete cascade,
 review_id uuid references public.toon_reviews(id) on delete cascade,
 tier_list_id uuid references public.toon_tier_lists(id) on delete cascade,
 event_type text not null,
 created_at timestamptz not null default now(),
 check ((event_type='review_published' and review_id is not null and tier_list_id is null)
     or (event_type='tier_published' and tier_list_id is not null and review_id is null))
);
create unique index toon_activity_review_once_idx on public.toon_activity_events(review_id) where review_id is not null;
create unique index toon_activity_tier_once_idx on public.toon_activity_events(tier_list_id) where tier_list_id is not null;
create index toon_activity_actor_page_idx on public.toon_activity_events(actor_id,created_at desc,id desc);
create index toon_activity_page_idx on public.toon_activity_events(created_at desc,id desc);
alter table public.toon_activity_events enable row level security;
revoke all on public.toon_activity_events from public,anon,authenticated,service_role;

-- These invoker triggers inherit the existing trusted publication RPC context.
-- Draft saves do not update the watched columns. Re-publication cannot bump time.
create function toon_private.toon_record_review_activity() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.publication_status='published' and new.deleted_at is null and new.moderation_status='visible'
  and toon_private.toon_author_active(new.user_id) and toon_private.toon_work_public(new.work_id) then
  insert into public.toon_activity_events(actor_id,review_id,event_type)
  values(new.user_id,new.id,'review_published') on conflict do nothing;
 end if;
 return new;
end;$$;
create trigger review_public_activity after insert or update of publication_status on public.toon_reviews
 for each row execute function toon_private.toon_record_review_activity();

create function toon_private.toon_record_tier_activity() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.visibility='public' and new.published_version is not null and new.deleted_at is null
  and new.moderation_status='visible' and toon_private.toon_author_active(new.user_id) then
  insert into public.toon_activity_events(actor_id,tier_list_id,event_type)
  values(new.user_id,new.id,'tier_published') on conflict do nothing;
 end if;
 return new;
end;$$;
create trigger tier_public_activity after insert or update of visibility,published_version on public.toon_tier_lists
 for each row execute function toon_private.toon_record_tier_activity();

-- Existing currently-public sources form an initial baseline. Tier publication
-- history does not store historical visibility: use the current public version's
-- timestamp, never infer that older/unlisted versions used to be public.
insert into public.toon_activity_events(actor_id,review_id,event_type,created_at)
 select r.user_id,r.id,'review_published',r.published_at from public.toon_reviews r
 where r.publication_status='published' and r.deleted_at is null and r.moderation_status='visible'
 and toon_private.toon_author_active(r.user_id) and toon_private.toon_work_public(r.work_id)
 on conflict do nothing;
insert into public.toon_activity_events(actor_id,tier_list_id,event_type,created_at)
 select l.user_id,l.id,'tier_published',p.published_at from public.toon_tier_lists l
 join public.toon_tier_list_publications p on p.tier_list_id=l.id and p.version=l.published_version
 where l.visibility='public' and l.deleted_at is null and l.moderation_status='visible'
 and toon_private.toon_author_active(l.user_id) on conflict do nothing;

create function public.toon_get_following_feed(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid:=auth.uid();v_before timestamptz;v_id uuid;v_result jsonb;
begin
 if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
 if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor) is distinct from 'object' then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
  if (select count(*) from jsonb_object_keys(p_cursor))<>2
   or jsonb_typeof(p_cursor->'id') is distinct from 'string'
   or jsonb_typeof(p_cursor->'createdAt') is distinct from 'string'
   or p_cursor->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or p_cursor->>'createdAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
  then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
  begin
   v_before:=(p_cursor->>'createdAt')::timestamptz;v_id:=(p_cursor->>'id')::uuid;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
   raise exception 'VALIDATION_ERROR' using errcode='P0001';
  end;
 end if;
 -- A cursor is only a sort boundary, never an authorization capability. Even if
 -- its old source was withdrawn, every candidate still needs current permission.
 with following as materialized (
  select f.following_id from public.toon_follows f where f.follower_id=v_uid
   and toon_private.toon_follow_visible(f.follower_id,f.following_id)
 ), page as materialized (
  select e.* from public.toon_activity_events e join following f on f.following_id=e.actor_id
  where (v_before is null or (e.created_at,e.id)<(v_before,v_id))
   and ((e.review_id is not null and exists(select 1 from public.toon_reviews r where r.id=e.review_id and r.user_id=e.actor_id and toon_private.toon_review_public(r.id)))
    or (e.tier_list_id is not null and exists(select 1 from public.toon_tier_lists l where l.id=e.tier_list_id and l.user_id=e.actor_id and toon_private.toon_tier_accessible(l.id,null))))
  order by e.created_at desc,e.id desc limit 21
 ), ranked as (
  select e.*,row_number() over(order by e.created_at desc,e.id desc) as n from page e
 ), cards as (
  select e.n,jsonb_build_object('eventId',e.id,'createdAt',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'author',jsonb_build_object('id',a.id,'username',a.username,'name',a.display_name,'avatarPath',a.avatar_path)) ||
   case when e.review_id is not null then jsonb_build_object('kind','review','id',r.id,'isSpoiler',r.is_spoiler,
    'work',jsonb_build_object('id',w.id,'title',w.title,'slug',w.slug),'excerpt',case when r.is_spoiler then null else left(r.body,240) end)
   else jsonb_build_object('kind','tier','id',l.id,'isSpoiler',p.is_spoiler,'title',case when p.is_spoiler then null else p.payload->>'title' end) end as card
  from ranked e join public.toon_profiles a on a.id=e.actor_id
  left join public.toon_reviews r on r.id=e.review_id left join public.toon_works w on w.id=r.work_id
  left join public.toon_tier_lists l on l.id=e.tier_list_id
  left join public.toon_tier_list_publications p on p.tier_list_id=l.id and p.version=l.published_version
  where e.n<=20
 ) select jsonb_build_object('hasFollowing',exists(select 1 from following),
  'items',coalesce((select jsonb_agg(card order by n) from cards),'[]'),
  'next',case when (select count(*) from page)>20 then
   (select jsonb_build_object('id',id,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) from ranked where n=20)
   else null end) into v_result;
 return v_result;
end;$$;

revoke all on function toon_private.toon_record_review_activity(),toon_private.toon_record_tier_activity() from public,anon,authenticated,service_role;
revoke all on function public.toon_get_following_feed(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.toon_get_following_feed(jsonb) to authenticated;
commit;
