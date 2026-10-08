-- COM-01/02/03/04, SOC-03/06: community publication and current-access feed.
-- Additive shared-project migration. No Auth, other-app or default ACL changes.
begin;
set local lock_timeout = '3s';

create table public.toon_posts (
 id uuid primary key, user_id uuid not null references public.toon_profiles(id) on delete cascade,
 title text not null default '' check(char_length(title)<=100), body text not null default '' check(char_length(body)<=10000),
 category text not null default 'general' check(category in ('request','recommendation','information','general')),
 is_spoiler boolean not null default false,
 publication_status public.toon_publication_status not null default 'draft',
 moderation_status public.toon_moderation_status not null default 'visible',
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 published_at timestamptz,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(publication_status<>'published' or (published_at is not null and char_length(toon_private.toon_review_text_trim(title))>=5 and char_length(toon_private.toon_review_text_trim(body))>=20)),
 check(deleted_at is null or (title='' and body='' and publication_status='draft'))
);
create index toon_posts_public_page_idx on public.toon_posts(published_at desc,id desc) where deleted_at is null and publication_status='published' and moderation_status='visible';
create index toon_posts_category_page_idx on public.toon_posts(category,published_at desc,id desc) where deleted_at is null and publication_status='published' and moderation_status='visible';
create index toon_posts_owner_idx on public.toon_posts(user_id,updated_at desc,id desc) where deleted_at is null;
create table public.toon_post_works (
 post_id uuid not null references public.toon_posts(id) on delete cascade,
 work_id uuid not null references public.toon_works(id),position smallint not null check(position between 0 and 4),
 primary key(post_id,work_id),unique(post_id,position)
);
create index toon_post_works_work_idx on public.toon_post_works(work_id,post_id);
-- Dedicated drafts avoid altering the installed review draft guard/ACL.
create table toon_private.toon_post_drafts (
 post_id uuid primary key references public.toon_posts(id) on delete cascade,
 payload jsonb not null default '{"title":"","body":"","category":"general","isSpoiler":false,"workIds":[]}',
 version bigint not null default 1 check(version between 1 and 9007199254740991),updated_at timestamptz not null default now()
);
create index toon_post_drafts_works_idx on toon_private.toon_post_drafts using gin ((payload->'workIds'));
alter table public.toon_posts enable row level security;
alter table public.toon_post_works enable row level security;
alter table toon_private.toon_post_drafts enable row level security;
revoke all on public.toon_posts,public.toon_post_works,toon_private.toon_post_drafts from public,anon,authenticated,service_role;

create function toon_private.toon_validate_post_payload(p_payload jsonb,p_publishing boolean) returns void
language plpgsql set search_path='' as $$
begin
 perform toon_private.toon_assert_keys(p_payload,array['title','body','category','isSpoiler','workIds']);
 if not p_payload ?& array['title','body','category','isSpoiler','workIds'] or octet_length(p_payload::text)>65536
  or jsonb_typeof(p_payload->'title') is distinct from 'string' or char_length(p_payload->>'title')>100
  or jsonb_typeof(p_payload->'body') is distinct from 'string' or char_length(p_payload->>'body')>10000
  or jsonb_typeof(p_payload->'category') is distinct from 'string' or p_payload->>'category' not in ('request','recommendation','information','general')
  or jsonb_typeof(p_payload->'isSpoiler') is distinct from 'boolean' or jsonb_typeof(p_payload->'workIds') is distinct from 'array'
  then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 if jsonb_array_length(p_payload->'workIds')>5 or exists(select 1 from jsonb_array_elements(p_payload->'workIds') x where jsonb_typeof(x) is distinct from 'string' or x#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  or (select count(*)<>count(distinct x) from jsonb_array_elements_text(p_payload->'workIds') x)
  or (p_publishing and (char_length(toon_private.toon_review_text_trim(p_payload->>'title'))<5 or char_length(toon_private.toon_review_text_trim(p_payload->>'body'))<20))
  then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
end;$$;
create function toon_private.toon_lock_post_works(p_payload jsonb) returns void
language plpgsql set search_path='' as $$
begin
 perform w.id from public.toon_works w where w.id in (select x::uuid from jsonb_array_elements_text(p_payload->'workIds') x) order by w.id for share;
 if exists(select 1 from jsonb_array_elements_text(p_payload->'workIds') x where not toon_private.toon_work_public(x::uuid))
  then raise exception 'WORK_UNAVAILABLE' using errcode='P0001';end if;
end;$$;
create function public.toon_create_post_draft(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=toon_private.toon_require_current();v_owner uuid;v_deleted timestamptz;
begin
 perform toon_private.toon_take_rate('post_create',10,600);
 if p_id is null then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 insert into public.toon_posts(id,user_id) values(p_id,v_uid) on conflict(id) do nothing;
 select user_id,deleted_at into v_owner,v_deleted from public.toon_posts where id=p_id for update;
 if v_owner is distinct from v_uid or v_deleted is not null then raise exception 'CONFLICT' using errcode='P0001';end if;
 insert into toon_private.toon_post_drafts(post_id) values(p_id) on conflict do nothing;
 return p_id;
end;$$;
create function public.toon_save_post_draft(p_id uuid,p_version bigint,p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=toon_private.toon_require_current();v_version bigint;
begin
 perform toon_private.toon_take_rate('post_save',60,60);
 perform id from public.toon_posts where id=p_id and user_id=v_uid and deleted_at is null for update;
 if not found then raise exception 'NOT_FOUND' using errcode='P0001';end if;
 select version into v_version from toon_private.toon_post_drafts where post_id=p_id for update;
 if p_version is distinct from v_version or p_version is null then raise exception 'CONFLICT' using errcode='P0001';end if;
 perform toon_private.toon_validate_post_payload(p_payload,false);perform toon_private.toon_lock_post_works(p_payload);
 update toon_private.toon_post_drafts set payload=p_payload,version=version+1,updated_at=now() where post_id=p_id;
end;$$;
create function public.toon_publish_post(p_id uuid,p_draft_version bigint,p_post_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=toon_private.toon_require_current();v_post public.toon_posts;v_draft toon_private.toon_post_drafts;
begin
 perform toon_private.toon_take_rate('post_publish',10,600);
 select * into v_post from public.toon_posts where id=p_id and user_id=v_uid and deleted_at is null for update;
 if v_post.id is null then raise exception 'NOT_FOUND' using errcode='P0001';end if;
 select * into v_draft from toon_private.toon_post_drafts where post_id=p_id for update;
 if p_post_version is distinct from v_post.version or p_draft_version is null or p_draft_version is distinct from v_draft.version then raise exception 'CONFLICT' using errcode='P0001';end if;
 if v_post.moderation_status='hidden' then raise exception 'MODERATION_HIDDEN' using errcode='P0001';end if;
 perform toon_private.toon_validate_post_payload(v_draft.payload,true);perform toon_private.toon_lock_post_works(v_draft.payload);
 delete from public.toon_post_works where post_id=p_id;
 insert into public.toon_post_works(post_id,work_id,position) select p_id,x::uuid,(n-1)::smallint from jsonb_array_elements_text(v_draft.payload->'workIds') with ordinality a(x,n);
 update public.toon_posts set title=toon_private.toon_review_text_trim(v_draft.payload->>'title'),body=toon_private.toon_review_text_trim(v_draft.payload->>'body'),
  category=v_draft.payload->>'category',is_spoiler=(v_draft.payload->>'isSpoiler')::boolean,publication_status='published',
  published_at=coalesce(published_at,now()),updated_at=now(),version=version+1 where id=p_id;
end;$$;
create function public.toon_withdraw_post(p_id uuid,p_version bigint,p_delete boolean,p_confirm boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=toon_private.toon_require_current();v_post public.toon_posts;
begin
 perform toon_private.toon_take_rate('post_withdraw',20,60);
 if p_delete is null or p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode='P0001';end if;
 select * into v_post from public.toon_posts where id=p_id and user_id=v_uid and deleted_at is null for update;
 if v_post.id is null then raise exception 'NOT_FOUND' using errcode='P0001';end if;
 if p_version is distinct from v_post.version then raise exception 'CONFLICT' using errcode='P0001';end if;
 if p_delete then
  delete from toon_private.toon_post_drafts where post_id=p_id;
  delete from public.toon_post_works where post_id=p_id;
  update public.toon_posts set title='',body='',is_spoiler=false,category='general',publication_status='draft',deleted_at=now(),updated_at=now(),version=version+1 where id=p_id;
 else update public.toon_posts set publication_status='draft',updated_at=now(),version=version+1 where id=p_id;end if;
end;$$;
create function toon_private.toon_post_public(p_id uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.toon_posts p where p.id=p_id and p.deleted_at is null and p.publication_status='published' and p.moderation_status='visible'
 and toon_private.toon_profile_visible(p.user_id)
 and not exists(select 1 from public.toon_post_works w where w.post_id=p.id and not toon_private.toon_work_public(w.work_id)));
$$;
create function toon_private.toon_post_cards(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(toon_private.toon_work_card(work_id) order by position),'[]') from public.toon_post_works where post_id=p_id and toon_private.toon_work_public(work_id);
$$;
create function toon_private.toon_post_card(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'authorId',a.id,'username',a.username,'name',a.display_name,'avatar',a.avatar_path,
 'title',case when p.is_spoiler then null else p.title end,'excerpt',case when p.is_spoiler then null else left(p.body,240) end,
 'category',p.category,'isSpoiler',p.is_spoiler,'version',p.version,'publishedAt',p.published_at,'updatedAt',p.updated_at,
 'works',case when p.is_spoiler then '[]'::jsonb else toon_private.toon_post_cards(p.id) end)
 from public.toon_posts p join public.toon_profiles a on a.id=p.user_id where p.id=p_id and toon_private.toon_post_public(p.id);
$$;
create function public.toon_get_post(p_id uuid,p_reveal boolean,p_expected_version bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_post public.toon_posts;v_card jsonb;
begin
 v_card:=toon_private.toon_post_card(p_id);if v_card is null then return null;end if;
 select * into v_post from public.toon_posts where id=p_id;
 if p_reveal is true and p_expected_version is distinct from v_post.version then raise exception 'CONFLICT' using errcode='P0001';end if;
 return v_card||jsonb_build_object('title',case when not v_post.is_spoiler or p_reveal is true then v_post.title else null end,
 'body',case when not v_post.is_spoiler or p_reveal is true then v_post.body else null end,
 'works',case when not v_post.is_spoiler or p_reveal is true then toon_private.toon_post_cards(p_id) else '[]'::jsonb end);
end;$$;
create function public.toon_list_posts(p_category text,p_work uuid,p_q text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_items jsonb;v_more boolean;
begin
 if p_page is null or p_page not between 1 and 1000 or p_q is null or char_length(p_q)>100 or (p_category is not null and p_category not in ('request','recommendation','information','general')) then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 -- Hidden spoiler text/attachments must not become a search oracle.
 with candidates as materialized (
  select p.id,p.published_at from public.toon_posts p where p.deleted_at is null and p.publication_status='published' and p.moderation_status='visible'
  and (p_category is null or p.category=p_category) and toon_private.toon_post_public(p.id)
  and (p_work is null or (not p.is_spoiler and exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_work)))
  and (p_q='' or (not p.is_spoiler and position(lower(p_q) in lower(p.title||' '||p.body))>0))
  order by p.published_at desc,p.id desc limit 21 offset (p_page-1)*20
 ), numbered as (select *,row_number() over(order by published_at desc,id desc) n from candidates)
 select coalesce(jsonb_agg(toon_private.toon_post_card(id) order by n) filter(where n<=20),'[]'),count(*)>20 into v_items,v_more from numbered;
 return jsonb_build_object('items',v_items,'hasNext',v_more and p_page<1000);
end;$$;
create function public.toon_get_my_post_editor(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=toon_private.toon_require_current();
begin
 return (select jsonb_build_object('id',p.id,'postVersion',p.version,'publicationStatus',p.publication_status,'moderationStatus',p.moderation_status,
 'draftVersion',d.version,'draft',d.payload,'draftUpdatedAt',d.updated_at,'publishedTitle',p.title,'publishedBody',p.body,'publishedSpoiler',p.is_spoiler,
 'works',coalesce((select jsonb_agg(jsonb_build_object('id',x,'card',case when toon_private.toon_work_public(x::uuid) then toon_private.toon_work_card(x::uuid) else null end) order by n)
 from jsonb_array_elements_text(d.payload->'workIds') with ordinality a(x,n)),'[]'))
 from public.toon_posts p join toon_private.toon_post_drafts d on d.post_id=p.id where p.id=p_id and p.user_id=v_uid and p.deleted_at is null);
end;$$;
create function public.toon_list_my_posts(p_page integer) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare v_uid uuid:=toon_private.toon_require_current();v_result jsonb;
begin
 if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 with own as (select p.id,d.payload->>'title' title,p.publication_status,p.moderation_status,d.updated_at from public.toon_posts p join toon_private.toon_post_drafts d on d.post_id=p.id where p.user_id=v_uid and p.deleted_at is null order by d.updated_at desc,p.id desc limit 21 offset (p_page-1)*20), numbered as (select *,row_number() over(order by updated_at desc,id desc) n from own)
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'publicationStatus',publication_status,'moderationStatus',moderation_status,'updatedAt',updated_at) order by n) filter(where n<=20),'[]'),'hasNext',count(*)>20 and p_page<1000) into v_result from numbered;
 return v_result;
end;$$;
create table toon_private.toon_post_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.toon_profiles(id) on delete cascade,
 post_id uuid not null references public.toon_posts(id),reason text not null check(reason in ('spoiler','piracy','personal_information','harassment','spam','other')),
 detail text not null check(char_length(toon_private.toon_review_text_trim(detail)) between 10 and 2000),status text not null default 'pending' check(status in ('pending','resolved','rejected')),
 result_note text not null default '' check(char_length(result_note) <= 500),created_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index toon_post_reports_pending_unique_idx on toon_private.toon_post_reports(reporter_id,post_id) where status = 'pending';
create index toon_post_reports_owner_idx on toon_private.toon_post_reports(reporter_id,created_at desc,id desc);
create index toon_post_reports_queue_idx on toon_private.toon_post_reports(status,created_at,id);
create index toon_post_reports_post_idx on toon_private.toon_post_reports(post_id);
alter table toon_private.toon_post_reports enable row level security;
revoke all on toon_private.toon_post_reports from public,anon,authenticated;


create table toon_private.toon_post_moderation_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.toon_profiles(id) on delete set null,post_id uuid references public.toon_posts(id) on delete set null,
 report_id uuid references toon_private.toon_post_reports(id) on delete set null,action text not null,reason text not null check(char_length(toon_private.toon_review_text_trim(reason)) between 2 and 1000),
 created_at timestamptz not null default now()
);
create index toon_post_moderation_events_post_idx on toon_private.toon_post_moderation_events(post_id,created_at);
alter table toon_private.toon_post_moderation_events enable row level security;
revoke all on toon_private.toon_post_moderation_events from public,anon,authenticated;
create function public.toon_report_post(p_post uuid,p_reason text,p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('post_report',5,600);
 if p_reason is null or p_reason not in ('spoiler','piracy','personal_information','harassment','spam','other') or p_detail is null or char_length(toon_private.toon_review_text_trim(p_detail)) not between 10 and 2000
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 perform id from public.toon_posts where id = p_post for share;
 if not toon_private.toon_post_public(p_post) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if exists(select 1 from public.toon_posts where id = p_post and user_id = v_uid) then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 insert into toon_private.toon_post_reports(reporter_id,post_id,reason,detail) values(v_uid,p_post,p_reason,toon_private.toon_review_text_trim(p_detail)) on conflict(reporter_id,post_id) where status = 'pending' do nothing;
end;
$$;
create function public.toon_moderation_post_snapshot(p_id uuid,p_reveal boolean,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout='5s' as $$
declare v_post public.toon_posts;
begin
 perform toon_private.toon_require_review_moderator();select * into v_post from public.toon_posts where id = p_id for share;
 if v_post.id is null then return null;end if;
 if p_reveal is true and p_expected_version is distinct from v_post.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return jsonb_build_object('id',v_post.id,'version',v_post.version,'publicationStatus',v_post.publication_status,'moderationStatus',v_post.moderation_status,
  'deleted',v_post.deleted_at is not null,'isSpoiler',v_post.is_spoiler,
  'title',case when p_reveal is true and v_post.deleted_at is null and v_post.publication_status='published' and not exists(select 1 from public.toon_post_works w where w.post_id=v_post.id and not toon_private.toon_work_public(w.work_id)) then v_post.title else null end,
  'body',case when p_reveal is true and v_post.deleted_at is null and v_post.publication_status = 'published' and not exists(select 1 from public.toon_post_works w where w.post_id=v_post.id and not toon_private.toon_work_public(w.work_id)) then v_post.body else null end,
  'reports',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from (select id,reason,detail,status,result_note,created_at from toon_private.toon_post_reports where post_id = p_id order by created_at desc limit 50) q),'[]'),
  'events',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (select action,reason,created_at from toon_private.toon_post_moderation_events where post_id = p_id order by created_at desc limit 50) q),'[]'));
 -- No private editing payload, progress note, account credential, or reporter ID.
end;
$$;
create function public.toon_list_post_reports(p_page integer) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout='5s' as $$
begin
 perform toon_private.toon_require_review_moderator();if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,post_id,reason,detail,status,created_at from toon_private.toon_post_reports where status = 'pending' order by created_at,id limit 20 offset (p_page - 1)*20) q),'[]'),
  'hasNext',(select count(*) > p_page*20 from toon_private.toon_post_reports where status = 'pending') and p_page < 1000);
end;
$$;
create function public.toon_moderate_post(p_post uuid,p_version bigint,p_action text,p_reason text,p_report uuid,p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_post public.toon_posts;v_report toon_private.toon_post_reports;
begin
 perform toon_private.toon_require_review_moderator();perform toon_private.toon_take_rate('post_moderate',30,60);
 if p_action is null or p_action not in ('hide','restore','reject_report') or p_reason is null or char_length(toon_private.toon_review_text_trim(p_reason)) not between 2 and 1000
  or p_result is null or char_length(p_result) > 500 or (p_action = 'reject_report' and p_report is null)
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select * into v_post from public.toon_posts where id = p_post for update;
 if v_post.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if v_post.version is distinct from p_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_report is not null then
  select * into v_report from toon_private.toon_post_reports where id = p_report and post_id = p_post for update;
  if v_report.id is null or v_report.status <> 'pending' then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  if char_length(toon_private.toon_review_text_trim(p_result)) < 2 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 end if;
 if p_action <> 'reject_report' then
  if v_post.deleted_at is not null or v_post.publication_status <> 'published' then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
  if p_action = 'restore' and (exists(select 1 from public.toon_post_works w where w.post_id=v_post.id and not toon_private.toon_work_public(w.work_id)) or not toon_private.toon_author_active(v_post.user_id)) then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
  update public.toon_posts set moderation_status = case when p_action = 'hide' then 'hidden'::public.toon_moderation_status else 'visible'::public.toon_moderation_status end,
   version = version + 1,updated_at = now() where id = p_post;
 end if;
 if p_report is not null then update toon_private.toon_post_reports set status = case when p_action = 'reject_report' then 'rejected' else 'resolved' end,result_note = toon_private.toon_review_text_trim(p_result),resolved_at = now() where id = p_report;end if;
 insert into toon_private.toon_post_moderation_events(actor_id,post_id,report_id,action,reason) values(auth.uid(),p_post,p_report,p_action,toon_private.toon_review_text_trim(p_reason));
end;
$$;

create function public.toon_list_my_post_reports(p_page integer) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare v_uid uuid:=toon_private.toon_require_current();v_result jsonb;
begin
 if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 with rows as (select id,post_id,reason,detail,status,result_note,created_at,resolved_at from toon_private.toon_post_reports where reporter_id=v_uid order by created_at desc,id desc limit 21 offset (p_page-1)*20), numbered as (select *,row_number() over(order by created_at desc,id desc) n from rows)
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(numbered)-'n' order by n) filter(where n<=20),'[]'),'hasNext',count(*)>20 and p_page<1000) into v_result from numbered;
 return v_result;
end;$$;

alter table public.toon_activity_events add column post_id uuid references public.toon_posts(id) on delete cascade;
alter table public.toon_activity_events drop constraint toon_activity_events_check;
alter table public.toon_activity_events add constraint toon_activity_events_check check (
 (event_type='review_published' and review_id is not null and tier_list_id is null and post_id is null)
 or (event_type='tier_published' and tier_list_id is not null and review_id is null and post_id is null)
 or (event_type='post_published' and post_id is not null and review_id is null and tier_list_id is null));
create unique index toon_activity_post_once_idx on public.toon_activity_events(post_id) where post_id is not null;
create function toon_private.toon_record_post_activity() returns trigger
language plpgsql set search_path='' as $$
begin
 if toon_private.toon_post_public(new.id) then
  insert into public.toon_activity_events(actor_id,post_id,event_type) values(new.user_id,new.id,'post_published') on conflict do nothing;
 end if;return new;
end;$$;
create trigger post_public_activity after insert or update of publication_status on public.toon_posts for each row execute function toon_private.toon_record_post_activity();
create or replace function public.toon_get_following_feed(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_uid uuid:=auth.uid();v_before timestamptz;v_id uuid;v_result jsonb;
begin
 if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
 if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor) is distinct from 'object' then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
  if (select count(*) from jsonb_object_keys(p_cursor))<>2
   or jsonb_typeof(p_cursor->'id') is distinct from 'string'
   or jsonb_typeof(p_cursor->'createdAt') is distinct from 'string'
   or p_cursor->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or p_cursor->>'createdAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
  then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
  begin
   v_before:=(p_cursor->>'createdAt')::timestamptz;v_id:=(p_cursor->>'id')::uuid;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
   raise exception 'VALIDATION_ERROR' using errcode='P0001';
  end;
 end if;
 -- A cursor is only a sort boundary, never an authorization capability. Even if
 -- its old source was withdrawn, every candidate still needs current permission.
 with following as materialized (
  select f.following_id from public.toon_follows f where f.follower_id=v_uid
   and toon_private.toon_follow_visible(f.follower_id,f.following_id)
 ), page as materialized (
  select e.* from public.toon_activity_events e join following f on f.following_id=e.actor_id
  where (v_before is null or (e.created_at,e.id)<(v_before,v_id))
   and ((e.review_id is not null and exists(select 1 from public.toon_reviews r where r.id=e.review_id and r.user_id=e.actor_id and toon_private.toon_review_public(r.id)))
    or (e.tier_list_id is not null and exists(select 1 from public.toon_tier_lists l where l.id=e.tier_list_id and l.user_id=e.actor_id and toon_private.toon_tier_accessible(l.id,null)))
    or (e.post_id is not null and exists(select 1 from public.toon_posts p where p.id=e.post_id and p.user_id=e.actor_id and toon_private.toon_post_public(p.id))))
  order by e.created_at desc,e.id desc limit 21
 ), ranked as (
  select e.*,row_number() over(order by e.created_at desc,e.id desc) as n from page e
 ), cards as (
  select e.n,jsonb_build_object('eventId',e.id,'createdAt',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'author',jsonb_build_object('id',a.id,'username',a.username,'name',a.display_name,'avatarPath',a.avatar_path)) ||
   case when e.review_id is not null then jsonb_build_object('kind','review','id',r.id,'isSpoiler',r.is_spoiler,
    'work',jsonb_build_object('id',w.id,'title',w.title,'slug',w.slug),'excerpt',case when r.is_spoiler then null else left(r.body,240) end)
   when e.post_id is not null then jsonb_build_object('kind','post','id',post.id,'isSpoiler',post.is_spoiler,'title',case when post.is_spoiler then null else post.title end,'excerpt',case when post.is_spoiler then null else left(post.body,240) end)
   else jsonb_build_object('kind','tier','id',l.id,'isSpoiler',p.is_spoiler,'title',case when p.is_spoiler then null else p.payload->>'title' end) end as card
  from ranked e join public.toon_profiles a on a.id=e.actor_id
  left join public.toon_posts post on post.id=e.post_id
  left join public.toon_reviews r on r.id=e.review_id left join public.toon_works w on w.id=r.work_id
  left join public.toon_tier_lists l on l.id=e.tier_list_id
  left join public.toon_tier_list_publications p on p.tier_list_id=l.id and p.version=l.published_version
  where e.n<=20
 ) select jsonb_build_object('hasFollowing',exists(select 1 from following),
  'items',coalesce((select jsonb_agg(card order by n) from cards),'[]'),
  'next',case when (select count(*) from page)>20 then
   (select jsonb_build_object('id',id,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) from ranked where n=20)
   else null end) into v_result;
 return v_result;
end;$$;

-- Preserve existing merges for unrelated works. Referenced post works await a
-- dedicated preservation handler; never silently rewrite private draft payloads.
create function toon_private.toon_post_merge_blocked(p_source uuid,p_target uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.toon_post_works w join public.toon_posts p on p.id=w.post_id where p.deleted_at is null and w.work_id in (p_source,p_target))
 or exists(select 1 from toon_private.toon_post_drafts d join public.toon_posts p on p.id=d.post_id where p.deleted_at is null and ((d.payload->'workIds') ? p_source::text or (d.payload->'workIds') ? p_target::text));
$$;
create or replace function toon_private.toon_work_merge_summary(p_source uuid,p_target uuid) returns jsonb
language sql stable set search_path = '' as $$
 with base as (select toon_private.toon_personal_merge_summary(p_source,p_target) value), states as (
  select value,(to_regclass('public.toon_tier_list_items') is not null or toon_private.toon_post_merge_blocked(p_source,p_target)) blocked,
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

revoke all on toon_private.toon_post_reports,toon_private.toon_post_moderation_events from public,anon,authenticated,service_role;
revoke all on function toon_private.toon_validate_post_payload(jsonb,boolean),toon_private.toon_lock_post_works(jsonb),toon_private.toon_post_public(uuid),toon_private.toon_post_cards(uuid),toon_private.toon_post_card(uuid),toon_private.toon_record_post_activity(),toon_private.toon_post_merge_blocked(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.toon_create_post_draft(uuid),public.toon_save_post_draft(uuid,bigint,jsonb),public.toon_publish_post(uuid,bigint,bigint),public.toon_withdraw_post(uuid,bigint,boolean,boolean),public.toon_get_my_post_editor(uuid),public.toon_list_my_posts(integer),public.toon_get_post(uuid,boolean,bigint),public.toon_list_posts(text,uuid,text,integer),public.toon_report_post(uuid,text,text),public.toon_moderation_post_snapshot(uuid,boolean,bigint),public.toon_list_post_reports(integer),public.toon_moderate_post(uuid,bigint,text,text,uuid,text),public.toon_list_my_post_reports(integer) from public,anon,authenticated,service_role;
grant execute on function public.toon_create_post_draft(uuid),public.toon_save_post_draft(uuid,bigint,jsonb),public.toon_publish_post(uuid,bigint,bigint),public.toon_withdraw_post(uuid,bigint,boolean,boolean),public.toon_get_my_post_editor(uuid),public.toon_list_my_posts(integer),public.toon_report_post(uuid,text,text),public.toon_moderation_post_snapshot(uuid,boolean,bigint),public.toon_list_post_reports(integer),public.toon_moderate_post(uuid,bigint,text,text,uuid,text),public.toon_list_my_post_reports(integer) to authenticated;
grant execute on function public.toon_get_post(uuid,boolean,bigint),public.toon_list_posts(text,uuid,text,integer) to anon,authenticated;
commit;
