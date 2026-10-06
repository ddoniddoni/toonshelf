-- TIER-10 / OPS-01,04 / SOC-06 first comment target. File only; not applied.
-- Review/post FKs and num_nonnulls are added when those target RPCs exist.
create table public.comments (
 id uuid primary key,user_id uuid references public.profiles(id) on delete set null,
 tier_list_id uuid not null references public.tier_lists(id) on delete cascade,parent_id uuid,
 body text,is_spoiler boolean not null default true,moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden')),
 deleted_at timestamptz,version bigint not null default 1 check(version between 1 and 9007199254740991),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,tier_list_id),foreign key(parent_id,tier_list_id) references public.comments(id,tier_list_id) on delete cascade,
 check(parent_id is distinct from id),
 check((deleted_at is not null and body is null) or (deleted_at is null and user_id is not null and body is not null
  and char_length(private.review_text_trim(body)) between 1 and 1000 and octet_length(body) <= 4000))
);
create index comments_tier_roots_idx on public.comments(tier_list_id,created_at desc,id) where parent_id is null;
create index comments_replies_idx on public.comments(tier_list_id,parent_id,created_at,id) where parent_id is not null;
create index comments_author_idx on public.comments(user_id,id) where user_id is not null;
alter table public.comments enable row level security;
revoke all on public.comments from public,anon,authenticated;

create function private.guard_tier_comment() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_op = 'UPDATE' then
  if new.id is distinct from old.id or new.tier_list_id is distinct from old.tier_list_id or new.parent_id is distinct from old.parent_id
   or (new.user_id is distinct from old.user_id and new.user_id is not null) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  -- FK anonymization scrubs text as well as identity, preserving reply context.
  if new.user_id is null and old.user_id is not null then
   new.body := null;new.deleted_at := coalesce(old.deleted_at,clock_timestamp());new.version := old.version+1;new.updated_at := clock_timestamp();
  end if;
 end if;
 if new.parent_id is not null and not exists(select 1 from public.comments p
  where p.id = new.parent_id and p.tier_list_id = new.tier_list_id and p.parent_id is null) then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 return new;
end;$$;
create trigger comments_guard before insert or update on public.comments for each row execute function private.guard_tier_comment();

-- Blocks preserve comments but hide the whole root thread if its author is
-- unavailable. Deleted roots are non-identifying tombstones; no new replies.
create function private.tier_comment_context(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from public.comments c join public.tier_lists l on l.id = c.tier_list_id
  where c.id = p_id and c.moderation_status = 'visible' and private.tier_accessible(l.id,null)
   and (c.user_id is null or (private.author_active(c.user_id) and private.users_can_interact(c.user_id)
    and not exists(select 1 from public.blocks b where (b.blocker_id = c.user_id and b.blocked_id = l.user_id)
     or (b.blocker_id = l.user_id and b.blocked_id = c.user_id)))));
$$;
create function private.tier_comment_accessible(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from public.comments c where c.id = p_id and private.tier_comment_context(c.id)
  and (c.parent_id is null or private.tier_comment_context(c.parent_id)));
$$;
create function private.tier_comment_dto(p_id uuid,p_reveal boolean) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',c.id,'tierId',c.tier_list_id,'parentId',c.parent_id,'version',c.version,
  'createdAt',c.created_at,'updatedAt',c.updated_at,'deleted',c.deleted_at is not null,
  'isSpoiler',p.is_spoiler or c.is_spoiler or coalesce(root.is_spoiler,false),
  'body',case when c.deleted_at is null and (p_reveal or not(p.is_spoiler or c.is_spoiler or coalesce(root.is_spoiler,false))) then c.body else null end,
  'author',case when c.deleted_at is null then jsonb_build_object('id',a.id,'username',a.username,'name',a.display_name) else null end,
  'canEdit',c.deleted_at is null and c.user_id = auth.uid() and private.current_active(),
  'canReport',c.deleted_at is null and c.user_id <> auth.uid() and private.current_active(),
  'canReply',c.parent_id is null and c.deleted_at is null and private.current_active(),
  'replyCount',case when c.parent_id is null then (select count(*) from public.comments r where r.parent_id = c.id and private.tier_comment_accessible(r.id)) else 0 end)
 from public.comments c join public.tier_lists l on l.id = c.tier_list_id
 join public.tier_list_publications p on p.tier_list_id = l.id and p.version = l.published_version
 left join public.comments root on root.id = c.parent_id left join public.profiles a on a.id = c.user_id
 where c.id = p_id and private.tier_comment_accessible(c.id);
$$;
create function public.list_tier_comments(p_tier uuid,p_tier_version bigint,p_parent uuid default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_version bigint;v_result jsonb;
begin
 if p_tier is null or p_tier_version is null or p_tier_version not between 1 and 9007199254740991 or p_page is null or p_page not between 1 and 1000 then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select version into v_version from public.tier_lists where id = p_tier and private.tier_accessible(id,null);
 if not found then return null;end if;
 if v_version <> p_tier_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_parent is not null and not exists(select 1 from public.comments where id = p_parent and tier_list_id = p_tier
  and parent_id is null and private.tier_comment_accessible(id)) then return null;end if;
 with page as materialized (
  select c.id,c.created_at from public.comments c where c.tier_list_id = p_tier and c.parent_id is not distinct from p_parent and private.tier_comment_accessible(c.id)
  order by case when p_parent is null then c.created_at end desc,case when p_parent is not null then c.created_at end,c.id limit 21 offset (p_page-1)*20
 ), numbered as (select *,row_number() over(order by case when p_parent is null then created_at end desc,case when p_parent is not null then created_at end,id) n from page)
 select jsonb_build_object('tierId',p_tier,'tierVersion',v_version,'parentId',p_parent,
  'items',coalesce(jsonb_agg(private.tier_comment_dto(id,false) order by n) filter(where n <= 20),'[]'),'hasNext',count(*) > 20) into v_result from numbered;
 return v_result;
end;$$;
create function public.get_tier_comment(p_id uuid,p_tier_version bigint,p_version bigint default null,p_reveal boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.comments;v_version bigint;
begin
 if p_id is null or p_reveal is null or p_tier_version is null or p_tier_version not between 1 and 9007199254740991
  or (p_reveal and p_version is null) or (p_version is not null and p_version not between 1 and 9007199254740991) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.comments where id = p_id and private.tier_comment_accessible(id);if not found then return null;end if;
 select version into v_version from public.tier_lists where id = v_comment.tier_list_id;
 if v_version <> p_tier_version or (p_version is not null and p_version <> v_comment.version) then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return private.tier_comment_dto(p_id,p_reveal);
end;$$;

-- Current-user access -> sorted interaction pairs -> tier -> root -> comment.
-- Blocks share the pair mutex. Tier SHARE serializes privacy/delete/moderation.
create function private.lock_tier_comment(p_id uuid,p_tier_version bigint) returns public.comments
language plpgsql set search_path = '' as $$
declare v_comment public.comments;v_tier public.tier_lists;v_other uuid;
begin
 if p_id is null or p_tier_version is null or p_tier_version not between 1 and 9007199254740991 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.comments where id = p_id;if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 select * into v_tier from public.tier_lists where id = v_comment.tier_list_id;
 for v_other in select distinct u from (values(v_tier.user_id),(v_comment.user_id),((select user_id from public.comments where id = v_comment.parent_id))) t(u)
  where u is not null and u <> auth.uid() order by u loop perform private.lock_interaction_pair(auth.uid(),v_other);end loop;
 select * into v_tier from public.tier_lists where id = v_comment.tier_list_id and private.tier_accessible(id,null) for share;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_tier_version is distinct from v_tier.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if v_comment.parent_id is not null then perform id from public.comments where id = v_comment.parent_id for share;end if;
 select * into v_comment from public.comments where id = p_id for update;
 if not found or not private.tier_comment_accessible(p_id) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 return v_comment;
end;$$;
create function public.create_tier_comment(p_id uuid,p_tier uuid,p_tier_version bigint,p_parent uuid,p_body text,p_spoiler boolean,p_confirm boolean) returns uuid
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;v_author uuid;v_parent public.comments;v_old public.comments;v_version bigint;v_other uuid;
begin
 v_uid := private.require_current();perform private.take_rate('comment_create',30,300);
 if p_id is null or p_tier is null or p_tier_version is null or p_tier_version not between 1 and 9007199254740991 or p_spoiler is null or p_confirm is distinct from true or p_body is null
  or char_length(private.review_text_trim(p_body)) not between 1 and 1000 or octet_length(p_body) > 4000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select user_id into v_author from public.tier_lists where id = p_tier and private.tier_accessible(id,null);
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_parent is not null then select * into v_parent from public.comments where id = p_parent and tier_list_id = p_tier and parent_id is null;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;end if;
 for v_other in select distinct u from (values(v_author),(v_parent.user_id)) t(u) where u is not null and u <> v_uid order by u
  loop perform private.lock_interaction_pair(v_uid,v_other);end loop;
 select version into v_version from public.tier_lists where id = p_tier and private.tier_accessible(id,null) for share;
 if not found or not private.tier_accessible(p_tier,null) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_tier_version is distinct from v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_parent is not null then
  select * into v_parent from public.comments where id = p_parent and tier_list_id = p_tier and parent_id is null for share;
  if not found or v_parent.deleted_at is not null or not private.tier_comment_accessible(p_parent) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 end if;
 insert into public.comments(id,user_id,tier_list_id,parent_id,body,is_spoiler)
 values(p_id,v_uid,p_tier,p_parent,private.review_text_trim(p_body),p_spoiler) on conflict(id) do nothing;
 -- Caller-generated request ID prevents duplicate comments after lost replies.
 select * into v_old from public.comments where id = p_id;
 if v_old.user_id is distinct from v_uid or v_old.tier_list_id is distinct from p_tier or v_old.parent_id is distinct from p_parent
  or v_old.body is distinct from private.review_text_trim(p_body) or v_old.is_spoiler is distinct from p_spoiler or v_old.deleted_at is not null
  or v_old.moderation_status <> 'visible' then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return p_id;
end;$$;
create function public.get_my_tier_comment(p_id uuid,p_tier_version bigint,p_version bigint) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.comments;
begin
 if p_version is null or p_version not between 1 and 9007199254740991 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 perform private.require_current();v_comment := private.lock_tier_comment(p_id,p_tier_version);
 if v_comment.user_id is distinct from auth.uid() or v_comment.deleted_at is not null then return null;end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return jsonb_build_object('id',v_comment.id,'version',v_comment.version,'body',v_comment.body,'isSpoiler',v_comment.is_spoiler);
end;$$;
create function public.update_tier_comment(p_id uuid,p_tier_version bigint,p_version bigint,p_body text,p_spoiler boolean,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.comments;
begin
 perform private.require_current();perform private.take_rate('comment_edit',30,300);
 if p_version is null or p_version not between 1 and 9007199254740991 or p_confirm is distinct from true or p_spoiler is null or p_body is null or char_length(private.review_text_trim(p_body)) not between 1 and 1000
  or octet_length(p_body) > 4000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 v_comment := private.lock_tier_comment(p_id,p_tier_version);
 if v_comment.user_id is distinct from auth.uid() or v_comment.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 update public.comments set body = private.review_text_trim(p_body),is_spoiler = p_spoiler,version = version+1,updated_at = clock_timestamp() where id = p_id;
end;$$;
create function public.delete_tier_comment(p_id uuid,p_version bigint,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.comments;
begin
 perform private.require_current();perform private.take_rate('comment_delete',30,300);
 if p_id is null or p_version is null or p_version not between 1 and 9007199254740991 or p_confirm is distinct from true then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.comments where id = p_id and user_id = auth.uid();if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 -- Own text removal remains possible even if the tier/thread became hidden.
 -- This returns no target metadata or body and grants no discussion read.
 perform id from public.tier_lists where id = v_comment.tier_list_id for share;
 if v_comment.parent_id is not null then perform id from public.comments where id = v_comment.parent_id for share;end if;
 select * into v_comment from public.comments where id = p_id and user_id = auth.uid() for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if v_comment.deleted_at is not null then return;end if;
 update public.comments set body = null,deleted_at = clock_timestamp(),version = version+1,updated_at = clock_timestamp() where id = p_id;
end;$$;

create table private.comment_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(id) on delete cascade,
 comment_id uuid not null references public.comments(id),reason text not null check(reason in ('spoiler','piracy','personal_information','harassment','spam','other')),
 detail text not null check(char_length(private.review_text_trim(detail)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','resolved','rejected')),result_note text not null default '' check(char_length(result_note) <= 500),
 created_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index comment_reports_pending_idx on private.comment_reports(reporter_id,comment_id) where status = 'pending';
create index comment_reports_owner_idx on private.comment_reports(reporter_id,created_at desc,id);
create index comment_reports_queue_idx on private.comment_reports(created_at,id) where status = 'pending';
create index comment_reports_target_idx on private.comment_reports(comment_id,created_at desc,id);
create table private.comment_moderation_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id) on delete set null,
 comment_id uuid references public.comments(id) on delete set null,report_id uuid references private.comment_reports(id) on delete set null,
 action text not null,reason text not null check(char_length(private.review_text_trim(reason)) between 2 and 1000),created_at timestamptz not null default now()
);
create index comment_moderation_target_idx on private.comment_moderation_events(comment_id,created_at desc,id);
alter table private.comment_reports enable row level security;
alter table private.comment_moderation_events enable row level security;
revoke all on private.comment_reports,private.comment_moderation_events from public,anon,authenticated;
create function private.comment_report_dto(p_report private.comment_reports) returns jsonb
language sql immutable set search_path = '' as $$
 select jsonb_build_object('id',p_report.id,'commentId',p_report.comment_id,'reason',p_report.reason,'detail',p_report.detail,
  'status',p_report.status,'result',p_report.result_note,'createdAt',p_report.created_at);
$$;
create function public.report_tier_comment(p_id uuid,p_tier_version bigint,p_version bigint,p_reason text,p_detail text) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.comments;
begin
 perform private.require_current();perform private.take_rate('comment_report',5,600);
 if p_version is null or p_version not between 1 and 9007199254740991 or p_reason is null or p_reason not in ('spoiler','piracy','personal_information','harassment','spam','other') or p_detail is null
  or char_length(private.review_text_trim(p_detail)) not between 10 and 2000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 v_comment := private.lock_tier_comment(p_id,p_tier_version);
 if v_comment.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_comment.user_id = auth.uid() then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 insert into private.comment_reports(reporter_id,comment_id,reason,detail) values(auth.uid(),p_id,p_reason,private.review_text_trim(p_detail))
 on conflict(reporter_id,comment_id) where status = 'pending' do nothing;
end;$$;
create function public.list_tier_comment_reports(p_page integer default 1,p_own boolean default false) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_result jsonb;
begin
 if p_own is null or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if p_own then perform private.require_current();else perform private.require_review_moderator();end if;
 with page as (select r,row_number() over(order by case when p_own then created_at end desc,case when not p_own then created_at end,id) n
  from private.comment_reports r where (p_own and reporter_id = auth.uid()) or (not p_own and status = 'pending')
  order by case when p_own then created_at end desc,case when not p_own then created_at end,id limit 21 offset (p_page-1)*20)
 select jsonb_build_object('items',coalesce(jsonb_agg(private.comment_report_dto(r) order by n) filter(where n <= p_page*20),'[]'),
  'hasNext',count(*) > 20) into v_result from page;return v_result;
end;$$;
create function public.moderation_tier_comment_snapshot(p_id uuid,p_version bigint default null,p_reveal boolean default false) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_result jsonb;v_comment public.comments;
begin
 perform private.require_review_moderator();
 if p_id is null or p_reveal is null or (p_reveal and p_version is null) or (p_version is not null and p_version not between 1 and 9007199254740991) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.comments where id = p_id;if not found then return null;end if;
 -- Same tier -> comment lock order as writers: privacy and version cannot
 -- change between expected-version validation and an explicit body reveal.
 perform id from public.tier_lists where id = v_comment.tier_list_id for share;
 select * into v_comment from public.comments where id = p_id for share;if not found then return null;end if;
 if p_version is not null and p_version <> v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 select jsonb_build_object('id',c.id,'version',c.version,'tierId',l.id,'deleted',c.deleted_at is not null,
  'moderationStatus',c.moderation_status,'canModerate',c.deleted_at is null and l.deleted_at is null and l.visibility = 'public' and l.published_version is not null,
  'body',case when p_reveal and c.deleted_at is null and l.deleted_at is null and l.visibility = 'public' and l.published_version is not null then c.body else null end,
  'reports',coalesce((select jsonb_agg(private.comment_report_dto(r) order by r.created_at desc,r.id) from
   (select * from private.comment_reports where comment_id = p_id order by created_at desc,id limit 50) r),'[]'),
  'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'reason',e.reason,'createdAt',e.created_at) order by e.created_at desc,e.id) from
   (select * from private.comment_moderation_events where comment_id = p_id order by created_at desc,id limit 50) e),'[]')) into v_result
 from public.comments c join public.tier_lists l on l.id = c.tier_list_id where c.id = p_id;
 return v_result;
end;$$;
create function public.moderate_tier_comment(p_id uuid,p_version bigint,p_action text,p_reason text,p_report uuid,p_result text) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.comments;v_tier public.tier_lists;
begin
 perform private.require_review_moderator();perform private.take_rate('comment_moderate',30,60);
 if p_id is null or p_version is null or p_version not between 1 and 9007199254740991 or p_action is null or p_action not in ('hide','restore','reject_report') or p_reason is null or char_length(private.review_text_trim(p_reason)) not between 2 and 1000
  or p_result is null or char_length(private.review_text_trim(p_result)) > 500 or (p_report is not null and char_length(private.review_text_trim(p_result)) < 2)
  or (p_action = 'reject_report' and p_report is null) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.comments where id = p_id;if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 select * into v_tier from public.tier_lists where id = v_comment.tier_list_id for share;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_comment.parent_id is not null then perform id from public.comments where id = v_comment.parent_id for share;end if;
 select * into v_comment from public.comments where id = p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_action <> 'reject_report' and (v_comment.deleted_at is not null or v_tier.deleted_at is not null or v_tier.visibility <> 'public' or v_tier.published_version is null) then
  raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 if p_report is not null then
  perform id from private.comment_reports where id = p_report and comment_id = p_id and status = 'pending' for update;
  if not found then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  update private.comment_reports set status = case when p_action = 'reject_report' then 'rejected' else 'resolved' end,
   result_note = private.review_text_trim(p_result),resolved_at = clock_timestamp() where id = p_report;
 end if;
 update public.comments set moderation_status = case when p_action = 'hide' then 'hidden' when p_action = 'restore' then 'visible' else moderation_status end,
  version = version+1,updated_at = clock_timestamp() where id = p_id;
 insert into private.comment_moderation_events(actor_id,comment_id,report_id,action,reason) values(auth.uid(),p_id,p_report,p_action,private.review_text_trim(p_reason));
end;$$;

revoke all on function private.guard_tier_comment(),private.tier_comment_context(uuid),private.tier_comment_accessible(uuid),private.tier_comment_dto(uuid,boolean),
 private.lock_tier_comment(uuid,bigint),private.comment_report_dto(private.comment_reports) from public,anon,authenticated;
revoke all on function public.list_tier_comments(uuid,bigint,uuid,integer),public.get_tier_comment(uuid,bigint,bigint,boolean),
 public.create_tier_comment(uuid,uuid,bigint,uuid,text,boolean,boolean),public.get_my_tier_comment(uuid,bigint,bigint),
 public.update_tier_comment(uuid,bigint,bigint,text,boolean,boolean),public.delete_tier_comment(uuid,bigint,boolean),
 public.report_tier_comment(uuid,bigint,bigint,text,text),public.list_tier_comment_reports(integer,boolean),
 public.moderation_tier_comment_snapshot(uuid,bigint,boolean),public.moderate_tier_comment(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.list_tier_comments(uuid,bigint,uuid,integer),public.get_tier_comment(uuid,bigint,bigint,boolean) to anon,authenticated;
grant execute on function public.create_tier_comment(uuid,uuid,bigint,uuid,text,boolean,boolean),public.get_my_tier_comment(uuid,bigint,bigint),
 public.update_tier_comment(uuid,bigint,bigint,text,boolean,boolean),public.delete_tier_comment(uuid,bigint,boolean),
 public.report_tier_comment(uuid,bigint,bigint,text,text),public.list_tier_comment_reports(integer,boolean),
 public.moderation_tier_comment_snapshot(uuid,bigint,boolean),public.moderate_tier_comment(uuid,bigint,text,text,uuid,text) to authenticated;
