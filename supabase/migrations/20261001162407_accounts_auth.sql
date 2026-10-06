-- P1: user-owned account data. No app writes are permitted before onboarding.
begin;

create table public.toon_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$' and username not in ('admin','auth','api','support','settings','onboarding','toonshelf','system','moderator')),
  display_name text not null default '' check (char_length(display_name) <= 30),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_path text,
  discovery_opt_in boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (onboarding_completed_at is null or (username is not null and char_length(display_name) >= 2)),
  check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[a-f0-9-]{36}\.webp$'))
);
create table public.toon_genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null,
  active boolean not null default true
);
-- Real taxonomy labels, not fabricated works or user activity.
insert into public.toon_genres (slug, name, sort_order) values
  ('fantasy','판타지',1),('romance','로맨스',2),('action','액션',3),
  ('drama','드라마',4),('thriller','스릴러',5),('comedy','코미디',6),
  ('daily','일상',7),('martial-arts','무협',8),('sf','SF',9),
  ('sports','스포츠',10),('historical','시대극',11),('mystery','미스터리',12);
create table public.toon_user_settings (
  user_id uuid primary key references public.toon_profiles(id) on delete cascade,
  default_library_visibility public.toon_visibility not null default 'private',
  default_evaluation_visibility public.toon_visibility not null default 'private',
  theme text not null default 'system' check (theme in ('system','light','dark')),
  timezone text not null default 'Asia/Seoul',
  notification_preferences jsonb not null default '{"followers":true,"replies":true,"reactions":true,"announcements":true}',
  preferred_genre_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (cardinality(preferred_genre_ids) <= 12)
);
create table toon_private.toon_user_access (
  user_id uuid primary key references public.toon_profiles(id) on delete cascade,
  status public.toon_access_status not null default 'pending',
  role public.toon_user_role not null default 'user',
  suspension_reason text,
  updated_at timestamptz not null default now()
);
create table toon_private.toon_consent_records (
  user_id uuid not null references public.toon_profiles(id) on delete cascade,
  policy_kind text not null check (policy_kind in ('terms','privacy','age_14')),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_kind, version)
);
create table toon_private.toon_reauth_tickets (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references public.toon_profiles(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  purpose text not null check (purpose in ('password_reset','password_change','email_change','account_delete')),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index toon_reauth_tickets_user_idx on toon_private.toon_reauth_tickets(user_id);
create index toon_reauth_tickets_session_idx on toon_private.toon_reauth_tickets(session_id);
create table toon_private.toon_rate_limit_buckets (
  subject_hash text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null,
  expires_at timestamptz not null,
  primary key (subject_hash, action, window_start)
);

alter table public.toon_profiles enable row level security;
alter table public.toon_user_settings enable row level security;
alter table public.toon_genres enable row level security;
alter table toon_private.toon_user_access enable row level security;
alter table toon_private.toon_consent_records enable row level security;
alter table toon_private.toon_reauth_tickets enable row level security;
alter table toon_private.toon_rate_limit_buckets enable row level security;
revoke all on public.toon_profiles, public.toon_user_settings, public.toon_genres from public, anon, authenticated;
revoke all on toon_private.toon_user_access, toon_private.toon_consent_records, toon_private.toon_reauth_tickets, toon_private.toon_rate_limit_buckets from public, anon, authenticated;
grant select on public.toon_profiles, public.toon_genres to anon, authenticated;
grant select on public.toon_user_settings to authenticated;

create function toon_private.toon_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.toon_profiles for each row execute function toon_private.toon_touch_updated_at();
create trigger settings_updated before update on public.toon_user_settings for each row execute function toon_private.toon_touch_updated_at();
create trigger access_updated before update on toon_private.toon_user_access for each row execute function toon_private.toon_touch_updated_at();

-- Shared Auth users are not automatically enrolled or backfilled into ToonShelf.
-- App-specific registration and explicit OAuth enrollment are added separately.

create function toon_private.toon_session_live() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.user_id = auth.uid() and s.id::text = auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after > now())
      and not coalesce(u.is_anonymous, false)
  );
$$;
create function toon_private.toon_consents_current(p_user_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select count(*) = 3 from toon_private.toon_consent_records
  where user_id = p_user_id and version = '2026-10-02-preview'
    and policy_kind in ('terms','privacy','age_14');
$$;
create function toon_private.toon_profile_visible(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from toon_private.toon_user_access a join auth.users u on u.id = a.user_id
    join public.toon_profiles p on p.id = a.user_id
    where a.user_id = p_user_id and a.status = 'active'
      and u.email is not null and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and p.onboarding_completed_at is not null
      and toon_private.toon_consents_current(p_user_id)
  );
$$;
create function toon_private.toon_current_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select toon_private.toon_session_live() and toon_private.toon_profile_visible(auth.uid());
$$;
revoke execute on function toon_private.toon_session_live(), toon_private.toon_profile_visible(uuid), toon_private.toon_current_active() from public;
grant execute on function toon_private.toon_session_live(), toon_private.toon_profile_visible(uuid), toon_private.toon_current_active() to anon, authenticated;
create policy profile_read on public.toon_profiles for select to anon, authenticated
  using ((id = (select auth.uid()) and (select toon_private.toon_session_live())) or toon_private.toon_profile_visible(id));
create policy settings_read on public.toon_user_settings for select to authenticated
  using (user_id = (select auth.uid()) and (select toon_private.toon_current_active()));
create policy genre_read on public.toon_genres for select to anon, authenticated using (active);

create function toon_private.toon_require_current(p_allow_pending boolean default false) returns uuid
language plpgsql set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_status public.toon_access_status;
begin
  if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  select status into v_status from toon_private.toon_user_access where user_id = v_uid for update;
  if v_status is null or v_status in ('suspended','deleting') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if not exists(select 1 from auth.users where id = v_uid and email is not null and email_confirmed_at is not null)
    then raise exception 'EMAIL_UNVERIFIED' using errcode = 'P0001'; end if;
  if not p_allow_pending and not toon_private.toon_current_active() then raise exception 'ONBOARDING_REQUIRED' using errcode = 'P0001'; end if;
  return v_uid;
end;
$$;
create function toon_private.toon_take_rate(p_action text, p_limit integer, p_window integer) returns void
language plpgsql set search_path = '' as $$
declare v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window) * p_window); v_count integer;
begin
  delete from toon_private.toon_rate_limit_buckets where subject_hash = md5(auth.uid()::text) and expires_at < now();
  insert into toon_private.toon_rate_limit_buckets(subject_hash,action,window_start,request_count,expires_at)
  values (md5(auth.uid()::text),p_action,v_window,1,v_window + make_interval(secs => p_window))
  on conflict (subject_hash,action,window_start) do update
    set request_count = toon_private.toon_rate_limit_buckets.request_count + 1 returning request_count into v_count;
  if v_count > p_limit then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;
end;
$$;
create function public.toon_get_my_access() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_access toon_private.toon_user_access;
begin
  if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_access from toon_private.toon_user_access where user_id = auth.uid();
  if not found then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return jsonb_build_object('status',v_access.status,'consents_current',toon_private.toon_consents_current(auth.uid()));
end;
$$;
create function toon_private.toon_validate_settings(p_library public.toon_visibility, p_evaluation public.toon_visibility, p_theme text, p_timezone text, p_notifications jsonb, p_genres uuid[]) returns void
language plpgsql set search_path = '' as $$
begin
  if p_library is null or p_evaluation is null or p_theme is null or p_theme not in ('system','light','dark')
    or p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
    or p_notifications is null or jsonb_typeof(p_notifications) <> 'object'
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  if exists (select 1 from jsonb_each(p_notifications) e where e.key not in ('followers','replies','reactions','announcements') or jsonb_typeof(e.value) <> 'boolean')
    or (select count(*) from jsonb_each(p_notifications)) <> 4 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  if p_genres is null or cardinality(p_genres) > 12
    or cardinality(p_genres) <> (select count(distinct g) from unnest(p_genres) g)
    or exists (select 1 from unnest(p_genres) g where not exists (select 1 from public.toon_genres where id = g and active))
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
end;
$$;
create function public.toon_complete_onboarding(p_username text, p_display_name text, p_bio text, p_library public.toon_visibility, p_evaluation public.toon_visibility, p_genres uuid[], p_policy_version text, p_terms boolean, p_privacy boolean, p_age_14 boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_existing text;
begin
  v_uid := toon_private.toon_require_current(true);
  perform toon_private.toon_take_rate('onboarding',5,60);
  if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$' or p_username in ('admin','auth','api','support','settings','onboarding','toonshelf','system','moderator')
    or p_display_name is null or char_length(p_display_name) not between 2 and 30
    or p_bio is null or char_length(p_bio) > 160
    or p_policy_version is distinct from '2026-10-02-preview'
    or p_terms is distinct from true or p_privacy is distinct from true or p_age_14 is distinct from true
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  select username into v_existing from public.toon_profiles where id = v_uid for update;
  if v_existing is not null and v_existing <> p_username then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  perform toon_private.toon_validate_settings(p_library,p_evaluation,'system','Asia/Seoul','{"followers":true,"replies":true,"reactions":true,"announcements":true}',p_genres);
  update public.toon_profiles set username = p_username, display_name = p_display_name, bio = p_bio,
    onboarding_completed_at = coalesce(onboarding_completed_at,now()) where id = v_uid;
  update public.toon_user_settings set default_library_visibility = p_library, default_evaluation_visibility = p_evaluation,
    preferred_genre_ids = p_genres where user_id = v_uid;
  insert into toon_private.toon_consent_records(user_id,policy_kind,version)
    select v_uid,kind,p_policy_version from unnest(array['terms','privacy','age_14']) kind on conflict do nothing;
  update toon_private.toon_user_access set status = 'active' where user_id = v_uid;
end;
$$;
create function public.toon_save_profile(p_display_name text, p_bio text, p_discovery_opt_in boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := toon_private.toon_require_current(); perform toon_private.toon_take_rate('profile',20,60);
  if p_display_name is null or char_length(p_display_name) not between 2 and 30 or p_bio is null or char_length(p_bio) > 160 or p_discovery_opt_in is null
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  update public.toon_profiles set display_name = p_display_name, bio = p_bio, discovery_opt_in = p_discovery_opt_in where id = v_uid;
end;
$$;
create function public.toon_save_settings(p_library public.toon_visibility, p_evaluation public.toon_visibility, p_theme text, p_timezone text, p_notifications jsonb, p_genres uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := toon_private.toon_require_current(); perform toon_private.toon_take_rate('settings',20,60);
  perform toon_private.toon_validate_settings(p_library,p_evaluation,p_theme,p_timezone,p_notifications,p_genres);
  update public.toon_user_settings set default_library_visibility = p_library, default_evaluation_visibility = p_evaluation,
    theme = p_theme, timezone = p_timezone, notification_preferences = p_notifications, preferred_genre_ids = p_genres where user_id = v_uid;
end;
$$;
create function public.toon_reserve_account_request(p_action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform toon_private.toon_require_current(p_action = 'password_nonce');
  case p_action
    when 'avatar' then perform toon_private.toon_take_rate('avatar',5,60);
    when 'reauth_verify' then perform toon_private.toon_take_rate('reauth_verify',10,60);
    when 'reauth_email' then perform toon_private.toon_take_rate('reauth_email',1,60);
    when 'password_nonce' then perform toon_private.toon_take_rate('password_nonce',1,60);
    else raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end case;
end;
$$;
create function public.toon_issue_reauth_ticket(p_user_id uuid, p_session_id uuid, p_token_hash text, p_purpose text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Only the server's service role can reach this proof-issuing function.
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_purpose is null or p_purpose not in ('password_reset','password_change','email_change','account_delete')
    or not exists (select 1 from auth.sessions s join auth.users u on u.id = s.user_id join toon_private.toon_user_access a on a.user_id = u.id
      where s.id = p_session_id and s.user_id = p_user_id and (s.not_after is null or s.not_after > now())
        and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
        and (a.status = 'active' or (p_purpose = 'password_reset' and a.status = 'pending')))
    then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  delete from toon_private.toon_reauth_tickets where user_id = p_user_id and (expires_at < now() or consumed_at is not null or (session_id = p_session_id and purpose = p_purpose));
  insert into toon_private.toon_reauth_tickets(token_hash,user_id,session_id,purpose,expires_at)
    values (p_token_hash,p_user_id,p_session_id,p_purpose,now() + interval '10 minutes');
end;
$$;
create function public.toon_consume_reauth_ticket(p_token_hash text, p_purpose text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_hash text;
begin
  v_uid := toon_private.toon_require_current(p_purpose = 'password_reset');
  update toon_private.toon_reauth_tickets set consumed_at = now()
    where token_hash = p_token_hash and user_id = v_uid and session_id::text = auth.jwt()->>'session_id'
      and purpose = p_purpose and expires_at > now() and consumed_at is null returning token_hash into v_hash;
  if v_hash is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return true;
end;
$$;
create function public.toon_set_user_avatar(p_user_id uuid, p_session_id uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not toon_private.toon_profile_visible(p_user_id) or not exists (
    select 1 from auth.sessions where user_id = p_user_id and id = p_session_id and (not_after is null or not_after > now()))
    then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.toon_profiles set avatar_path = p_path where id = p_user_id;
end;
$$;
-- Make all grants explicit, including privileged proof issuance.
revoke execute on all functions in schema toon_private from public, anon, authenticated;
grant execute on function toon_private.toon_session_live(), toon_private.toon_profile_visible(uuid), toon_private.toon_current_active() to anon, authenticated;
revoke execute on function public.toon_get_my_access(), public.toon_complete_onboarding(text,text,text,public.toon_visibility,public.toon_visibility,uuid[],text,boolean,boolean,boolean), public.toon_save_profile(text,text,boolean), public.toon_save_settings(public.toon_visibility,public.toon_visibility,text,text,jsonb,uuid[]), public.toon_consume_reauth_ticket(text,text), public.toon_issue_reauth_ticket(uuid,uuid,text,text), public.toon_set_user_avatar(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.toon_get_my_access(), public.toon_complete_onboarding(text,text,text,public.toon_visibility,public.toon_visibility,uuid[],text,boolean,boolean,boolean), public.toon_save_profile(text,text,boolean), public.toon_save_settings(public.toon_visibility,public.toon_visibility,text,text,jsonb,uuid[]), public.toon_consume_reauth_ticket(text,text) to authenticated;
grant execute on function public.toon_issue_reauth_ticket(uuid,uuid,text,text), public.toon_set_user_avatar(uuid,uuid,text) to service_role;
revoke execute on function public.toon_reserve_account_request(text) from public, anon, authenticated;
grant execute on function public.toon_reserve_account_request(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values ('toon_avatars','toon_avatars',true,2097152,array['image/webp']);
-- No authenticated Storage mutation policy: only validated server uploads.
-- Restrictive policies also protect avatars if a broader policy is added later.
create policy toon_avatars_server_insert on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'toon_avatars');
create policy toon_avatars_server_update on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'toon_avatars') with check (bucket_id <> 'toon_avatars');
create policy toon_avatars_server_delete on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'toon_avatars');
commit;
