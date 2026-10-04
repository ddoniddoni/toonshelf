-- TIER-10 / SOC-04 first target. File only; not applied or executed.
-- Other reaction targets are introduced with their domains and FK/check/RPCs.
create table public.reactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 tier_list_id uuid not null references public.tier_lists(id) on delete cascade,
 created_at timestamptz not null default now()
);
create unique index reactions_user_tier_unique on public.reactions(user_id,tier_list_id) where tier_list_id is not null;
create index reactions_tier_user_idx on public.reactions(tier_list_id,user_id) where tier_list_id is not null;
alter table public.reactions enable row level security;
revoke all on public.reactions from public,anon,authenticated;
-- No SELECT/DML policies: no liker identities or private target enumeration.

-- One pair mutex shared by blocks and likes. Current-user access is locked first;
-- pair -> tier lock order prevents a block racing a new reaction after cleanup.
create function private.lock_interaction_pair(p_actor uuid,p_other uuid) returns void
language sql volatile set search_path = '' as $$
 select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'toonshelf:interaction:' || least(p_actor,p_other)::text || ':' || greatest(p_actor,p_other)::text,0));
$$;
create or replace function public.set_user_block(p_user uuid,p_blocked boolean) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;
begin
 v_uid := private.require_current();perform private.take_rate('user_block',30,60);
 if p_user is null or p_user = v_uid or p_blocked is null then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if not exists(select 1 from public.profiles where id = p_user) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 perform private.lock_interaction_pair(v_uid,p_user);
 if p_blocked then
  insert into public.blocks(blocker_id,blocked_id) values(v_uid,p_user) on conflict do nothing;
  delete from public.reactions r using public.tier_lists t where r.tier_list_id = t.id and
   ((r.user_id = v_uid and t.user_id = p_user) or (r.user_id = p_user and t.user_id = v_uid));
 else delete from public.blocks where blocker_id = v_uid and blocked_id = p_user;end if;
 -- Follow removal/comments/notifications are added with their P5 domains.
end;$$;

-- Count current valid rows, never a client-editable or simulated counter. Both
-- author/reactor and viewer/reactor blocks are filtered on every read.
create function private.tier_like_count(p_id uuid) returns bigint
language sql stable set search_path = '' as $$
 select case when private.tier_accessible(p_id,null) then (
  select count(*) from public.reactions r join public.tier_lists l on l.id = r.tier_list_id
  where r.tier_list_id = p_id and r.user_id <> l.user_id and private.author_active(r.user_id)
   and private.users_can_interact(r.user_id) and not exists(select 1 from public.blocks b where
    (b.blocker_id = r.user_id and b.blocked_id = l.user_id) or (b.blocker_id = l.user_id and b.blocked_id = r.user_id))
 ) else null end;
$$;
create function private.tier_like_state(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'likeCount',private.tier_like_count(l.id),
  'liked',private.current_active() and exists(select 1 from public.reactions r where r.tier_list_id = l.id and r.user_id = auth.uid()),
  'canLike',private.current_active() and l.user_id <> auth.uid())
 from public.tier_lists l where l.id = p_id and private.tier_accessible(l.id,null);
$$;
create function public.get_tier_like_state(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' set statement_timeout = '5s' as $$
 select private.tier_like_state(p_id);
$$;
create function public.set_tier_like(p_id uuid,p_version bigint,p_liked boolean) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;v_author uuid;v_version bigint;
begin
 v_uid := private.require_current();perform private.take_rate('tier_like',40,60);
 if p_id is null or p_version is null or p_version not between 1 and 9007199254740991 or p_liked is null then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select user_id into v_author from public.tier_lists where id = p_id and private.tier_accessible(id,null);
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_author = v_uid then raise exception 'SELF_REACTION' using errcode = 'P0001';end if;
 perform private.lock_interaction_pair(v_uid,v_author);
 select l.version into v_version from public.tier_lists l where l.id = p_id and private.tier_accessible(l.id,null) for share;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version <> v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 -- Desired state, not toggle: duplicate requests cannot invert/increment twice.
 if p_liked then
  insert into public.reactions(user_id,tier_list_id) values(v_uid,p_id)
   on conflict(user_id,tier_list_id) where tier_list_id is not null do nothing;
 else delete from public.reactions where user_id = v_uid and tier_list_id = p_id;end if;
 return private.tier_like_state(p_id);
end;$$;

-- Soft deletion already retains reports/audit; reactions are no longer useful.
create function private.clear_deleted_tier_reactions() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.deleted_at is not null then delete from public.reactions where tier_list_id = new.id;end if;
 return new;
end;$$;
create trigger tier_deleted_reactions after update of deleted_at on public.tier_lists
 for each row when (new.deleted_at is not null) execute function private.clear_deleted_tier_reactions();

-- Append counts to existing limited projections; unlisted always returns null.
-- Lists use one RPC; no per-card client/network query or liker identities.
create or replace function private.tier_dto(p_id uuid,p_reveal boolean) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'publishedVersion',p.version,'publishedAt',p.published_at,
  'authorId',a.id,'username',a.username,'name',a.display_name,'isSpoiler',p.is_spoiler,
  'likeCount',private.tier_like_count(l.id),
  'body',case when p.is_spoiler and not p_reveal then null else private.tier_public_body(p.payload) end)
 from public.tier_lists l join public.tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
 join public.profiles a on a.id = l.user_id where l.id = p_id;
$$;
create or replace function private.tier_listing_card(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'publishedVersion',p.version,'publishedAt',p.published_at,
  'authorId',a.id,'username',a.username,'name',a.display_name,'isSpoiler',p.is_spoiler,
  'likeCount',private.tier_like_count(l.id),'title',case when p.is_spoiler then null else p.payload->>'title' end)
 from public.tier_lists l join public.tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
 join public.profiles a on a.id = l.user_id where l.id = p_id;
$$;
revoke all on function private.lock_interaction_pair(uuid,uuid),private.tier_like_count(uuid),private.tier_like_state(uuid),private.clear_deleted_tier_reactions(),private.tier_dto(uuid,boolean),private.tier_listing_card(uuid) from public,anon,authenticated;
revoke all on function public.get_tier_like_state(uuid),public.set_tier_like(uuid,bigint,boolean),public.set_user_block(uuid,boolean) from public,anon,authenticated;
grant execute on function public.get_tier_like_state(uuid) to anon,authenticated;
grant execute on function public.set_tier_like(uuid,bigint,boolean),public.set_user_block(uuid,boolean) to authenticated;
