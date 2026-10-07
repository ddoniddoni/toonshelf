-- SOC-02 / SOC-06: additive ToonShelf objects only; no shared Auth changes.
begin;
set local lock_timeout = '3s';

create table public.toon_follows (
 follower_id uuid not null references public.toon_profiles(id) on delete cascade,
 following_id uuid not null references public.toon_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,following_id),
 check(follower_id <> following_id)
);
create index toon_follows_following_page_idx on public.toon_follows(following_id,created_at desc,follower_id);
create index toon_follows_follower_page_idx on public.toon_follows(follower_id,created_at desc,following_id);
alter table public.toon_follows enable row level security;
-- RPC-only projections prevent unbounded raw relationship enumeration.
revoke all on public.toon_follows from public,anon,authenticated,service_role;

create function toon_private.toon_follow_visible(p_follower uuid,p_following uuid) returns boolean
language sql stable set search_path = '' as $$
 select toon_private.toon_author_active(p_follower) and toon_private.toon_author_active(p_following)
  and toon_private.toon_users_can_interact(p_follower) and toon_private.toon_users_can_interact(p_following)
  and not exists(select 1 from public.toon_blocks b where
   (b.blocker_id=p_follower and b.blocked_id=p_following) or (b.blocker_id=p_following and b.blocked_id=p_follower));
$$;

create function toon_private.toon_follow_state(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',p.id,'username',p.username,'name',p.display_name,'avatarPath',p.avatar_path,
  'followerCount',(select count(*) from public.toon_follows f where f.following_id=p.id and toon_private.toon_follow_visible(f.follower_id,f.following_id)),
  'followingCount',(select count(*) from public.toon_follows f where f.follower_id=p.id and toon_private.toon_follow_visible(f.follower_id,f.following_id)),
  'following',toon_private.toon_current_active() and exists(select 1 from public.toon_follows f where f.follower_id=auth.uid() and f.following_id=p.id and toon_private.toon_follow_visible(f.follower_id,f.following_id)),
  'canFollow',toon_private.toon_current_active() and p.id<>auth.uid(),
  'isSelf',coalesce(p.id=auth.uid(),false))
 from public.toon_profiles p where p.id=p_user and toon_private.toon_profile_visible(p.id);
$$;

create function public.toon_get_public_follow_state(p_username text) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
begin
 if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 return (select toon_private.toon_follow_state(p.id) from public.toon_profiles p where p.username=p_username);
end;$$;

create function public.toon_list_public_follows(p_username text,p_kind text,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_user uuid;v_state jsonb;v_items jsonb;v_total bigint;
begin
 if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$' or p_kind is null or p_kind not in ('followers','following')
  or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 select p.id into v_user from public.toon_profiles p where p.username=p_username and toon_private.toon_profile_visible(p.id);
 if not found then return null;end if;
 v_state:=toon_private.toon_follow_state(v_user);
 v_total:=(v_state->>(case when p_kind='followers' then 'followerCount' else 'followingCount' end))::bigint;
 -- Filter BEFORE counting/pagination; return public profile fields only.
 if p_kind='followers' then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'username',s.username,'name',s.display_name,'avatarPath',s.avatar_path)
   order by s.created_at desc,s.id),'[]') into v_items from (
   select p.id,p.username,p.display_name,p.avatar_path,f.created_at from public.toon_follows f
   join public.toon_profiles p on p.id=f.follower_id where f.following_id=v_user and toon_private.toon_follow_visible(f.follower_id,f.following_id)
   order by f.created_at desc,f.follower_id limit 20 offset (p_page-1)*20
  ) s;
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'username',s.username,'name',s.display_name,'avatarPath',s.avatar_path)
   order by s.created_at desc,s.id),'[]') into v_items from (
   select p.id,p.username,p.display_name,p.avatar_path,f.created_at from public.toon_follows f
   join public.toon_profiles p on p.id=f.following_id where f.follower_id=v_user and toon_private.toon_follow_visible(f.follower_id,f.following_id)
   order by f.created_at desc,f.following_id limit 20 offset (p_page-1)*20
  ) s;
 end if;
 return jsonb_build_object('profile',v_state,'kind',p_kind,'page',p_page,'total',v_total,'hasNext',p_page*20<v_total,'items',v_items);
end;$$;

create function public.toon_set_user_follow(p_user uuid,p_following boolean) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;
begin
 v_uid:=toon_private.toon_require_current();
 if p_user is null or p_following is null then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 if p_user=v_uid then raise exception 'SELF_FOLLOW' using errcode='P0001';end if;
 perform toon_private.toon_take_rate('user_follow',30,600);
 perform toon_private.toon_lock_interaction_pair(v_uid,p_user);
 if p_following then
  if not toon_private.toon_profile_visible(p_user) then raise exception 'NOT_FOUND' using errcode='P0001';end if;
  insert into public.toon_follows(follower_id,following_id) values(v_uid,p_user) on conflict do nothing;
 else
  -- The owner may remove a stale relation even if the target is no longer visible.
  -- A nonexistent/inaccessible target returns null without exposing its identity.
  delete from public.toon_follows where follower_id=v_uid and following_id=p_user;
 end if;
 return toon_private.toon_follow_state(p_user);
end;$$;

-- Extend block cleanup without redefining the installed block/reaction function.
-- BEFORE INSERT also runs on ON CONFLICT DO NOTHING, so retries are safe.
create function toon_private.toon_clear_blocked_follows() returns trigger
language plpgsql set search_path = '' as $$
begin
 perform toon_private.toon_lock_interaction_pair(new.blocker_id,new.blocked_id);
 delete from public.toon_follows where
  (follower_id=new.blocker_id and following_id=new.blocked_id) or
  (follower_id=new.blocked_id and following_id=new.blocker_id);
 return new;
end;$$;
create trigger blocks_clear_follows before insert on public.toon_blocks
 for each row execute function toon_private.toon_clear_blocked_follows();

revoke all on function toon_private.toon_follow_visible(uuid,uuid),toon_private.toon_follow_state(uuid),toon_private.toon_clear_blocked_follows() from public,anon,authenticated,service_role;
revoke all on function public.toon_get_public_follow_state(text),public.toon_list_public_follows(text,text,integer),public.toon_set_user_follow(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.toon_get_public_follow_state(text),public.toon_list_public_follows(text,text,integer) to anon,authenticated;
grant execute on function public.toon_set_user_follow(uuid,boolean) to authenticated;
commit;
