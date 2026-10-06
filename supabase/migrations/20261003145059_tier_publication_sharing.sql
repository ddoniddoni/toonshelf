-- P4 increment 2. File only: no migration application or execution checks.
alter table public.toon_tier_lists drop constraint tier_private_only;
alter table public.toon_tier_lists add column version bigint not null default 1 check(version between 1 and 9007199254740991);
alter table public.toon_tier_lists add column publication_counter bigint not null default 0 check(publication_counter between 0 and 9007199254740991);
alter table public.toon_tier_lists add constraint tier_publication_state check(
 (visibility = 'private' and published_version is null) or
 (visibility in ('public','unlisted') and published_version is not null and published_version between 1 and publication_counter));
alter table public.toon_tier_lists add constraint tier_moderation_valid check(moderation_status in ('visible','hidden'));
create table public.toon_tier_list_publications (
 tier_list_id uuid not null references public.toon_tier_lists(id) on delete cascade,
 version bigint not null check(version between 1 and 9007199254740991),payload jsonb not null,
 is_spoiler boolean not null default true,published_at timestamptz not null default now(),
 primary key(tier_list_id,version),
 check(toon_private.toon_tier_payload(payload) is not null),
 check(not jsonb_path_exists(payload,'$.placements[*] ? (@.rowId == null)'))
);
alter table public.toon_tier_lists add constraint tier_current_publication_fk foreign key(id,published_version)
 references public.toon_tier_list_publications(tier_list_id,version) deferrable initially deferred;
create index toon_tier_publications_placements_idx on public.toon_tier_list_publications using gin((payload->'placements') jsonb_path_ops);
create index toon_tier_public_list_idx on public.toon_tier_lists(created_at desc,id) where visibility = 'public' and moderation_status = 'visible' and deleted_at is null;
create table toon_private.toon_tier_share_tokens (
 tier_list_id uuid primary key references public.toon_tier_lists(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 encrypted_token text not null check(encrypted_token ~ '^[a-f0-9]{118}$'),
 encryption_nonce text not null check(encryption_nonce ~ '^[a-f0-9]{24}$'),
 expires_at timestamptz,revoked_at timestamptz,rotated_at timestamptz not null default now()
);
alter table public.toon_tier_list_publications enable row level security;
alter table toon_private.toon_tier_share_tokens enable row level security;
revoke all on public.toon_tier_list_publications,toon_private.toon_tier_share_tokens from public,anon,authenticated;
-- No direct SELECT/DML policies. All reads resolve the current publication.

create function toon_private.toon_tier_state(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'visibility',l.visibility,'publishedVersion',l.published_version,
  'moderationStatus',l.moderation_status,'publishedAt',p.published_at,
  'hasShareToken',l.visibility = 'unlisted' and l.moderation_status = 'visible' and exists(select 1 from toon_private.toon_tier_share_tokens t
   where t.tier_list_id = l.id and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())))
 from public.toon_tier_lists l left join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version where l.id = p_id;
$$;
create function toon_private.toon_tier_publish_payload(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 with draft as (select toon_private.toon_tier_normalize(toon_private.toon_tier_draft_json(p_id)) value), placed as (
  select e.value,e.ordinality,row_number() over(partition by e.value->>'rowId' order by (e.value->>'position')::integer)-1 pos
  from draft cross join lateral jsonb_array_elements(value->'placements') with ordinality e where e.value->>'rowId' is not null
 ) select jsonb_set(value,'{placements}',coalesce((select jsonb_agg(p.value || jsonb_build_object('position',pos) order by ordinality) from placed p),'[]')) from draft;
$$;
-- Return only public work cards and non-identifying null placeholders. Raw hidden
-- work IDs, unplaced works, cover URLs, tokens and private notes never enter DTOs.
create function toon_private.toon_tier_public_body(p_payload jsonb) returns jsonb
language sql stable set search_path = '' as $$
 with normalized as (select toon_private.toon_tier_normalize(p_payload) value)
 select (value - 'placements' - 'rows') || jsonb_build_object('rows',(
  select jsonb_agg(r.value || jsonb_build_object('items',coalesce((
   select jsonb_agg(case when toon_private.toon_work_public((w.value->>'workId')::uuid) then toon_private.toon_work_card((w.value->>'workId')::uuid) else null end order by (w.value->>'position')::integer)
   from jsonb_array_elements(n.value->'placements') w where w.value->>'rowId' = r.value->>'id'),'[]'::jsonb)) order by r.ordinality)
  from jsonb_array_elements(n.value->'rows') with ordinality r)) from normalized n;
$$;
create function toon_private.toon_tier_preview_hash(p_id uuid) returns text
language sql stable set search_path = '' as $$
 select toon_private.toon_merge_digest(toon_private.toon_tier_publish_payload(p_id)::text || toon_private.toon_tier_public_body(toon_private.toon_tier_publish_payload(p_id))::text);
$$;
create function public.toon_get_my_tier_publication_state(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform toon_private.toon_require_current();
 if not exists(select 1 from public.toon_tier_lists where id = p_id and user_id = auth.uid() and deleted_at is null) then return null;end if;
 return toon_private.toon_tier_state(p_id);
end;$$;

-- Minimum report/moderation boundary for public and capability-visible UGC.
create table toon_private.toon_tier_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.toon_profiles(id) on delete cascade,
 tier_list_id uuid not null references public.toon_tier_lists(id),
 reason text not null check(reason in ('spoiler','piracy','personal_information','harassment','spam','other')),
 detail text not null check(char_length(toon_private.toon_review_text_trim(detail)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','resolved','rejected')),
 result_note text not null default '' check(char_length(result_note) <= 500),created_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index toon_tier_reports_pending_idx on toon_private.toon_tier_reports(reporter_id,tier_list_id) where status = 'pending';
create index toon_tier_reports_owner_idx on toon_private.toon_tier_reports(reporter_id,created_at desc,id);
create index toon_tier_reports_queue_idx on toon_private.toon_tier_reports(created_at,id) where status = 'pending';
create index toon_tier_reports_list_idx on toon_private.toon_tier_reports(tier_list_id,created_at desc,id);
create table toon_private.toon_tier_moderation_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.toon_profiles(id) on delete set null,
 tier_list_id uuid references public.toon_tier_lists(id) on delete set null,report_id uuid references toon_private.toon_tier_reports(id) on delete set null,
 action text not null,reason text not null check(char_length(toon_private.toon_review_text_trim(reason)) between 2 and 1000),created_at timestamptz not null default now()
);
create index toon_tier_moderation_events_list_idx on toon_private.toon_tier_moderation_events(tier_list_id,created_at desc);
alter table toon_private.toon_tier_reports enable row level security;
alter table toon_private.toon_tier_moderation_events enable row level security;
revoke all on toon_private.toon_tier_reports,toon_private.toon_tier_moderation_events from public,anon,authenticated;
create function toon_private.toon_tier_report_json(p_report toon_private.toon_tier_reports) returns jsonb
language sql immutable set search_path = '' as $$
 select jsonb_build_object('id',p_report.id,'tierId',p_report.tier_list_id,'reason',p_report.reason,'detail',p_report.detail,
  'status',p_report.status,'result',p_report.result_note,'createdAt',p_report.created_at);
$$;
create function public.toon_report_tier_publication(p_id uuid,p_hash text,p_reason text,p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_report',5,60);
 if p_reason is null or p_reason not in ('spoiler','piracy','personal_information','harassment','spam','other') or p_detail is null
  or char_length(toon_private.toon_review_text_trim(p_detail)) not between 10 and 2000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select user_id into v_author from public.toon_tier_lists where id = p_id and toon_private.toon_tier_accessible(p_id,p_hash) for share;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_author = auth.uid() then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 insert into toon_private.toon_tier_reports(reporter_id,tier_list_id,reason,detail) values(auth.uid(),p_id,p_reason,toon_private.toon_review_text_trim(p_detail))
 on conflict(reporter_id,tier_list_id) where status = 'pending' do nothing;
end;$$;
create function public.toon_list_my_tier_reports(p_page integer default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 perform toon_private.toon_require_current();if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 with page as (select r,row_number() over(order by created_at desc,id) n from toon_private.toon_tier_reports r where reporter_id = auth.uid()
  order by created_at desc,id limit 21 offset (p_page-1)*20)
 select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_tier_report_json(r) order by n) filter(where n <= p_page*20),'[]'),
  'hasNext',count(*) > 20) into v_result from page;return v_result;
end;$$;
create function public.toon_list_tier_reports(p_page integer default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 perform toon_private.toon_require_review_moderator();if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 with page as (select r,row_number() over(order by created_at,id) n from toon_private.toon_tier_reports r where status = 'pending'
  order by created_at,id limit 21 offset (p_page-1)*20)
 select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_tier_report_json(r) order by n) filter(where n <= p_page*20),'[]'),
  'hasNext',count(*) > 20) into v_result from page;return v_result;
end;$$;
create function public.toon_moderation_tier_snapshot(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 perform toon_private.toon_require_review_moderator();
 select jsonb_build_object('id',l.id,'version',l.version,'visibility',l.visibility,'moderationStatus',l.moderation_status,'deleted',l.deleted_at is not null,
  'body',case when l.deleted_at is null and l.visibility <> 'private' then toon_private.toon_tier_public_body(p.payload) else null end,
  'reports',coalesce((select jsonb_agg(toon_private.toon_tier_report_json(q::toon_private.toon_tier_reports) order by q.created_at desc,q.id) from
   (select * from toon_private.toon_tier_reports where tier_list_id = p_id order by created_at desc,id limit 50) q),'[]'),
  'events',coalesce((select jsonb_agg(jsonb_build_object('action',q.action,'reason',q.reason,'createdAt',q.created_at) order by q.created_at desc) from
   (select * from toon_private.toon_tier_moderation_events where tier_list_id = p_id order by created_at desc limit 50) q),'[]')) into v_result
 from public.toon_tier_lists l left join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version where l.id = p_id;
 return v_result;
end;$$;
create function public.toon_moderate_tier_publication(p_id uuid,p_version bigint,p_action text,p_reason text,p_report uuid,p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_list public.toon_tier_lists;
begin
 perform toon_private.toon_require_review_moderator();perform toon_private.toon_take_rate('tier_moderate',30,60);
 if p_action is null or p_action not in ('hide','restore','reject_report') or p_reason is null or char_length(toon_private.toon_review_text_trim(p_reason)) not between 2 and 1000
  or p_result is null or char_length(p_result) > 500 or (p_action = 'reject_report' and p_report is null) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_list from public.toon_tier_lists where id = p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_list.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_action <> 'reject_report' and (v_list.deleted_at is not null or v_list.visibility = 'private') then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 if p_report is not null then
  perform id from toon_private.toon_tier_reports where id = p_report and tier_list_id = p_id and status = 'pending' for update;
  if not found then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  update toon_private.toon_tier_reports set status = case when p_action = 'reject_report' then 'rejected' else 'resolved' end,
   result_note = p_result,resolved_at = clock_timestamp() where id = p_report;
 end if;
 update public.toon_tier_lists set moderation_status = case when p_action = 'hide' then 'hidden' when p_action = 'restore' then 'visible' else moderation_status end,
  version = version+1 where id = p_id;
 -- Hiding permanently revokes the old link. Restoration alone never revives it.
 if p_action = 'hide' then update toon_private.toon_tier_share_tokens set revoked_at = clock_timestamp() where tier_list_id = p_id;end if;
 insert into toon_private.toon_tier_moderation_events(actor_id,tier_list_id,report_id,action,reason) values(auth.uid(),p_id,p_report,p_action,toon_private.toon_review_text_trim(p_reason));
end;$$;
create function public.toon_preview_tier_publication(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_preview',30,60);
 -- The draft, lifecycle version, body and fingerprint share one statement snapshot.
 select jsonb_build_object('draftVersion',d.version,'state',toon_private.toon_tier_state(l.id),
  'body',toon_private.toon_tier_public_body(toon_private.toon_tier_publish_payload(l.id)),'fingerprint',toon_private.toon_tier_preview_hash(l.id)) into v_result
 from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id where l.id = p_id and l.user_id = auth.uid() and l.deleted_at is null;
 return v_result;
end;$$;
create function toon_private.toon_tier_put_token(p_id uuid,p_token jsonb) returns void
language plpgsql set search_path = '' as $$
begin
 if p_token is null or jsonb_typeof(p_token) <> 'object' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if (select count(*) from jsonb_object_keys(p_token)) <> 3 or not p_token ?& array['hash','ciphertext','nonce']
  or jsonb_typeof(p_token->'hash') <> 'string' or jsonb_typeof(p_token->'ciphertext') <> 'string' or jsonb_typeof(p_token->'nonce') <> 'string'
  or p_token->>'hash' !~ '^[a-f0-9]{64}$' or p_token->>'ciphertext' !~ '^[a-f0-9]{118}$' or p_token->>'nonce' !~ '^[a-f0-9]{24}$' then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 insert into toon_private.toon_tier_share_tokens(tier_list_id,token_hash,encrypted_token,encryption_nonce)
 values(p_id,p_token->>'hash',p_token->>'ciphertext',p_token->>'nonce')
 on conflict(tier_list_id) do update set token_hash = excluded.token_hash,encrypted_token = excluded.encrypted_token,
  encryption_nonce = excluded.encryption_nonce,expires_at = null,revoked_at = null,rotated_at = clock_timestamp();
end;$$;
create function public.toon_publish_tier_list(p_id uuid,p_draft_version bigint,p_list_version bigint,p_fingerprint text,
 p_visibility text,p_spoiler boolean,p_token jsonb,p_confirm boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_list public.toon_tier_lists;v_draft_version bigint;v_payload jsonb;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_publish',10,60);
 if p_confirm is distinct from true or p_spoiler is null or p_visibility is null or p_visibility not in ('public','unlisted')
  or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if not exists(select 1 from public.toon_tier_lists where id = p_id and user_id = v_uid and deleted_at is null) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 -- Same user -> work -> metadata -> draft order as cloning and merge preparation.
 perform w.id from public.toon_works w where w.id in (select (value->>'workId')::uuid from jsonb_array_elements(toon_private.toon_tier_draft_json(p_id)->'placements')
  union select toon_private.toon_current_merged_work((value->>'workId')::uuid) from jsonb_array_elements(toon_private.toon_tier_draft_json(p_id)->'placements')) order by w.id for share;
 select * into v_list from public.toon_tier_lists where id = p_id and user_id = v_uid and deleted_at is null for update;
 select version into v_draft_version from public.toon_tier_list_drafts where tier_list_id = p_id for update;
 if p_list_version is distinct from v_list.version or p_draft_version is distinct from v_draft_version
  or p_fingerprint is distinct from toon_private.toon_tier_preview_hash(p_id) then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if v_list.moderation_status <> 'visible' then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 v_payload := toon_private.toon_tier_payload(toon_private.toon_tier_publish_payload(p_id));
 insert into public.toon_tier_list_publications(tier_list_id,version,payload,is_spoiler) values(p_id,v_list.publication_counter+1,v_payload,p_spoiler);
 if p_visibility = 'unlisted' then perform toon_private.toon_tier_put_token(p_id,p_token);
 else
  if p_token is not null then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  update toon_private.toon_tier_share_tokens set revoked_at = clock_timestamp() where tier_list_id = p_id;
 end if;
 update public.toon_tier_lists set visibility = p_visibility::public.toon_tier_visibility,published_version = publication_counter+1,
  publication_counter = publication_counter+1,version = version+1 where id = p_id;
 return toon_private.toon_tier_state(p_id);
end;$$;
create function public.toon_withdraw_tier_publication(p_id uuid,p_version bigint,p_confirm boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_list public.toon_tier_lists;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_withdraw',20,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 select * into v_list from public.toon_tier_lists where id = p_id and user_id = auth.uid() and deleted_at is null for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_list.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 update public.toon_tier_lists set visibility = 'private',published_version = null,version = version+1 where id = p_id;
 update toon_private.toon_tier_share_tokens set revoked_at = clock_timestamp() where tier_list_id = p_id;
 return toon_private.toon_tier_state(p_id);
end;$$;
create function public.toon_rotate_tier_share_token(p_id uuid,p_version bigint,p_token jsonb,p_confirm boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_list public.toon_tier_lists;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_rotate',10,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 select * into v_list from public.toon_tier_lists where id = p_id and user_id = auth.uid() and deleted_at is null for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_list.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if v_list.visibility <> 'unlisted' or v_list.moderation_status <> 'visible' then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 perform toon_private.toon_tier_put_token(p_id,p_token);update public.toon_tier_lists set version = version+1 where id = p_id;
 return toon_private.toon_tier_state(p_id);
end;$$;
create function public.toon_get_my_tier_share_token(p_id uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_list public.toon_tier_lists;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_link_recover',30,60);
 select * into v_list from public.toon_tier_lists where id = p_id and user_id = auth.uid() and deleted_at is null;
 if not found then return null;end if;
 if p_version is distinct from v_list.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if v_list.visibility <> 'unlisted' or v_list.moderation_status <> 'visible' then return null;end if;
 return (select jsonb_build_object('hash',token_hash,'ciphertext',encrypted_token,'nonce',encryption_nonce) from toon_private.toon_tier_share_tokens
  where tier_list_id = p_id and revoked_at is null and (expires_at is null or expires_at > now()));
end;$$;
create function toon_private.toon_tier_accessible(p_id uuid,p_hash text) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from public.toon_tier_lists l where l.id = p_id and l.deleted_at is null and l.moderation_status = 'visible'
  and toon_private.toon_author_active(l.user_id) and toon_private.toon_users_can_interact(l.user_id) and l.published_version is not null and (
   (p_hash is null and l.visibility = 'public') or (l.visibility = 'unlisted' and exists(select 1 from toon_private.toon_tier_share_tokens t
    where t.tier_list_id = l.id and t.token_hash = p_hash and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())))));
$$;
create function toon_private.toon_tier_dto(p_id uuid,p_reveal boolean) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'publishedVersion',p.version,'publishedAt',p.published_at,
  'authorId',a.id,'username',a.username,'name',a.display_name,'isSpoiler',p.is_spoiler,
  'body',case when p.is_spoiler and not p_reveal then null else toon_private.toon_tier_public_body(p.payload) end)
 from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
 join public.toon_profiles a on a.id = l.user_id where l.id = p_id;
$$;
create function public.toon_get_tier_publication(p_id uuid,p_hash text,p_reveal boolean default false,p_version bigint default null) returns jsonb
language sql stable security definer set search_path = '' as $$
 select toon_private.toon_tier_dto(l.id,p_reveal) from public.toon_tier_lists l where
  (l.id = p_id or (p_id is null and p_hash is not null and l.id = (select tier_list_id from toon_private.toon_tier_share_tokens where token_hash = p_hash)))
  and toon_private.toon_tier_accessible(l.id,p_hash) and (p_reveal is false or (p_reveal is true and p_version = l.version));
$$;
create function toon_private.toon_tier_listing_card(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'publishedVersion',p.version,'publishedAt',p.published_at,
  'authorId',a.id,'username',a.username,'name',a.display_name,'isSpoiler',p.is_spoiler,
  'title',case when p.is_spoiler then null else p.payload->>'title' end)
 from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
 join public.toon_profiles a on a.id = l.user_id where l.id = p_id;
$$;
create function public.toon_list_public_tiers(p_page integer default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 with page as (
  select l.id,p.published_at from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
   where l.visibility = 'public' and l.deleted_at is null and l.moderation_status = 'visible'
   and toon_private.toon_tier_accessible(l.id,null) order by p.published_at desc,l.id limit 13 offset (p_page-1)*12
 ), ranked as (select *,row_number() over(order by published_at desc,id) n from page)
 select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_tier_listing_card(id) order by published_at desc,id) filter(where n <= 12),'[]'),
  'hasNext',count(*) > 12) into v_result from ranked;return v_result;
end;$$;
create function public.toon_clone_tier_publication(p_id uuid,p_hash text,p_version bigint,p_confirm boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;v_version bigint;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_clone',10,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 select p.payload into v_payload from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
  where l.id = p_id and toon_private.toon_tier_accessible(l.id,p_hash);
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 perform w.id from public.toon_works w where w.id in (select (value->>'workId')::uuid from jsonb_array_elements(v_payload->'placements')
  union select toon_private.toon_current_merged_work((value->>'workId')::uuid) from jsonb_array_elements(v_payload->'placements')) order by w.id for share;
 select l.version,p.payload into v_version,v_payload from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
  where l.id = p_id and toon_private.toon_tier_accessible(l.id,p_hash) for share of l;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 -- Drop unavailable works and reindex; copying never carries another user's
 -- tokens, notes, evaluations, unplaced works or private draft.
 v_payload := toon_private.toon_tier_normalize(v_payload);
 with kept as (select value,row_number() over(partition by value->>'rowId' order by (value->>'position')::integer)-1 pos
  from jsonb_array_elements(v_payload->'placements') where toon_private.toon_work_public((value->>'workId')::uuid))
 select jsonb_set(v_payload,'{placements}',coalesce(jsonb_agg(value || jsonb_build_object('position',pos)),'[]')) into v_payload from kept;
 v_payload := jsonb_set(v_payload,'{title}',to_jsonb(left(v_payload->>'title',75) || ' (복사)'));
 return public.toon_create_tier_draft(v_payload,null);
end;$$;

-- Deleting a published tier also revokes its capability and removes snapshots.
create or replace function public.toon_delete_tier_draft(p_id uuid,p_version bigint,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_version bigint;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_delete',20,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 select d.version into v_version from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id
  where l.id = p_id and l.user_id = auth.uid() and l.deleted_at is null for update of l,d;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 update public.toon_tier_lists set deleted_at = clock_timestamp(),visibility = 'private',published_version = null,version = version+1 where id = p_id;
 delete from toon_private.toon_tier_share_tokens where tier_list_id = p_id;
 delete from public.toon_tier_list_publications where tier_list_id = p_id;
 delete from toon_private.toon_tier_merge_history where tier_list_id = p_id;
 delete from public.toon_tier_list_drafts where tier_list_id = p_id;
end;$$;

-- Publications remain immutable. Resolve merged IDs at every read/clone; the
-- original snapshot is retained. A merge changes lifecycle versions as well as
-- draft versions so old preview/reveal/clone requests cannot silently continue.
create function toon_private.toon_tier_publication_mentions(p_payload jsonb,p_work uuid) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from jsonb_array_elements(p_payload->'placements') e
  where (e.value->>'workId')::uuid = p_work or toon_private.toon_current_merged_work((e.value->>'workId')::uuid) = p_work);
$$;
create function toon_private.toon_tier_merge_affected(p_source uuid,p_target uuid) returns setof uuid
language sql stable set search_path = '' as $$
 select l.id from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id where l.deleted_at is null and
  (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source)) or d.placements @> jsonb_build_array(jsonb_build_object('workId',p_target)))
 union
 select l.id from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
  where l.deleted_at is null and (toon_private.toon_tier_publication_mentions(p.payload,p_source) or toon_private.toon_tier_publication_mentions(p.payload,p_target));
$$;
create or replace function toon_private.toon_work_merge_fingerprint(p_source uuid,p_target uuid) returns text
language sql stable set search_path = '' as $$
 select toon_private.toon_merge_digest(toon_private.toon_personal_merge_fingerprint(p_source,p_target) || coalesce((
  select string_agg(toon_private.toon_merge_digest(to_jsonb(l)::text || to_jsonb(d)::text || coalesce(to_jsonb(p)::text,'')),'|' order by l.id)
  from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id
  left join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
  where l.id in (select toon_private.toon_tier_merge_affected(p_source,p_target))),''));
$$;
create or replace function toon_private.toon_work_merge_summary(p_source uuid,p_target uuid) returns jsonb
language sql stable set search_path = '' as $$
 with base as (select toon_private.toon_personal_merge_summary(p_source,p_target) value), states as (
  select value,exists(select 1 from unnest(array['tier_list_items','posts']) t where to_regclass('public.toon_' || t) is not null) blocked,
   (select count(*) from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
    where l.deleted_at is null and toon_private.toon_tier_publication_mentions(p.payload,p_source)) publications from base
 ), updated as (
  select value || jsonb_build_object('records',(value->'records') || jsonb_build_object('tiers',(
    select count(*) from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id
    left join public.toon_tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version where l.deleted_at is null
    and (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source)) or toon_private.toon_tier_publication_mentions(p.payload,p_source)))),
   'conflicts',(value->'conflicts') || jsonb_build_object('unavailable',(value->'conflicts'->>'unavailable')::bigint +
    case when not toon_private.toon_work_public(p_source) then publications else 0 end),'blockedByPersonalDomains',blocked) value,blocked from states
 ) select value || jsonb_build_object('canMerge',not blocked and not exists(select 1 from jsonb_each_text(value->'conflicts') x where x.value::bigint > 0)) from updated;
$$;
create or replace function public.toon_admin_merge_works(p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,
 p_reason text,p_confirm boolean,p_preview_token uuid,p_conflict_policy text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_affected uuid[];
begin
 perform toon_private.toon_require_catalogue_admin();
 if not pg_catalog.pg_try_advisory_xact_lock(716231) then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 perform id from public.toon_works where id in (p_source,p_target) order by id for update nowait;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_affected from toon_private.toon_tier_merge_affected(p_source,p_target) as affected(id);
 perform a.user_id from toon_private.toon_user_access a where a.user_id in (select user_id from public.toon_tier_lists where id = any(v_affected)) order by a.user_id for update nowait;
 perform l.id from public.toon_tier_lists l where l.id = any(v_affected) order by l.id for update nowait;
 perform d.tier_list_id from public.toon_tier_list_drafts d where d.tier_list_id = any(v_affected) order by d.tier_list_id for update nowait;
 perform toon_private.toon_admin_merge_personal_base(p_source,p_target,p_source_version,p_target_version,p_reason,p_confirm,p_preview_token,p_conflict_policy);
 perform toon_private.toon_merge_tier_drafts(p_source,p_target);
 update public.toon_tier_lists set version = version+1 where id = any(v_affected);
exception when lock_not_available or deadlock_detected then raise exception 'CONFLICT' using errcode = 'P0001';
end;$$;

revoke all on function toon_private.toon_tier_state(uuid),toon_private.toon_tier_publish_payload(uuid),toon_private.toon_tier_public_body(jsonb),toon_private.toon_tier_preview_hash(uuid),
 toon_private.toon_tier_put_token(uuid,jsonb),toon_private.toon_tier_accessible(uuid,text),toon_private.toon_tier_dto(uuid,boolean),toon_private.toon_tier_listing_card(uuid),toon_private.toon_tier_report_json(toon_private.toon_tier_reports),
 toon_private.toon_tier_publication_mentions(jsonb,uuid),toon_private.toon_tier_merge_affected(uuid,uuid) from public,anon,authenticated;
revoke all on function public.toon_get_my_tier_publication_state(uuid),public.toon_preview_tier_publication(uuid),
 public.toon_publish_tier_list(uuid,bigint,bigint,text,text,boolean,jsonb,boolean),public.toon_withdraw_tier_publication(uuid,bigint,boolean),
 public.toon_rotate_tier_share_token(uuid,bigint,jsonb,boolean),public.toon_get_my_tier_share_token(uuid,bigint),
 public.toon_get_tier_publication(uuid,text,boolean,bigint),public.toon_list_public_tiers(integer),public.toon_clone_tier_publication(uuid,text,bigint,boolean),
 public.toon_report_tier_publication(uuid,text,text,text),public.toon_list_my_tier_reports(integer),public.toon_list_tier_reports(integer),
 public.toon_moderation_tier_snapshot(uuid),public.toon_moderate_tier_publication(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.toon_get_tier_publication(uuid,text,boolean,bigint),public.toon_list_public_tiers(integer) to anon,authenticated;
grant execute on function public.toon_get_my_tier_publication_state(uuid),public.toon_preview_tier_publication(uuid),
 public.toon_publish_tier_list(uuid,bigint,bigint,text,text,boolean,jsonb,boolean),public.toon_withdraw_tier_publication(uuid,bigint,boolean),
 public.toon_rotate_tier_share_token(uuid,bigint,jsonb,boolean),public.toon_get_my_tier_share_token(uuid,bigint),
 public.toon_clone_tier_publication(uuid,text,bigint,boolean),public.toon_report_tier_publication(uuid,text,text,text),
 public.toon_list_my_tier_reports(integer),public.toon_list_tier_reports(integer),public.toon_moderation_tier_snapshot(uuid),
 public.toon_moderate_tier_publication(uuid,bigint,text,text,uuid,text) to authenticated;
alter function public.toon_preview_tier_publication(uuid) set statement_timeout = '5s';
alter function public.toon_get_tier_publication(uuid,text,boolean,bigint) set statement_timeout = '5s';
alter function public.toon_list_public_tiers(integer) set statement_timeout = '5s';
alter function public.toon_moderation_tier_snapshot(uuid) set statement_timeout = '5s';
alter function public.toon_list_tier_reports(integer) set statement_timeout = '5s';
alter function public.toon_list_my_tier_reports(integer) set statement_timeout = '5s';
