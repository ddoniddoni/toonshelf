-- Shared-project username registration. Apply only after inspecting existing Auth triggers.
begin;

-- Admin createUser bypasses signup mail limits, so reserve app-specific capacity first.
-- Return false instead of raising: failed attempts must not roll back the counters.
create function public.toon_reserve_username_signup(p_username text) returns boolean
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare
  v_minute timestamptz := to_timestamp(floor(extract(epoch from now()) / 60) * 60);
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  v_global integer; v_user integer;
begin
  if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$'
    or p_username in ('admin','auth','api','support','settings','onboarding','toonshelf','system','moderator')
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  delete from toon_private.toon_rate_limit_buckets where action = 'username_signup' and expires_at < now();
  insert into toon_private.toon_rate_limit_buckets(subject_hash,action,window_start,request_count,expires_at)
    values ('toon-signup-global','username_signup',v_minute,1,v_minute + interval '60 seconds')
    on conflict(subject_hash,action,window_start) do update
      set request_count = toon_private.toon_rate_limit_buckets.request_count + 1 returning request_count into v_global;
  insert into toon_private.toon_rate_limit_buckets(subject_hash,action,window_start,request_count,expires_at)
    values (md5('toon-signup:' || p_username),'username_signup',v_window,1,v_window + interval '600 seconds')
    on conflict(subject_hash,action,window_start) do update
      set request_count = toon_private.toon_rate_limit_buckets.request_count + 1 returning request_count into v_user;
  return v_global <= 60 and v_user <= 3;
end;
$$;
revoke all on function public.toon_reserve_username_signup(text) from public, anon, authenticated;
grant execute on function public.toon_reserve_username_signup(text) to service_role;

-- Only server-owned app_metadata can select this trigger. Editable user_metadata is ignored.
-- Other apps' Auth users receive no ToonShelf rows; existing users are never backfilled.
create function toon_private.toon_create_username_account() returns trigger
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_app jsonb := new.raw_app_meta_data->'toonshelf'; v_username text;
begin
  if v_app->>'auth_mode' is distinct from 'username' then return new; end if;
  -- Auth admin.createUser inserts first, then updates app_metadata and confirms
  -- within the same transaction. Wait for confirmation before provisioning.
  if new.email_confirmed_at is null then return new; end if;
  if exists(select 1 from public.toon_profiles where id = new.id) then return new; end if;
  v_username := v_app->>'username';
  if v_username is null or v_username !~ '^[a-z0-9_]{3,20}$'
    or v_username in ('admin','auth','api','support','settings','onboarding','toonshelf','system','moderator')
    or new.email is distinct from v_username || '@username.toonshelf.invalid'
    or new.email_confirmed_at is null or coalesce(new.encrypted_password,'') = ''
    or coalesce(new.is_anonymous,false)
    or v_app->>'policy_version' is distinct from '2026-10-02-preview'
    or v_app->'consents'->'terms' is distinct from 'true'::jsonb
    or v_app->'consents'->'privacy' is distinct from 'true'::jsonb
    or v_app->'consents'->'age_14' is distinct from 'true'::jsonb
    then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  insert into public.toon_profiles(id,username,display_name,onboarding_completed_at)
    values (new.id,v_username,v_username,now());
  insert into public.toon_user_settings(user_id) values (new.id);
  insert into toon_private.toon_user_access(user_id,status) values (new.id,'active');
  insert into toon_private.toon_consent_records(user_id,policy_kind,version)
    select new.id,kind,'2026-10-02-preview' from unnest(array['terms','privacy','age_14']) kind;
  return new;
end;
$$;
revoke all on function toon_private.toon_create_username_account() from public, anon, authenticated;
create trigger toon_auth_username_created after insert or update of raw_app_meta_data, email_confirmed_at on auth.users
  for each row execute function toon_private.toon_create_username_account();

-- A deliberate OAuth login may enroll its own verified Auth identity, without a global trigger.
-- This creates only a pending membership; required consents/profile setup still activate it.
create function public.toon_enroll_current_account() returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid := auth.uid();
begin
  if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if not exists(select 1 from auth.users where id = v_uid and email is not null and email_confirmed_at is not null)
    then raise exception 'EMAIL_UNVERIFIED' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('toon-enroll:' || v_uid::text,0));
  insert into public.toon_profiles(id) values(v_uid) on conflict(id) do nothing;
  insert into public.toon_user_settings(user_id) values(v_uid) on conflict(user_id) do nothing;
  insert into toon_private.toon_user_access(user_id) values(v_uid) on conflict(user_id) do nothing;
end;
$$;
revoke all on function public.toon_enroll_current_account() from public, anon, authenticated;
grant execute on function public.toon_enroll_current_account() to authenticated;

create or replace function public.toon_reserve_account_request(p_action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform toon_private.toon_require_current(p_action = 'password_nonce');
  case p_action
    when 'avatar' then perform toon_private.toon_take_rate('avatar',5,60);
    when 'reauth_verify' then perform toon_private.toon_take_rate('reauth_verify',10,60);
    when 'reauth_email' then perform toon_private.toon_take_rate('reauth_email',1,60);
    when 'password_nonce' then perform toon_private.toon_take_rate('password_nonce',1,60);
    when 'password_change' then perform toon_private.toon_take_rate('password_change',5,60);
    else raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end case;
end;
$$;
-- Scope default PUBLIC-execute cleanup to this app; preserve other apps' grants
-- and the explicit anon/authenticated grants on the ToonShelf API/RLS helpers.
do $$
declare v_function record;
begin
  for v_function in
    select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'toon_private'
      or (n.nspname = 'public' and left(p.proname,5) = 'toon_')
  loop
    execute format('revoke execute on function %I.%I(%s) from public',v_function.nspname,v_function.proname,v_function.args);
  end loop;
end;
$$;
commit;
