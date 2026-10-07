-- SOC-05 / SOC-06: future in-app notifications, reference-only and recipient-only.
-- No backfill, shared Auth/default grants, or existing mutation RPC replacement.
begin;
set local lock_timeout = '3s';

create table public.toon_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.toon_profiles(id) on delete cascade,
 actor_id uuid references public.toon_profiles(id) on delete set null,
 kind text not null check(kind in ('follow','tier_like','tier_comment','tier_reply','submission_result')),
 tier_list_id uuid references public.toon_tier_lists(id) on delete set null,
 comment_id uuid references public.toon_comments(id) on delete set null,
 submission_id uuid references public.toon_catalogue_submissions(id) on delete set null,
 dedupe_key text not null,
 read_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 unique(recipient_id,dedupe_key),
 check(actor_id is null or actor_id<>recipient_id)
);
create index toon_notifications_page_idx on public.toon_notifications(recipient_id,created_at desc,id desc);
create index toon_notifications_unread_idx on public.toon_notifications(recipient_id,created_at desc,id desc) where read_at is null;
create index toon_notifications_actor_idx on public.toon_notifications(actor_id) where actor_id is not null;
create index toon_notifications_tier_idx on public.toon_notifications(tier_list_id) where tier_list_id is not null;
create index toon_notifications_comment_idx on public.toon_notifications(comment_id) where comment_id is not null;
create index toon_notifications_submission_idx on public.toon_notifications(submission_id) where submission_id is not null;
alter table public.toon_notifications enable row level security;
-- Only bounded, redacted RPC projections; raw data and all DML stay inaccessible.
revoke all on public.toon_notifications from public,anon,authenticated,service_role;

create function toon_private.toon_enqueue_notification(p_recipient uuid,p_actor uuid,p_kind text,p_tier uuid,p_comment uuid,p_submission uuid,p_key text)
returns void language plpgsql set search_path = '' as $$
declare v_preference text;
begin
 if p_recipient is null or not toon_private.toon_author_active(p_recipient) then return;end if;
 if p_actor is not null and (p_actor=p_recipient or not toon_private.toon_author_active(p_actor)
  or exists(select 1 from public.toon_blocks b where (b.blocker_id=p_actor and b.blocked_id=p_recipient) or (b.blocker_id=p_recipient and b.blocked_id=p_actor))) then return;end if;
 v_preference:=case p_kind when 'follow' then 'followers' when 'tier_like' then 'reactions'
  when 'tier_comment' then 'replies' when 'tier_reply' then 'replies' when 'submission_result' then 'announcements' end;
 if not exists(select 1 from public.toon_user_settings s where s.user_id=p_recipient and s.notification_preferences->v_preference='true'::jsonb) then return;end if;
 -- Follow/like source RPCs already serialize the actor/recipient pair. Rolling
 -- 24h suppression survives unlike/refollow, without moving time or unread state.
 if p_kind in ('follow','tier_like') and exists(select 1 from public.toon_notifications n
  where n.recipient_id=p_recipient and n.actor_id=p_actor and n.kind=p_kind
  and n.tier_list_id is not distinct from p_tier and n.created_at>statement_timestamp()-interval '24 hours') then return;end if;
 insert into public.toon_notifications(recipient_id,actor_id,kind,tier_list_id,comment_id,submission_id,dedupe_key)
 values(p_recipient,p_actor,p_kind,p_tier,p_comment,p_submission,p_key) on conflict(recipient_id,dedupe_key) do nothing;
end;$$;

-- Invoker triggers inherit trusted source RPC context. No recipient access-row
-- locks here: source RPCs already hold actor/pair/parent locks in their own order.
create function toon_private.toon_notify_follow() returns trigger language plpgsql set search_path = '' as $$
begin
 perform toon_private.toon_enqueue_notification(new.following_id,new.follower_id,'follow',null,null,null,
  'follow:'||new.follower_id::text||':'||to_char(statement_timestamp() at time zone 'UTC','YYYYMMDD'));
 return new;
end;$$;
create trigger follow_notification after insert on public.toon_follows for each row execute function toon_private.toon_notify_follow();

create function toon_private.toon_notify_tier_like() returns trigger language plpgsql set search_path = '' as $$
declare v_owner uuid;
begin
 select l.user_id into v_owner from public.toon_tier_lists l where l.id=new.tier_list_id and toon_private.toon_tier_accessible(l.id,null);
 if v_owner is not null then
  perform toon_private.toon_enqueue_notification(v_owner,new.user_id,'tier_like',new.tier_list_id,null,null,
   'like:'||new.user_id::text||':'||new.tier_list_id::text||':'||to_char(statement_timestamp() at time zone 'UTC','YYYYMMDD'));
 end if;
 return new;
end;$$;
create trigger tier_like_notification after insert on public.toon_reactions for each row execute function toon_private.toon_notify_tier_like();

create function toon_private.toon_notify_tier_comment() returns trigger language plpgsql set search_path = '' as $$
declare v_owner uuid;v_parent_author uuid;
begin
 if new.deleted_at is not null or new.moderation_status<>'visible' or not toon_private.toon_tier_accessible(new.tier_list_id,null) then return new;end if;
 select user_id into v_owner from public.toon_tier_lists where id=new.tier_list_id;
 if new.parent_id is not null then
  select c.user_id into v_parent_author from public.toon_comments c where c.id=new.parent_id and c.tier_list_id=new.tier_list_id
   and c.deleted_at is null and toon_private.toon_tier_comment_accessible(c.id);
  if v_parent_author is null then return new;end if;
  perform toon_private.toon_enqueue_notification(v_parent_author,new.user_id,'tier_reply',new.tier_list_id,new.id,null,'comment:'||new.id::text);
 end if;
 if v_owner is distinct from v_parent_author then
  perform toon_private.toon_enqueue_notification(v_owner,new.user_id,'tier_comment',new.tier_list_id,new.id,null,'comment:'||new.id::text);
 end if;
 return new;
end;$$;
create trigger tier_comment_notification after insert on public.toon_comments for each row execute function toon_private.toon_notify_tier_comment();

create function toon_private.toon_notify_submission_result() returns trigger language plpgsql set search_path = '' as $$
begin
 if old.status='pending' and new.status in ('accepted','rejected') then
  perform toon_private.toon_enqueue_notification(new.user_id,null,'submission_result',null,null,new.id,'submission:'||new.id::text);
 end if;
 return new;
end;$$;
create trigger submission_result_notification after update of status on public.toon_catalogue_submissions for each row execute function toon_private.toon_notify_submission_result();

create function toon_private.toon_notification_dto(p public.toon_notifications) returns jsonb
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

create function public.toon_list_notifications(p_unread boolean default false,p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid:=auth.uid();v_before timestamptz;v_id uuid;v_result jsonb;
begin
 if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
 if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 if p_unread is null then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor) is distinct from 'object' then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
  if (select count(*) from jsonb_object_keys(p_cursor))<>2 or jsonb_typeof(p_cursor->'id') is distinct from 'string'
   or jsonb_typeof(p_cursor->'createdAt') is distinct from 'string'
   or p_cursor->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or p_cursor->>'createdAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
  then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
  begin
   v_before:=(p_cursor->>'createdAt')::timestamptz;v_id:=(p_cursor->>'id')::uuid;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_ERROR' using errcode='P0001';end;
 end if;
 with page as materialized (
  select n as notification,n.id,n.created_at from public.toon_notifications n where n.recipient_id=v_uid and (not p_unread or n.read_at is null)
   and (v_before is null or (n.created_at,n.id)<(v_before,v_id)) order by n.created_at desc,n.id desc limit 21
 ), ranked as (select p.id,p.created_at,toon_private.toon_notification_dto(p.notification) as dto,row_number() over(order by p.created_at desc,p.id desc) as n from page p)
 select jsonb_build_object('items',coalesce((select jsonb_agg(dto order by n) from ranked where n<=20),'[]'),
  'unreadCount',(select count(*) from public.toon_notifications where recipient_id=v_uid and read_at is null),
  'readThrough',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'next',case when (select count(*) from page)>20 then (select jsonb_build_object('id',id,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) from ranked where n=20) else null end)
 into v_result;
 return v_result;
end;$$;

create function public.toon_notification_unread_count() returns bigint
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
begin
 if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
 if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 return (select count(*) from public.toon_notifications where recipient_id=auth.uid() and read_at is null);
end;$$;

create function public.toon_mark_notification_read(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;v_read timestamptz;
begin
 v_uid:=toon_private.toon_require_current();perform toon_private.toon_take_rate('notification_read',120,60);
 if p_id is null then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 update public.toon_notifications set read_at=coalesce(read_at,statement_timestamp()) where id=p_id and recipient_id=v_uid returning read_at into v_read;
 if not found then raise exception 'NOT_FOUND' using errcode='P0001';end if;
 return jsonb_build_object('id',p_id,'readAt',to_char(v_read at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end;$$;

create function public.toon_mark_all_notifications_read(p_through text) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid;v_through timestamptz;v_count bigint;
begin
 v_uid:=toon_private.toon_require_current();perform toon_private.toon_take_rate('notification_read_all',20,60);
 if p_through is null or p_through !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$' then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 begin v_through:=p_through::timestamptz;
 exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_ERROR' using errcode='P0001';end;
 if v_through>statement_timestamp() then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 update public.toon_notifications set read_at=statement_timestamp() where recipient_id=v_uid and read_at is null and created_at<=v_through;
 get diagnostics v_count=row_count;
 return jsonb_build_object('through',p_through,'updated',v_count);
end;$$;

revoke all on function toon_private.toon_enqueue_notification(uuid,uuid,text,uuid,uuid,uuid,text),toon_private.toon_notify_follow(),toon_private.toon_notify_tier_like(),toon_private.toon_notify_tier_comment(),toon_private.toon_notify_submission_result(),toon_private.toon_notification_dto(public.toon_notifications) from public,anon,authenticated,service_role;
revoke all on function public.toon_list_notifications(boolean,jsonb),public.toon_notification_unread_count(),public.toon_mark_notification_read(uuid),public.toon_mark_all_notifications_read(text) from public,anon,authenticated,service_role;
grant execute on function public.toon_list_notifications(boolean,jsonb),public.toon_notification_unread_count(),public.toon_mark_notification_read(uuid),public.toon_mark_all_notifications_read(text) to authenticated;
commit;
