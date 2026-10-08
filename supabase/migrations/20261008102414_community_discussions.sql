-- COM-03/04, SOC-04/05/06, OPS-01/02/04. Shared project, additive only.
-- Requires 20261008090225_community_posts.sql first. Both await MCP reconnection.
-- Post-specific tables preserve the installed tier comment/reaction contracts.
begin;
set local lock_timeout = '3s';

create table public.toon_post_comments (
 id uuid primary key,user_id uuid references public.toon_profiles(id) on delete set null,
 post_id uuid not null references public.toon_posts(id) on delete cascade,parent_id uuid,
 body text,is_spoiler boolean not null default true,moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden')),
 deleted_at timestamptz,version bigint not null default 1 check(version between 1 and 9007199254740991),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,post_id),foreign key(parent_id,post_id) references public.toon_post_comments(id,post_id) on delete cascade,
 check(parent_id is distinct from id),
 check((deleted_at is not null and body is null) or (deleted_at is null and user_id is not null and body is not null
  and char_length(toon_private.toon_review_text_trim(body)) between 1 and 1000 and octet_length(body) <= 4000))
);
create index toon_post_comments_post_roots_idx on public.toon_post_comments(post_id,created_at desc,id) where parent_id is null;
create index toon_post_comments_replies_idx on public.toon_post_comments(post_id,parent_id,created_at,id) where parent_id is not null;
create index toon_post_comments_author_idx on public.toon_post_comments(user_id,id) where user_id is not null;
alter table public.toon_post_comments enable row level security;
revoke all on public.toon_post_comments from public,anon,authenticated,service_role;

create function toon_private.toon_guard_post_comment() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_op = 'UPDATE' then
  if new.id is distinct from old.id or new.post_id is distinct from old.post_id or new.parent_id is distinct from old.parent_id
   or (new.user_id is distinct from old.user_id and new.user_id is not null) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  -- FK anonymization scrubs text as well as identity, preserving reply context.
  if new.user_id is null and old.user_id is not null then
   new.body := null;new.deleted_at := coalesce(old.deleted_at,clock_timestamp());new.version := old.version+1;new.updated_at := clock_timestamp();
  end if;
 end if;
 if new.parent_id is not null and not exists(select 1 from public.toon_post_comments p
  where p.id = new.parent_id and p.post_id = new.post_id and p.parent_id is null) then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 return new;
end;$$;
create trigger post_comments_guard before insert or update on public.toon_post_comments for each row execute function toon_private.toon_guard_post_comment();

-- Blocks preserve comments but hide the whole root thread if its author is
-- unavailable. Deleted roots are non-identifying tombstones; no new replies.
create function toon_private.toon_post_comment_context(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from public.toon_post_comments c join public.toon_posts l on l.id = c.post_id
  where c.id = p_id and c.moderation_status = 'visible' and toon_private.toon_post_public(l.id)
   and (c.user_id is null or (toon_private.toon_author_active(c.user_id) and toon_private.toon_users_can_interact(c.user_id)
    and not exists(select 1 from public.toon_blocks b where (b.blocker_id = c.user_id and b.blocked_id = l.user_id)
     or (b.blocker_id = l.user_id and b.blocked_id = c.user_id)))));
$$;
create function toon_private.toon_post_comment_accessible(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from public.toon_post_comments c where c.id = p_id and toon_private.toon_post_comment_context(c.id)
  and (c.parent_id is null or toon_private.toon_post_comment_context(c.parent_id)));
$$;
create function toon_private.toon_post_comment_dto(p_id uuid,p_reveal boolean) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',c.id,'postId',c.post_id,'parentId',c.parent_id,'version',c.version,
  'createdAt',c.created_at,'updatedAt',c.updated_at,'deleted',c.deleted_at is not null,
  'isSpoiler',l.is_spoiler or c.is_spoiler or coalesce(root.is_spoiler,false),
  'body',case when c.deleted_at is null and (p_reveal or not(l.is_spoiler or c.is_spoiler or coalesce(root.is_spoiler,false))) then c.body else null end,
  'author',case when c.deleted_at is null then jsonb_build_object('id',a.id,'username',a.username,'name',a.display_name) else null end,
  'canEdit',c.deleted_at is null and c.user_id = auth.uid() and toon_private.toon_current_active(),
  'canReport',c.deleted_at is null and c.user_id <> auth.uid() and toon_private.toon_current_active(),
  'canReply',c.parent_id is null and c.deleted_at is null and toon_private.toon_current_active(),
  'replyCount',case when c.parent_id is null then (select count(*) from public.toon_post_comments r where r.parent_id = c.id and toon_private.toon_post_comment_accessible(r.id)) else 0 end)
 from public.toon_post_comments c join public.toon_posts l on l.id = c.post_id
 left join public.toon_post_comments root on root.id = c.parent_id left join public.toon_profiles a on a.id = c.user_id
 where c.id = p_id and toon_private.toon_post_comment_accessible(c.id);
$$;
create function public.toon_list_post_comments(p_post uuid,p_post_version bigint,p_parent uuid default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_version bigint;v_result jsonb;
begin
 if p_post is null or p_post_version is null or p_post_version not between 1 and 9007199254740991 or p_page is null or p_page not between 1 and 1000 then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select version into v_version from public.toon_posts where id = p_post and toon_private.toon_post_public(id);
 if not found then return null;end if;
 if v_version <> p_post_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_parent is not null and not exists(select 1 from public.toon_post_comments where id = p_parent and post_id = p_post
  and parent_id is null and toon_private.toon_post_comment_accessible(id)) then return null;end if;
 with page as materialized (
  select c.id,c.created_at from public.toon_post_comments c where c.post_id = p_post and c.parent_id is not distinct from p_parent and toon_private.toon_post_comment_accessible(c.id)
  order by case when p_parent is null then c.created_at end desc,case when p_parent is not null then c.created_at end,c.id limit 21 offset (p_page-1)*20
 ), numbered as (select *,row_number() over(order by case when p_parent is null then created_at end desc,case when p_parent is not null then created_at end,id) n from page)
 select jsonb_build_object('postId',p_post,'postVersion',v_version,'parentId',p_parent,
  'items',coalesce(jsonb_agg(toon_private.toon_post_comment_dto(id,false) order by n) filter(where n <= 20),'[]'),'hasNext',count(*) > 20) into v_result from numbered;
 return v_result;
end;$$;
create function public.toon_get_post_comment(p_id uuid,p_post_version bigint,p_version bigint default null,p_reveal boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.toon_post_comments;v_version bigint;
begin
 if p_id is null or p_reveal is null or p_post_version is null or p_post_version not between 1 and 9007199254740991
  or (p_reveal and p_version is null) or (p_version is not null and p_version not between 1 and 9007199254740991) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.toon_post_comments where id = p_id and toon_private.toon_post_comment_accessible(id);if not found then return null;end if;
 select version into v_version from public.toon_posts where id = v_comment.post_id;
 if v_version <> p_post_version or (p_version is not null and p_version <> v_comment.version) then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return toon_private.toon_post_comment_dto(p_id,p_reveal);
end;$$;

-- Current-user access -> sorted interaction pairs -> post -> root -> comment.
-- Blocks share the pair mutex. Post SHARE serializes privacy/delete/moderation.
create function toon_private.toon_lock_post_comment(p_id uuid,p_post_version bigint) returns public.toon_post_comments
language plpgsql set search_path = '' as $$
declare v_comment public.toon_post_comments;v_post public.toon_posts;v_other uuid;
begin
 if p_id is null or p_post_version is null or p_post_version not between 1 and 9007199254740991 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.toon_post_comments where id = p_id;if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 select * into v_post from public.toon_posts where id = v_comment.post_id;
 for v_other in select distinct u from (values(v_post.user_id),(v_comment.user_id),((select user_id from public.toon_post_comments where id = v_comment.parent_id))) t(u)
  where u is not null and u <> auth.uid() order by u loop perform toon_private.toon_lock_interaction_pair(auth.uid(),v_other);end loop;
 select * into v_post from public.toon_posts where id = v_comment.post_id and toon_private.toon_post_public(id) for share;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_post_version is distinct from v_post.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if v_comment.parent_id is not null then perform id from public.toon_post_comments where id = v_comment.parent_id for share;end if;
 select * into v_comment from public.toon_post_comments where id = p_id for update;
 if not found or not toon_private.toon_post_comment_accessible(p_id) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 return v_comment;
end;$$;
create function public.toon_create_post_comment(p_id uuid,p_post uuid,p_post_version bigint,p_parent uuid,p_body text,p_spoiler boolean,p_confirm boolean) returns uuid
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;v_author uuid;v_parent public.toon_post_comments;v_old public.toon_post_comments;v_version bigint;v_other uuid;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('post_comment_create',30,300);
 if p_id is null or p_post is null or p_post_version is null or p_post_version not between 1 and 9007199254740991 or p_spoiler is null or p_confirm is distinct from true or p_body is null
  or char_length(toon_private.toon_review_text_trim(p_body)) not between 1 and 1000 or octet_length(p_body) > 4000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select user_id into v_author from public.toon_posts where id = p_post and toon_private.toon_post_public(id);
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_parent is not null then select * into v_parent from public.toon_post_comments where id = p_parent and post_id = p_post and parent_id is null;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;end if;
 for v_other in select distinct u from (values(v_author),(v_parent.user_id)) t(u) where u is not null and u <> v_uid order by u
  loop perform toon_private.toon_lock_interaction_pair(v_uid,v_other);end loop;
 select version into v_version from public.toon_posts where id = p_post and toon_private.toon_post_public(id) for share;
 if not found or not toon_private.toon_post_public(p_post) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_post_version is distinct from v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_parent is not null then
  select * into v_parent from public.toon_post_comments where id = p_parent and post_id = p_post and parent_id is null for share;
  if not found or v_parent.deleted_at is not null or not toon_private.toon_post_comment_accessible(p_parent) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 end if;
 insert into public.toon_post_comments(id,user_id,post_id,parent_id,body,is_spoiler)
 values(p_id,v_uid,p_post,p_parent,toon_private.toon_review_text_trim(p_body),p_spoiler) on conflict(id) do nothing;
 -- Caller-generated request ID prevents duplicate comments after lost replies.
 select * into v_old from public.toon_post_comments where id = p_id;
 if v_old.user_id is distinct from v_uid or v_old.post_id is distinct from p_post or v_old.parent_id is distinct from p_parent
  or v_old.body is distinct from toon_private.toon_review_text_trim(p_body) or v_old.is_spoiler is distinct from p_spoiler or v_old.deleted_at is not null
  or v_old.moderation_status <> 'visible' then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return p_id;
end;$$;
create function public.toon_get_my_post_comment(p_id uuid,p_post_version bigint,p_version bigint) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.toon_post_comments;
begin
 if p_version is null or p_version not between 1 and 9007199254740991 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 perform toon_private.toon_require_current();v_comment := toon_private.toon_lock_post_comment(p_id,p_post_version);
 if v_comment.user_id is distinct from auth.uid() or v_comment.deleted_at is not null then return null;end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return jsonb_build_object('id',v_comment.id,'version',v_comment.version,'body',v_comment.body,'isSpoiler',v_comment.is_spoiler);
end;$$;
create function public.toon_update_post_comment(p_id uuid,p_post_version bigint,p_version bigint,p_body text,p_spoiler boolean,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.toon_post_comments;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('post_comment_edit',30,300);
 if p_version is null or p_version not between 1 and 9007199254740991 or p_confirm is distinct from true or p_spoiler is null or p_body is null or char_length(toon_private.toon_review_text_trim(p_body)) not between 1 and 1000
  or octet_length(p_body) > 4000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 v_comment := toon_private.toon_lock_post_comment(p_id,p_post_version);
 if v_comment.user_id is distinct from auth.uid() or v_comment.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 update public.toon_post_comments set body = toon_private.toon_review_text_trim(p_body),is_spoiler = p_spoiler,version = version+1,updated_at = clock_timestamp() where id = p_id;
end;$$;
create function public.toon_delete_post_comment(p_id uuid,p_version bigint,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.toon_post_comments;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('post_comment_delete',30,300);
 if p_id is null or p_version is null or p_version not between 1 and 9007199254740991 or p_confirm is distinct from true then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.toon_post_comments where id = p_id and user_id = auth.uid();if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 -- Own text removal remains possible even if the post/thread became hidden.
 -- This returns no target metadata or body and grants no discussion read.
 perform id from public.toon_posts where id = v_comment.post_id for share;
 if v_comment.parent_id is not null then perform id from public.toon_post_comments where id = v_comment.parent_id for share;end if;
 select * into v_comment from public.toon_post_comments where id = p_id and user_id = auth.uid() for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if v_comment.deleted_at is not null then return;end if;
 update public.toon_post_comments set body = null,deleted_at = clock_timestamp(),version = version+1,updated_at = clock_timestamp() where id = p_id;
end;$$;

create table toon_private.toon_post_comment_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.toon_profiles(id) on delete cascade,
 comment_id uuid not null references public.toon_post_comments(id),reason text not null check(reason in ('spoiler','piracy','personal_information','harassment','spam','other')),
 detail text not null check(char_length(toon_private.toon_review_text_trim(detail)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','resolved','rejected')),result_note text not null default '' check(char_length(result_note) <= 500),
 created_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index toon_post_comment_reports_pending_idx on toon_private.toon_post_comment_reports(reporter_id,comment_id) where status = 'pending';
create index toon_post_comment_reports_owner_idx on toon_private.toon_post_comment_reports(reporter_id,created_at desc,id);
create index toon_post_comment_reports_queue_idx on toon_private.toon_post_comment_reports(created_at,id) where status = 'pending';
create index toon_post_comment_reports_target_idx on toon_private.toon_post_comment_reports(comment_id,created_at desc,id);
create table toon_private.toon_post_comment_moderation_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.toon_profiles(id) on delete set null,
 comment_id uuid references public.toon_post_comments(id) on delete set null,report_id uuid references toon_private.toon_post_comment_reports(id) on delete set null,
 action text not null,reason text not null check(char_length(toon_private.toon_review_text_trim(reason)) between 2 and 1000),created_at timestamptz not null default now()
);
create index toon_post_comment_moderation_target_idx on toon_private.toon_post_comment_moderation_events(comment_id,created_at desc,id);
alter table toon_private.toon_post_comment_reports enable row level security;
alter table toon_private.toon_post_comment_moderation_events enable row level security;
revoke all on toon_private.toon_post_comment_reports,toon_private.toon_post_comment_moderation_events from public,anon,authenticated,service_role;
create function toon_private.toon_post_comment_report_dto(p_report toon_private.toon_post_comment_reports) returns jsonb
language sql immutable set search_path = '' as $$
 select jsonb_build_object('id',p_report.id,'commentId',p_report.comment_id,'reason',p_report.reason,'detail',p_report.detail,
  'status',p_report.status,'result',p_report.result_note,'createdAt',p_report.created_at);
$$;
create function public.toon_report_post_comment(p_id uuid,p_post_version bigint,p_version bigint,p_reason text,p_detail text) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.toon_post_comments;
begin
 perform toon_private.toon_require_current();perform toon_private.toon_take_rate('post_comment_report',5,600);
 if p_version is null or p_version not between 1 and 9007199254740991 or p_reason is null or p_reason not in ('spoiler','piracy','personal_information','harassment','spam','other') or p_detail is null
  or char_length(toon_private.toon_review_text_trim(p_detail)) not between 10 and 2000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 v_comment := toon_private.toon_lock_post_comment(p_id,p_post_version);
 if v_comment.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_comment.user_id = auth.uid() then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 insert into toon_private.toon_post_comment_reports(reporter_id,comment_id,reason,detail) values(auth.uid(),p_id,p_reason,toon_private.toon_review_text_trim(p_detail))
 on conflict(reporter_id,comment_id) where status = 'pending' do nothing;
end;$$;
create function public.toon_list_post_comment_reports(p_page integer default 1,p_own boolean default false) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_result jsonb;
begin
 if p_own is null or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if p_own then perform toon_private.toon_require_current();else perform toon_private.toon_require_review_moderator();end if;
 with page as (select r,row_number() over(order by case when p_own then created_at end desc,case when not p_own then created_at end,id) n
  from toon_private.toon_post_comment_reports r where (p_own and reporter_id = auth.uid()) or (not p_own and status = 'pending')
  order by case when p_own then created_at end desc,case when not p_own then created_at end,id limit 21 offset (p_page-1)*20)
 select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_post_comment_report_dto(r) order by n) filter(where n <= p_page*20),'[]'),
  'hasNext',count(*) > 20) into v_result from page;return v_result;
end;$$;
create function public.toon_moderation_post_comment_snapshot(p_id uuid,p_version bigint default null,p_reveal boolean default false) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_result jsonb;v_comment public.toon_post_comments;
begin
 perform toon_private.toon_require_review_moderator();
 if p_id is null or p_reveal is null or (p_reveal and p_version is null) or (p_version is not null and p_version not between 1 and 9007199254740991) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.toon_post_comments where id = p_id;if not found then return null;end if;
 -- Same post -> comment lock order as writers: privacy and version cannot
 -- change between expected-version validation and an explicit body reveal.
 perform id from public.toon_posts where id = v_comment.post_id for share;
 select * into v_comment from public.toon_post_comments where id = p_id for share;if not found then return null;end if;
 if p_version is not null and p_version <> v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 select jsonb_build_object('id',c.id,'version',c.version,'postId',l.id,'deleted',c.deleted_at is not null,
  'moderationStatus',c.moderation_status,'canModerate',c.deleted_at is null and l.deleted_at is null and l.publication_status = 'published' and not exists(select 1 from public.toon_post_works w where w.post_id=l.id and not toon_private.toon_work_public(w.work_id)),
  'body',case when p_reveal and c.deleted_at is null and l.deleted_at is null and l.publication_status = 'published' and not exists(select 1 from public.toon_post_works w where w.post_id=l.id and not toon_private.toon_work_public(w.work_id)) then c.body else null end,
  'reports',coalesce((select jsonb_agg(toon_private.toon_post_comment_report_dto(r) order by r.created_at desc,r.id) from
   (select * from toon_private.toon_post_comment_reports where comment_id = p_id order by created_at desc,id limit 50) r),'[]'),
  'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'reason',e.reason,'createdAt',e.created_at) order by e.created_at desc,e.id) from
   (select * from toon_private.toon_post_comment_moderation_events where comment_id = p_id order by created_at desc,id limit 50) e),'[]')) into v_result
 from public.toon_post_comments c join public.toon_posts l on l.id = c.post_id where c.id = p_id;
 return v_result;
end;$$;
create function public.toon_moderate_post_comment(p_id uuid,p_version bigint,p_action text,p_reason text,p_report uuid,p_result text) returns void
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_comment public.toon_post_comments;v_post public.toon_posts;
begin
 perform toon_private.toon_require_review_moderator();perform toon_private.toon_take_rate('post_comment_moderate',30,60);
 if p_id is null or p_version is null or p_version not between 1 and 9007199254740991 or p_action is null or p_action not in ('hide','restore','reject_report') or p_reason is null or char_length(toon_private.toon_review_text_trim(p_reason)) not between 2 and 1000
  or p_result is null or char_length(toon_private.toon_review_text_trim(p_result)) > 500 or (p_report is not null and char_length(toon_private.toon_review_text_trim(p_result)) < 2)
  or (p_action = 'reject_report' and p_report is null) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_comment from public.toon_post_comments where id = p_id;if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 select * into v_post from public.toon_posts where id = v_comment.post_id for share;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_comment.parent_id is not null then perform id from public.toon_post_comments where id = v_comment.parent_id for share;end if;
 select * into v_comment from public.toon_post_comments where id = p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_comment.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_action <> 'reject_report' and (v_comment.deleted_at is not null or v_post.deleted_at is not null or v_post.publication_status <> 'published' or exists(select 1 from public.toon_post_works w where w.post_id=v_post.id and not toon_private.toon_work_public(w.work_id))) then
  raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 if p_report is not null then
  perform id from toon_private.toon_post_comment_reports where id = p_report and comment_id = p_id and status = 'pending' for update;
  if not found then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  update toon_private.toon_post_comment_reports set status = case when p_action = 'reject_report' then 'rejected' else 'resolved' end,
   result_note = toon_private.toon_review_text_trim(p_result),resolved_at = clock_timestamp() where id = p_report;
 end if;
 update public.toon_post_comments set moderation_status = case when p_action = 'hide' then 'hidden' when p_action = 'restore' then 'visible' else moderation_status end,
  version = version+1,updated_at = clock_timestamp() where id = p_id;
 insert into toon_private.toon_post_comment_moderation_events(actor_id,comment_id,report_id,action,reason) values(auth.uid(),p_id,p_report,p_action,toon_private.toon_review_text_trim(p_reason));
end;$$;

revoke all on function toon_private.toon_guard_post_comment(),toon_private.toon_post_comment_context(uuid),toon_private.toon_post_comment_accessible(uuid),toon_private.toon_post_comment_dto(uuid,boolean),
 toon_private.toon_lock_post_comment(uuid,bigint),toon_private.toon_post_comment_report_dto(toon_private.toon_post_comment_reports) from public,anon,authenticated,service_role;
revoke all on function public.toon_list_post_comments(uuid,bigint,uuid,integer),public.toon_get_post_comment(uuid,bigint,bigint,boolean),
 public.toon_create_post_comment(uuid,uuid,bigint,uuid,text,boolean,boolean),public.toon_get_my_post_comment(uuid,bigint,bigint),
 public.toon_update_post_comment(uuid,bigint,bigint,text,boolean,boolean),public.toon_delete_post_comment(uuid,bigint,boolean),
 public.toon_report_post_comment(uuid,bigint,bigint,text,text),public.toon_list_post_comment_reports(integer,boolean),
 public.toon_moderation_post_comment_snapshot(uuid,bigint,boolean),public.toon_moderate_post_comment(uuid,bigint,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.toon_list_post_comments(uuid,bigint,uuid,integer),public.toon_get_post_comment(uuid,bigint,bigint,boolean) to anon,authenticated;
grant execute on function public.toon_create_post_comment(uuid,uuid,bigint,uuid,text,boolean,boolean),public.toon_get_my_post_comment(uuid,bigint,bigint),
 public.toon_update_post_comment(uuid,bigint,bigint,text,boolean,boolean),public.toon_delete_post_comment(uuid,bigint,boolean),
 public.toon_report_post_comment(uuid,bigint,bigint,text,text),public.toon_list_post_comment_reports(integer,boolean),
 public.toon_moderation_post_comment_snapshot(uuid,bigint,boolean),public.toon_moderate_post_comment(uuid,bigint,text,text,uuid,text) to authenticated;

create table public.toon_post_reactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.toon_profiles(id) on delete cascade,
 post_id uuid not null references public.toon_posts(id) on delete cascade,
 created_at timestamptz not null default now()
);
create unique index toon_post_reactions_user_post_unique on public.toon_post_reactions(user_id,post_id) where post_id is not null;
create index toon_post_reactions_post_user_idx on public.toon_post_reactions(post_id,user_id) where post_id is not null;
alter table public.toon_post_reactions enable row level security;
revoke all on public.toon_post_reactions from public,anon,authenticated,service_role;
-- No SELECT/DML policies: no liker identities or private target enumeration.

-- Count current valid rows, never a client-editable or simulated counter. Both
-- author/reactor and viewer/reactor blocks are filtered on every read.
create function toon_private.toon_post_like_count(p_id uuid) returns bigint
language sql stable set search_path = '' as $$
 select case when toon_private.toon_post_public(p_id) then (
  select count(*) from public.toon_post_reactions r join public.toon_posts l on l.id = r.post_id
  where r.post_id = p_id and r.user_id <> l.user_id and toon_private.toon_author_active(r.user_id)
   and toon_private.toon_users_can_interact(r.user_id) and not exists(select 1 from public.toon_blocks b where
    (b.blocker_id = r.user_id and b.blocked_id = l.user_id) or (b.blocker_id = l.user_id and b.blocked_id = r.user_id))
 ) else null end;
$$;
create function toon_private.toon_post_like_state(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',l.id,'version',l.version,'likeCount',toon_private.toon_post_like_count(l.id),
  'liked',toon_private.toon_current_active() and exists(select 1 from public.toon_post_reactions r where r.post_id = l.id and r.user_id = auth.uid()),
  'canLike',toon_private.toon_current_active() and l.user_id <> auth.uid())
 from public.toon_posts l where l.id = p_id and toon_private.toon_post_public(l.id);
$$;
create function public.toon_get_post_like_state(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' set statement_timeout = '5s' as $$
 select toon_private.toon_post_like_state(p_id);
$$;
create function public.toon_set_post_like(p_id uuid,p_version bigint,p_liked boolean) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;v_author uuid;v_version bigint;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('post_like',40,60);
 if p_id is null or p_version is null or p_version not between 1 and 9007199254740991 or p_liked is null then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select user_id into v_author from public.toon_posts where id = p_id and toon_private.toon_post_public(id);
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_author = v_uid then raise exception 'SELF_REACTION' using errcode = 'P0001';end if;
 perform toon_private.toon_lock_interaction_pair(v_uid,v_author);
 select l.version into v_version from public.toon_posts l where l.id = p_id and toon_private.toon_post_public(l.id) for share;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version <> v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 -- Desired state, not toggle: duplicate requests cannot invert/increment twice.
 if p_liked then
  insert into public.toon_post_reactions(user_id,post_id) values(v_uid,p_id)
   on conflict(user_id,post_id) where post_id is not null do nothing;
 else delete from public.toon_post_reactions where user_id = v_uid and post_id = p_id;end if;
 return toon_private.toon_post_like_state(p_id);
end;$$;

-- Soft deletion already retains reports/audit; reactions are no longer useful.
create function toon_private.toon_clear_deleted_post_reactions() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.deleted_at is not null then delete from public.toon_post_reactions where post_id = new.id;end if;
 return new;
end;$$;
create trigger post_deleted_reactions after update of deleted_at on public.toon_posts
 for each row when (new.deleted_at is not null) execute function toon_private.toon_clear_deleted_post_reactions();


-- The existing block RPC already holds the actor/target pair mutex.
create function toon_private.toon_clear_blocked_post_reactions() returns trigger
language plpgsql set search_path='' as $$
begin
 delete from public.toon_post_reactions r using public.toon_posts p where r.post_id=p.id
  and ((r.user_id=new.blocker_id and p.user_id=new.blocked_id) or (r.user_id=new.blocked_id and p.user_id=new.blocker_id));
 return new;
end;$$;
create trigger block_post_reactions before insert on public.toon_blocks for each row execute function toon_private.toon_clear_blocked_post_reactions();
create index toon_post_comments_recent_idx on public.toon_post_comments(post_id,created_at desc,user_id) include(id)
 where deleted_at is null and moderation_status='visible' and user_id is not null;
create index toon_post_reactions_recent_idx on public.toon_post_reactions(post_id,created_at desc,user_id);
create function toon_private.toon_post_popularity_metrics(p_id uuid)
 returns table(like_count bigint,recent_like_count bigint,recent_commenter_count bigint,popularity_score bigint)
language sql stable set search_path='' as $$
 select likes.total,likes.recent,comments.recent,likes.recent+2*comments.recent
 from public.toon_posts p cross join lateral (
  select count(*) total,count(*) filter(where r.created_at between now()-interval '168 hours' and now()) recent
  from public.toon_post_reactions r where r.post_id=p.id and r.user_id<>p.user_id
   and toon_private.toon_author_active(r.user_id) and toon_private.toon_users_can_interact(r.user_id)
   and not exists(select 1 from public.toon_blocks b where (b.blocker_id=r.user_id and b.blocked_id=p.user_id) or (b.blocker_id=p.user_id and b.blocked_id=r.user_id))
 ) likes cross join lateral (
  select count(distinct c.user_id) recent from public.toon_post_comments c where c.post_id=p.id and c.deleted_at is null
   and c.moderation_status='visible' and c.user_id is not null and c.user_id<>p.user_id
   and c.created_at between now()-interval '168 hours' and now() and toon_private.toon_post_comment_accessible(c.id)
 ) comments where p.id=p_id and toon_private.toon_post_public(p.id);
$$;
create function toon_private.toon_post_popularity_card(p_id uuid,p_count bigint,p_recent bigint,p_commenters bigint) returns jsonb
language sql stable set search_path='' as $$
 select toon_private.toon_post_card(p_id)||jsonb_build_object('likeCount',p_count,'recentLikeCount',p_recent,'recentCommenterCount',p_commenters,'popularityScore',p_recent+2*p_commenters);
$$;
-- A new name preserves the earlier four-argument RPC contract during rollout.
create function public.toon_search_posts(p_category text,p_work uuid,p_q text,p_page integer,p_sort text) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_result jsonb;
begin
 if p_sort is null or p_sort not in ('latest','popular') or p_page is null or p_page not between 1 and 1000
  or p_q is null or char_length(p_q)>100 or (p_category is not null and p_category not in ('request','recommendation','information','general'))
  then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 if p_sort='popular' then
  with candidates as (
   select p.id,p.published_at from public.toon_posts p where p.deleted_at is null and p.publication_status='published' and p.moderation_status='visible'
    and (p_category is null or p.category=p_category) and toon_private.toon_post_public(p.id)
    and (p_work is null or (not p.is_spoiler and exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_work)))
    and (p_q='' or (not p.is_spoiler and position(lower(p_q) in lower(p.title||' '||p.body))>0))
  ), scored as materialized (
   select c.*,m.* from candidates c cross join lateral toon_private.toon_post_popularity_metrics(c.id) m
  ), page as (
   select * from scored order by popularity_score desc,published_at desc,id desc limit 21 offset (p_page-1)*20
  ), ranked as (select *,row_number() over(order by popularity_score desc,published_at desc,id desc) n from page)
  select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_post_popularity_card(id,like_count,recent_like_count,recent_commenter_count) order by n) filter(where n<=20),'[]'),
   'hasNext',count(*)>20 and p_page<1000) into v_result from ranked;
 else
  -- Limit latest candidates before calculating engagement metrics.
  with page as materialized (
   select p.id,p.published_at from public.toon_posts p where p.deleted_at is null and p.publication_status='published' and p.moderation_status='visible'
    and (p_category is null or p.category=p_category) and toon_private.toon_post_public(p.id)
    and (p_work is null or (not p.is_spoiler and exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_work)))
    and (p_q='' or (not p.is_spoiler and position(lower(p_q) in lower(p.title||' '||p.body))>0))
   order by p.published_at desc,p.id desc limit 21 offset (p_page-1)*20
  ), ranked as (select *,row_number() over(order by published_at desc,id desc) n from page), scored as (
   select r.*,m.* from ranked r cross join lateral toon_private.toon_post_popularity_metrics(r.id) m
  ) select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_post_popularity_card(id,like_count,recent_like_count,recent_commenter_count) order by n) filter(where n<=20),'[]'),
   'hasNext',count(*)>20 and p_page<1000) into v_result from scored;
 end if;
 return v_result;
end;$$;

alter table public.toon_notifications add column post_id uuid references public.toon_posts(id) on delete set null;
alter table public.toon_notifications add column post_comment_id uuid references public.toon_post_comments(id) on delete set null;
alter table public.toon_notifications drop constraint toon_notifications_kind_check;
alter table public.toon_notifications add constraint toon_notifications_kind_check
 check(kind in ('follow','tier_like','tier_comment','tier_reply','submission_result','post_like','post_comment','post_reply'));
create index toon_notifications_post_idx on public.toon_notifications(post_id) where post_id is not null;
create index toon_notifications_post_comment_idx on public.toon_notifications(post_comment_id) where post_comment_id is not null;
create function toon_private.toon_enqueue_post_notification(p_recipient uuid,p_actor uuid,p_kind text,p_post uuid,p_comment uuid,p_key text) returns void
language plpgsql set search_path='' as $$
declare v_preference text;
begin
 if p_kind is null or p_kind not in ('post_like','post_comment','post_reply') or p_post is null or p_key is null
  or (p_kind <> 'post_like' and p_comment is null) or p_recipient is null or p_actor is null or p_recipient=p_actor
  or not toon_private.toon_author_active(p_recipient) or not toon_private.toon_author_active(p_actor)
  or exists(select 1 from public.toon_blocks b where (b.blocker_id=p_actor and b.blocked_id=p_recipient) or (b.blocker_id=p_recipient and b.blocked_id=p_actor)) then return;end if;
 v_preference:=case when p_kind='post_like' then 'reactions' else 'replies' end;
 if not exists(select 1 from public.toon_user_settings s where s.user_id=p_recipient and s.notification_preferences->v_preference='true'::jsonb) then return;end if;
 if p_kind='post_like' and exists(select 1 from public.toon_notifications n where n.recipient_id=p_recipient and n.actor_id=p_actor and n.kind=p_kind
  and n.post_id=p_post and n.created_at>statement_timestamp()-interval '24 hours') then return;end if;
 insert into public.toon_notifications(recipient_id,actor_id,kind,post_id,post_comment_id,dedupe_key)
 values(p_recipient,p_actor,p_kind,p_post,p_comment,p_key) on conflict(recipient_id,dedupe_key) do nothing;
end;$$;
create function toon_private.toon_notify_post_like() returns trigger language plpgsql set search_path='' as $$
declare v_owner uuid;
begin
 select user_id into v_owner from public.toon_posts where id=new.post_id and toon_private.toon_post_public(id);
 perform toon_private.toon_enqueue_post_notification(v_owner,new.user_id,'post_like',new.post_id,null,
  'post-like:'||new.user_id::text||':'||new.post_id::text||':'||to_char(statement_timestamp() at time zone 'UTC','YYYYMMDD'));
 return new;
end;$$;
create trigger post_like_notification after insert on public.toon_post_reactions for each row execute function toon_private.toon_notify_post_like();
create function toon_private.toon_notify_post_comment() returns trigger language plpgsql set search_path='' as $$
declare v_owner uuid;v_parent_author uuid;
begin
 if new.deleted_at is not null or not toon_private.toon_post_comment_accessible(new.id) then return new;end if;
 select user_id into v_owner from public.toon_posts where id=new.post_id;
 if new.parent_id is not null then
  select user_id into v_parent_author from public.toon_post_comments where id=new.parent_id and post_id=new.post_id and deleted_at is null and toon_private.toon_post_comment_accessible(id);
  if v_parent_author is null then return new;end if;
  perform toon_private.toon_enqueue_post_notification(v_parent_author,new.user_id,'post_reply',new.post_id,new.id,'post-comment:'||new.id::text);
 end if;
 if v_owner is distinct from v_parent_author then
  perform toon_private.toon_enqueue_post_notification(v_owner,new.user_id,'post_comment',new.post_id,new.id,'post-comment:'||new.id::text);
 end if;
 return new;
end;$$;
create trigger post_comment_notification after insert on public.toon_post_comments for each row execute function toon_private.toon_notify_post_comment();

create or replace function toon_private.toon_notification_dto(p public.toon_notifications) returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_base jsonb;v_actor jsonb;v_visible boolean:=false;v_target jsonb;
begin
 if p.recipient_id is distinct from auth.uid() then return null;end if;
 v_base:=jsonb_build_object('id',p.id,'createdAt',to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'readAt',case when p.read_at is null then null else to_char(p.read_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end);
 if p.kind='submission_result' then
  v_visible:=exists(select 1 from public.toon_catalogue_submissions s where s.id=p.submission_id and s.user_id=auth.uid() and s.status in ('accepted','rejected'));
  v_target:=jsonb_build_object('submissionId',p.submission_id);
 elsif p.actor_id is not null and toon_private.toon_profile_visible(p.actor_id) then
  select jsonb_build_object('id',a.id,'username',a.username,'name',a.display_name) into v_actor from public.toon_profiles a where a.id=p.actor_id;
  if p.kind='follow' then
   v_visible:=exists(select 1 from public.toon_follows f where f.follower_id=p.actor_id and f.following_id=auth.uid() and toon_private.toon_follow_visible(f.follower_id,f.following_id));
   v_target:='{}'::jsonb;
  elsif p.kind in ('post_like','post_comment','post_reply') and toon_private.toon_post_public(p.post_id) then
   if p.kind='post_like' then
    v_visible:=exists(select 1 from public.toon_post_reactions r join public.toon_posts post on post.id=r.post_id
     where r.post_id=p.post_id and r.user_id=p.actor_id and post.user_id=auth.uid());
    v_target:=jsonb_build_object('postId',p.post_id);
   else
    v_visible:=exists(select 1 from public.toon_post_comments c join public.toon_posts post on post.id=c.post_id
     left join public.toon_post_comments parent on parent.id=c.parent_id
     where c.id=p.post_comment_id and c.post_id=p.post_id and c.user_id=p.actor_id and c.deleted_at is null
      and toon_private.toon_post_comment_accessible(c.id) and (c.parent_id is null or parent.deleted_at is null)
      and ((p.kind='post_comment' and post.user_id=auth.uid()) or (p.kind='post_reply' and parent.user_id=auth.uid())));
    v_target:=jsonb_build_object('postId',p.post_id,'commentId',p.post_comment_id);
   end if;
  elsif toon_private.toon_tier_accessible(p.tier_list_id,null) then
   if p.kind='tier_like' then
    v_visible:=exists(select 1 from public.toon_reactions r join public.toon_tier_lists l on l.id=r.tier_list_id
     where r.tier_list_id=p.tier_list_id and r.user_id=p.actor_id and l.user_id=auth.uid());
    v_target:=jsonb_build_object('tierId',p.tier_list_id);
   else
    v_visible:=exists(select 1 from public.toon_comments c join public.toon_tier_lists l on l.id=c.tier_list_id
     left join public.toon_comments parent on parent.id=c.parent_id
     where c.id=p.comment_id and c.tier_list_id=p.tier_list_id and c.user_id=p.actor_id and c.deleted_at is null
      and toon_private.toon_tier_comment_accessible(c.id)
      and (c.parent_id is null or parent.deleted_at is null)
      and ((p.kind='tier_comment' and l.user_id=auth.uid()) or (p.kind='tier_reply' and parent.user_id=auth.uid())));
    v_target:=jsonb_build_object('tierId',p.tier_list_id,'commentId',p.comment_id);
   end if;
  end if;
 end if;
 -- No original kind, actor, target identifiers, title, or body in tombstones.
 if not v_visible then return v_base||jsonb_build_object('kind','unavailable');end if;
 return v_base||jsonb_build_object('kind',p.kind)||v_target||case when v_actor is null then '{}'::jsonb else jsonb_build_object('actor',v_actor) end;
end;$$;


revoke all on function toon_private.toon_post_like_count(uuid),toon_private.toon_post_like_state(uuid),toon_private.toon_clear_deleted_post_reactions(),
 toon_private.toon_clear_blocked_post_reactions(),toon_private.toon_post_popularity_metrics(uuid),toon_private.toon_post_popularity_card(uuid,bigint,bigint,bigint),
 toon_private.toon_enqueue_post_notification(uuid,uuid,text,uuid,uuid,text),toon_private.toon_notify_post_like(),toon_private.toon_notify_post_comment()
 from public,anon,authenticated,service_role;
revoke all on function public.toon_get_post_like_state(uuid),public.toon_set_post_like(uuid,bigint,boolean),public.toon_search_posts(text,uuid,text,integer,text)
 from public,anon,authenticated,service_role;
grant execute on function public.toon_get_post_like_state(uuid),public.toon_search_posts(text,uuid,text,integer,text) to anon,authenticated;
grant execute on function public.toon_set_post_like(uuid,bigint,boolean) to authenticated;
commit;
