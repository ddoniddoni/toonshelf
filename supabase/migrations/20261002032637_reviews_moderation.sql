-- P3 review drafts/publications and the minimum moderation/blocking boundary.
-- File only: not applied, inspected by advisors, or tested against a live DB.
create table public.blocks (
 blocker_id uuid not null references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id <> blocked_id)
);
create index blocks_reverse_idx on public.blocks(blocked_id,blocker_id);
alter table public.blocks enable row level security;
revoke all on public.blocks from public,anon,authenticated;
grant select on public.blocks to authenticated;
create policy blocks_own_read on public.blocks for select to authenticated using(blocker_id = (select auth.uid()) and (select private.current_active()));
create function private.users_can_interact(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is null or not exists(select 1 from public.blocks where
  (blocker_id = auth.uid() and blocked_id = p_target) or (blocker_id = p_target and blocked_id = auth.uid()));
$$;
-- Keep this account-state predicate independent from blocks; moderation must
-- be able to check a reported author's state without exposing personal records.
create function private.author_active(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.user_access a join auth.users u on u.id = a.user_id join public.profiles p on p.id = a.user_id
  where a.user_id = p_user and a.status = 'active' and u.email is not null and u.email_confirmed_at is not null
  and not coalesce(u.is_anonymous,false) and p.onboarding_completed_at is not null and private.consents_current(p_user));
$$;
create or replace function private.profile_visible(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.author_active(p_user_id) and private.users_can_interact(p_user_id);
$$;
create function public.set_user_block(p_user uuid,p_blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := private.require_current(); perform private.take_rate('user_block',30,60);
 if p_user is null or p_user = v_uid or p_blocked is null then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 if not exists(select 1 from public.profiles where id = p_user) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 if p_blocked then insert into public.blocks(blocker_id,blocked_id) values(v_uid,p_user) on conflict do nothing;
 else delete from public.blocks where blocker_id = v_uid and blocked_id = p_user; end if;
 -- P5 must add transactional removal of both directions of follows when that
 -- domain is introduced. No follow/reaction/comment records exist at P3.
end;
$$;
create function public.get_my_blocks() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := private.require_current();
 return coalesce((select jsonb_agg(jsonb_build_object('id',b.blocked_id,'username',case when private.author_active(b.blocked_id) then p.username else null end,
  'name',case when private.author_active(b.blocked_id) then p.display_name else '이용할 수 없는 계정' end) order by b.created_at desc)
  from public.blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = v_uid),'[]');
end;
$$;

-- Match ECMAScript String.trim() at the direct RPC boundary as well as forms.
-- PostgreSQL btrim(text) alone removes only ordinary spaces.
create function private.review_text_trim(p_text text) returns text
language sql immutable set search_path = '' as $$
 select btrim(p_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
create table public.reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 work_id uuid not null references public.works(id), body text not null default '' check(char_length(body) <= 5000),
 is_spoiler boolean not null default false, read_upto_episode integer check(read_upto_episode between 0 and 1000000),
 publication_status public.publication_status not null default 'draft', moderation_status public.moderation_status not null default 'visible',
 published_at timestamptz, deleted_at timestamptz, version bigint not null default 1 check(version > 0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(publication_status <> 'published' or (published_at is not null and char_length(private.review_text_trim(body)) >= 20)),
 check(deleted_at is null or (body = '' and publication_status = 'draft'))
);
create unique index reviews_current_owner_work_idx on public.reviews(user_id,work_id) where deleted_at is null;
create index reviews_work_public_idx on public.reviews(work_id,published_at desc,id) where deleted_at is null and publication_status = 'published' and moderation_status = 'visible';
create index reviews_work_idx on public.reviews(work_id);
create table public.content_edit_drafts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 review_id uuid not null unique references public.reviews(id) on delete cascade,
 payload jsonb not null default '{"body":"","isSpoiler":false,"episode":null}', version bigint not null default 1 check(version > 0),updated_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
alter table public.content_edit_drafts enable row level security;
revoke all on public.reviews,public.content_edit_drafts from public,anon,authenticated;
-- A non-owner cannot obtain a spoiler body using direct table SELECT.
-- Public readers use the projections below; owners can read their own content.
grant select on public.reviews,public.content_edit_drafts to authenticated;
create policy review_owner_read on public.reviews for select to authenticated
 using(user_id = (select auth.uid()) and (select private.current_active()) and deleted_at is null);
create policy review_draft_owner_read on public.content_edit_drafts for select to authenticated
 using(user_id = (select auth.uid()) and (select private.current_active()) and exists(select 1 from public.reviews where id = review_id and user_id = auth.uid() and deleted_at is null));
create function private.validate_review_payload(p_payload jsonb,p_publishing boolean) returns void
language plpgsql set search_path = '' as $$
begin
 perform private.assert_keys(p_payload,array['body','isSpoiler','episode']);
 if not p_payload ?& array['body','isSpoiler','episode'] or octet_length(p_payload::text) > 32768
  or jsonb_typeof(p_payload->'body') is distinct from 'string' or char_length(p_payload->>'body') > 5000
  or jsonb_typeof(p_payload->'isSpoiler') is distinct from 'boolean'
  or (p_publishing and char_length(private.review_text_trim(p_payload->>'body')) < 20)
  or (p_payload->'episode' <> 'null'::jsonb and (jsonb_typeof(p_payload->'episode') <> 'number' or p_payload->>'episode' !~ '^(0|[1-9][0-9]{0,6})$' or (p_payload->>'episode')::integer > 1000000))
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
end;
$$;
create function private.guard_review_draft() returns trigger
language plpgsql set search_path = '' as $$
begin
 if not exists(select 1 from public.reviews where id = new.review_id and user_id = new.user_id and deleted_at is null)
  then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
 perform private.validate_review_payload(new.payload,false);return new;
end;
$$;
create trigger review_draft_guard before insert or update on public.content_edit_drafts for each row execute function private.guard_review_draft();
create function public.create_review_draft(p_work uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_id uuid;
begin
 v_uid := private.require_current();perform private.take_rate('review_create',20,60);
 perform id from public.works where id = p_work for share;
 if not private.work_public(p_work) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 select id into v_id from public.reviews where user_id = v_uid and work_id = p_work and deleted_at is null;
 if v_id is not null then return v_id; end if;
 insert into public.reviews(user_id,work_id) values(v_uid,p_work) returning id into v_id;
 insert into public.content_edit_drafts(user_id,review_id) values(v_uid,v_id);return v_id;
end;
$$;
create function public.save_review_draft(p_id uuid,p_version bigint,p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_review public.reviews; v_version bigint;
begin
 v_uid := private.require_current();perform private.take_rate('review_save',60,60);
 select * into v_review from public.reviews where id = p_id and user_id = v_uid and deleted_at is null for update;
 if v_review.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 if not private.work_public(v_review.work_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 perform private.validate_review_payload(p_payload,false);
 select version into v_version from public.content_edit_drafts where review_id = p_id and user_id = v_uid for update;
 if p_version is null or p_version is distinct from v_version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 update public.content_edit_drafts set payload = p_payload,version = version + 1,updated_at = now() where review_id = p_id and user_id = v_uid;
 -- Deliberately do not update reviews.body, updated_at, or version here.
end;
$$;
create function public.publish_review(p_id uuid,p_draft_version bigint,p_review_version bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_review public.reviews; v_draft public.content_edit_drafts;
begin
 v_uid := private.require_current();perform private.take_rate('review_publish',10,60);
 select * into v_review from public.reviews where id = p_id and user_id = v_uid and deleted_at is null for update;
 if v_review.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 perform id from public.works where id = v_review.work_id for share;
 if not private.work_public(v_review.work_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 if v_review.moderation_status = 'hidden' then raise exception 'MODERATION_HIDDEN' using errcode = 'P0001'; end if;
 select * into v_draft from public.content_edit_drafts where review_id = p_id and user_id = v_uid for update;
 if p_review_version is distinct from v_review.version or p_draft_version is null or p_draft_version is distinct from v_draft.version
  then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 perform private.validate_review_payload(v_draft.payload,true);
 update public.reviews set body = v_draft.payload->>'body',is_spoiler = (v_draft.payload->>'isSpoiler')::boolean,
  read_upto_episode = (v_draft.payload->>'episode')::integer,publication_status = 'published',
  published_at = coalesce(published_at,now()),version = version + 1,updated_at = now() where id = p_id;
end;
$$;
create function public.withdraw_review(p_id uuid,p_version bigint,p_delete boolean,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_review public.reviews;
begin
 v_uid := private.require_current();perform private.take_rate('review_withdraw',20,60);
 if p_delete is null or p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001'; end if;
 select * into v_review from public.reviews where id = p_id and user_id = v_uid and deleted_at is null for update;
 if v_review.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 if p_version is distinct from v_review.version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 if p_delete then
  delete from public.content_edit_drafts where review_id = p_id;
  update public.reviews set body = '',is_spoiler = false,read_upto_episode = null,publication_status = 'draft',deleted_at = now(),version = version + 1,updated_at = now() where id = p_id;
 else update public.reviews set publication_status = 'draft',version = version + 1,updated_at = now() where id = p_id;end if;
end;
$$;
create function private.review_public(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from public.reviews where id = p_id and deleted_at is null and publication_status = 'published'
  and moderation_status = 'visible' and private.work_public(work_id) and private.profile_visible(user_id));
$$;
create function private.review_card(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',r.id,'workId',r.work_id,'workTitle',w.title,'workSlug',w.slug,'authorId',r.user_id,
  'username',p.username,'name',p.display_name,'avatar',p.avatar_path,'isSpoiler',r.is_spoiler,'episode',r.read_upto_episode,
  'excerpt',case when r.is_spoiler then null else left(r.body,240) end,'version',r.version,'publishedAt',r.published_at,'updatedAt',r.updated_at,
  'ratingSteps',case when e.visibility = 'public' then e.rating_steps else null end,
  'canonicalTier',case when e.visibility = 'public' then e.canonical_tier else null end)
 from public.reviews r join public.works w on w.id = r.work_id join public.profiles p on p.id = r.user_id
 left join public.user_evaluations e on e.user_id = r.user_id and e.work_id = r.work_id where r.id = p_id and private.review_public(r.id);
$$;
create function public.get_review(p_id uuid,p_reveal boolean,p_expected_version bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_review public.reviews;v_card jsonb;
begin
 v_card := private.review_card(p_id);if v_card is null then return null;end if;
 select * into v_review from public.reviews where id = p_id;
 if p_reveal is true and p_expected_version is distinct from v_review.version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 return v_card || jsonb_build_object('body',case when not v_review.is_spoiler or p_reveal is true then v_review.body else null end);
end;
$$;
create function public.list_reviews(p_work uuid,p_username text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid;v_total integer;v_items jsonb;
begin
 if (p_work is null) = (p_username is null) or p_page is null or p_page not between 1 and 1000
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if p_work is not null and not private.work_public(p_work) then return null;end if;
 if p_username is not null then
  if p_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  select id into v_uid from public.profiles where username = p_username and private.profile_visible(id);
  if v_uid is null then return null;end if;
 end if;
 with visible as (select r.id,r.published_at from public.reviews r where (p_work is null or r.work_id = p_work) and (v_uid is null or r.user_id = v_uid) and private.review_public(r.id)),
 page as (select *,row_number() over(order by published_at desc,id) as position from visible)
 select (select count(*) from visible),coalesce((select jsonb_agg(private.review_card(id) order by position) from page where position > (p_page - 1)*12 and position <= p_page*12),'[]') into v_total,v_items;
 return jsonb_build_object('items',v_items,'total',v_total,'hasNext',v_total > p_page*12 and p_page < 1000);
end;
$$;
create function public.get_my_review_editor(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := private.require_current();
 return (select jsonb_build_object('id',r.id,'workId',r.work_id,'work',case when private.work_public(r.work_id) then private.work_card(r.work_id) else null end,
  'reviewVersion',r.version,'publicationStatus',r.publication_status,'moderationStatus',r.moderation_status,'publishedAt',r.published_at,'updatedAt',r.updated_at,
  'publishedBody',r.body,'publishedSpoiler',r.is_spoiler,'publishedEpisode',r.read_upto_episode,
  'draftVersion',d.version,'draft',d.payload,'draftUpdatedAt',d.updated_at)
  from public.reviews r join public.content_edit_drafts d on d.review_id = r.id and d.user_id = r.user_id where r.id = p_id and r.user_id = v_uid and r.deleted_at is null);
end;
$$;
create function public.list_my_reviews(p_page integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_total integer;v_items jsonb;
begin
 v_uid := private.require_current();if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 with own as (select r.id,r.updated_at from public.reviews r where r.user_id = v_uid and r.deleted_at is null),
 page as (select *,row_number() over(order by updated_at desc,id) as position from own)
 select (select count(*) from own),coalesce((select jsonb_agg(public.get_my_review_editor(id) order by position) from page where position > (p_page - 1)*12 and position <= p_page*12),'[]') into v_total,v_items;
 return jsonb_build_object('items',v_items,'total',v_total,'hasNext',v_total > p_page*12 and p_page < 1000);
end;
$$;

create table public.reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(id) on delete cascade,
 review_id uuid not null references public.reviews(id),reason text not null check(reason in ('spoiler','piracy','personal_information','harassment','spam','other')),
 detail text not null check(char_length(private.review_text_trim(detail)) between 10 and 2000),status text not null default 'pending' check(status in ('pending','resolved','rejected')),
 result_note text not null default '' check(char_length(result_note) <= 500),created_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index reports_pending_unique_idx on public.reports(reporter_id,review_id) where status = 'pending';
create index reports_queue_idx on public.reports(status,created_at,id);
create index reports_review_idx on public.reports(review_id);
alter table public.reports enable row level security;
revoke all on public.reports from public,anon,authenticated;
grant select on public.reports to authenticated;
create policy reports_own_read on public.reports for select to authenticated using(reporter_id = (select auth.uid()) and (select private.current_active()));
create table private.review_moderation_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id) on delete set null,review_id uuid references public.reviews(id) on delete set null,
 report_id uuid references public.reports(id) on delete set null,action text not null,reason text not null check(char_length(private.review_text_trim(reason)) between 2 and 1000),
 created_at timestamptz not null default now()
);
create index review_moderation_events_review_idx on private.review_moderation_events(review_id,created_at);
alter table private.review_moderation_events enable row level security;
revoke all on private.review_moderation_events from public,anon,authenticated;
create function public.report_review(p_review uuid,p_reason text,p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := private.require_current();perform private.take_rate('review_report',5,60);
 if p_reason is null or p_reason not in ('spoiler','piracy','personal_information','harassment','spam','other') or p_detail is null or char_length(private.review_text_trim(p_detail)) not between 10 and 2000
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 perform id from public.reviews where id = p_review for share;
 if not private.review_public(p_review) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if exists(select 1 from public.reviews where id = p_review and user_id = v_uid) then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 insert into public.reports(reporter_id,review_id,reason,detail) values(v_uid,p_review,p_reason,private.review_text_trim(p_detail)) on conflict(reporter_id,review_id) where status = 'pending' do nothing;
end;
$$;
create function private.review_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
 select private.current_active() and exists(select 1 from private.user_access where user_id = auth.uid() and role in ('moderator','admin'));
$$;
create function private.require_review_moderator() returns void
language plpgsql set search_path = '' as $$
begin
 perform private.require_current();if not private.review_moderator() then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
end;
$$;
create function public.get_my_review_moderator_role() returns boolean
language sql stable security definer set search_path = '' as $$select private.review_moderator();$$;
create function public.moderation_review_snapshot(p_id uuid,p_reveal boolean,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_review public.reviews;
begin
 perform private.require_review_moderator();select * into v_review from public.reviews where id = p_id;
 if v_review.id is null then return null;end if;
 if p_reveal is true and p_expected_version is distinct from v_review.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return jsonb_build_object('id',v_review.id,'version',v_review.version,'publicationStatus',v_review.publication_status,'moderationStatus',v_review.moderation_status,
  'deleted',v_review.deleted_at is not null,'isSpoiler',v_review.is_spoiler,
  'body',case when p_reveal is true and v_review.deleted_at is null and v_review.publication_status = 'published' and private.work_public(v_review.work_id) then v_review.body else null end,
  'reports',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from (select id,reason,detail,status,result_note,created_at from public.reports where review_id = p_id order by created_at desc limit 50) q),'[]'),
  'events',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (select action,reason,created_at from private.review_moderation_events where review_id = p_id order by created_at desc limit 50) q),'[]'));
 -- No private editing payload, progress note, account credential, or reporter ID.
end;
$$;
create function public.list_review_reports(p_page integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_review_moderator();if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,review_id,reason,detail,status,created_at from public.reports where status = 'pending' order by created_at,id limit 20 offset (p_page - 1)*20) q),'[]'),
  'hasNext',(select count(*) > p_page*20 from public.reports where status = 'pending') and p_page < 1000);
end;
$$;
create function public.moderate_review(p_review uuid,p_version bigint,p_action text,p_reason text,p_report uuid,p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_review public.reviews;v_report public.reports;
begin
 perform private.require_review_moderator();perform private.take_rate('review_moderate',30,60);
 if p_action is null or p_action not in ('hide','restore','reject_report') or p_reason is null or char_length(private.review_text_trim(p_reason)) not between 2 and 1000
  or p_result is null or char_length(p_result) > 500 or (p_action = 'reject_report' and p_report is null)
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_review from public.reviews where id = p_review for update;
 if v_review.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_review.version is distinct from p_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_report is not null then
  select * into v_report from public.reports where id = p_report and review_id = p_review for update;
  if v_report.id is null or v_report.status <> 'pending' then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  if char_length(private.review_text_trim(p_result)) < 2 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 end if;
 if p_action <> 'reject_report' then
  if v_review.deleted_at is not null or v_review.publication_status <> 'published' then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
  if p_action = 'restore' and (not private.work_public(v_review.work_id) or not private.author_active(v_review.user_id)) then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
  update public.reviews set moderation_status = case when p_action = 'hide' then 'hidden'::public.moderation_status else 'visible'::public.moderation_status end,
   version = version + 1,updated_at = now() where id = p_review;
 end if;
 if p_report is not null then update public.reports set status = case when p_action = 'reject_report' then 'rejected' else 'resolved' end,result_note = private.review_text_trim(p_result),resolved_at = now() where id = p_report;end if;
 insert into private.review_moderation_events(actor_id,review_id,report_id,action,reason) values(auth.uid(),p_review,p_report,p_action,private.review_text_trim(p_reason));
end;
$$;

revoke execute on function private.users_can_interact(uuid),private.author_active(uuid),private.review_public(uuid),private.review_card(uuid),private.validate_review_payload(jsonb,boolean),
 private.guard_review_draft(),private.review_text_trim(text),private.review_moderator(),private.require_review_moderator() from public,anon,authenticated;
-- profile_visible/current_active retain their existing grants and now include blocks.
revoke execute on function public.set_user_block(uuid,boolean),public.get_my_blocks(),public.create_review_draft(uuid),public.save_review_draft(uuid,bigint,jsonb),
 public.publish_review(uuid,bigint,bigint),public.withdraw_review(uuid,bigint,boolean,boolean),public.get_my_review_editor(uuid),public.list_my_reviews(integer),
 public.get_review(uuid,boolean,bigint),public.list_reviews(uuid,text,integer),public.report_review(uuid,text,text),public.get_my_review_moderator_role(),
 public.moderation_review_snapshot(uuid,boolean,bigint),public.list_review_reports(integer),public.moderate_review(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.set_user_block(uuid,boolean),public.get_my_blocks(),public.create_review_draft(uuid),public.save_review_draft(uuid,bigint,jsonb),
 public.publish_review(uuid,bigint,bigint),public.withdraw_review(uuid,bigint,boolean,boolean),public.get_my_review_editor(uuid),public.list_my_reviews(integer),
 public.report_review(uuid,text,text),public.get_my_review_moderator_role(),public.moderation_review_snapshot(uuid,boolean,bigint),public.list_review_reports(integer),public.moderate_review(uuid,bigint,text,text,uuid,text) to authenticated;
grant execute on function public.get_review(uuid,boolean,bigint),public.list_reviews(uuid,text,integer) to anon,authenticated;
