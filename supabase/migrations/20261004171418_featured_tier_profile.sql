-- SOC-01 / TIER-07,12. File only; not applied or executed.
alter table public.profiles
 add column featured_tier_list_id uuid references public.tier_lists(id) on delete set null,
 add column featured_tier_version bigint not null default 1 check(featured_tier_version between 1 and 9007199254740991);
create index profiles_featured_tier_idx on public.profiles(featured_tier_list_id) where featured_tier_list_id is not null;
-- The pointer/revision are not a raw public API. Preserve existing profile
-- columns under the existing RLS; featured reads use current-public RPCs.
revoke select on public.profiles from public,anon,authenticated;
grant select(id,username,display_name,bio,avatar_path,discovery_opt_in,onboarding_completed_at,created_at,updated_at)
 on public.profiles to anon,authenticated;

create function private.bump_featured_tier_version() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.featured_tier_list_id is distinct from old.featured_tier_list_id then
  new.featured_tier_version := old.featured_tier_version+1;
 else new.featured_tier_version := old.featured_tier_version;end if;
 return new;
end;$$;
create trigger profiles_featured_version before update of featured_tier_list_id,featured_tier_version on public.profiles
 for each row execute function private.bump_featured_tier_version();

-- Runs within the publication/moderation/delete transaction. FK SET NULL also
-- advances the revision on hard deletion. Restoration never reselects a tier.
create function private.clear_unavailable_featured_tier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.visibility <> 'public' or new.moderation_status <> 'visible' or new.deleted_at is not null or new.published_version is null then
  update public.profiles set featured_tier_list_id = null where featured_tier_list_id = new.id;
 elsif new.user_id is distinct from old.user_id then
  update public.profiles set featured_tier_list_id = null where featured_tier_list_id = new.id and id <> new.user_id;
 end if;
 return new;
end;$$;
create trigger tier_featured_cleanup after update of visibility,moderation_status,deleted_at,published_version,user_id on public.tier_lists
 for each row execute function private.clear_unavailable_featured_tier();

create function private.featured_tier_state(p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',p.featured_tier_list_id,'version',p.featured_tier_version)
 from public.profiles p where p.id = p_uid;
$$;
create function public.get_my_featured_tier_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_current();return private.featured_tier_state(auth.uid());
end;$$;
create function public.set_featured_tier(p_id uuid,p_tier_version bigint,p_featured_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_list public.tier_lists;v_revision bigint;
begin
 v_uid := private.require_current();perform private.take_rate('tier_featured',20,60);
 if p_featured_version is null or p_featured_version not between 1 and 9007199254740991
  or (p_id is null and p_tier_version is not null)
  or (p_id is not null and (p_tier_version is null or p_tier_version not between 1 and 9007199254740991)) then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if p_id is not null then
  -- Match publication cleanup's tier -> profile order. No old-target lock is
  -- needed; the profile revision detects replacement/unset/cleanup (incl. ABA).
  select * into v_list from public.tier_lists where id = p_id and user_id = v_uid and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
  if p_tier_version is distinct from v_list.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  if v_list.visibility <> 'public' or v_list.moderation_status <> 'visible' or not private.tier_accessible(p_id,null) then
   raise exception 'FEATURED_UNAVAILABLE' using errcode = 'P0001';end if;
 end if;
 select featured_tier_version into v_revision from public.profiles where id = v_uid for update;
 if p_featured_version is distinct from v_revision then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 update public.profiles set featured_tier_list_id = p_id where id = v_uid and featured_tier_list_id is distinct from p_id;
 return private.featured_tier_state(v_uid);
end;$$;

-- One statement snapshot: no draft/body, historic publication, share token,
-- hidden title/tag, raw pointer, or owner-only revision reaches a visitor.
create function public.get_public_featured_tier(p_username text) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_result jsonb;
begin
 if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select private.tier_discovery_card(l.id,m.like_count,m.recent_like_count) into v_result
 from public.profiles a join public.tier_lists l on l.id = a.featured_tier_list_id and l.user_id = a.id
 cross join lateral private.tier_like_metrics(l.id) m
 where a.username = p_username and private.profile_visible(a.id) and private.tier_accessible(l.id,null);
 return v_result;
end;$$;

revoke all on function private.bump_featured_tier_version(),private.clear_unavailable_featured_tier(),private.featured_tier_state(uuid),
 public.get_my_featured_tier_state(),public.set_featured_tier(uuid,bigint,bigint),public.get_public_featured_tier(text) from public,anon,authenticated;
grant execute on function public.get_my_featured_tier_state(),public.set_featured_tier(uuid,bigint,bigint) to authenticated;
grant execute on function public.get_public_featured_tier(text) to anon,authenticated;
